import { MODULE_ID } from "./constants.js";
import { getStatPaths, readActorStat } from "./settings.js";
import { DuelsCatsSettingsApp } from "./settings-app.js";
import { showVsOverlay } from "./vs-overlay.js";
import { computeThreshold, computeReputationBonus, computeTotal, determineOutcome, computeReputationGain } from "./resolve.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function getSceneTokens() {
  return (canvas.scene?.tokens?.contents ?? [])
    .map(token => ({
      id: token.id,
      name: token.name,
      img: token.texture?.src || token.actor?.img || "icons/svg/mystery-man.svg",
      actor: token.actor ?? null
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function freshStats(actor) {
  const paths = getStatPaths();
  return {
    coussinet: readActorStat(actor, paths.coussinet) ?? 0,
    caresse: readActorStat(actor, paths.caresse) ?? 0,
    reputation: readActorStat(actor, paths.reputation) ?? 0
  };
}

export class DuelsCatsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "duels-cats-app",
    window: {
      title: "DUELSCATS.AppTitle",
      icon: "fa-solid fa-paw",
      resizable: true
    },
    position: { width: 760, height: "auto" },
    actions: {
      clearSlot: DuelsCatsApp.#onClearSlot,
      roll: DuelsCatsApp.#onRoll,
      resolveChoice: DuelsCatsApp.#onResolveChoice,
      startCombat: DuelsCatsApp.#onStartCombat,
      applyReputation: DuelsCatsApp.#onApplyReputation,
      settings: DuelsCatsApp.#onSettings
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/duel.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.slots = { provocant: null, provoque: null };
    this.overrides = { provocant: null, provoque: null };
    this.useRepBonus = { provocant: true, provoque: true };
    this.lastResult = null;
    this.lastRollData = null;
  }

  async _prepareContext(_options) {
    const available = getSceneTokens().filter(
      t => t.id !== this.slots.provocant?.id && t.id !== this.slots.provoque?.id
    );

    const buildEntry = role => {
      const slot = this.slots[role];
      if (!slot) return null;
      const stats = this.overrides[role];
      return {
        id: slot.id,
        name: slot.name,
        img: slot.img,
        stats,
        useRepBonus: this.useRepBonus[role],
        repBonus: this.useRepBonus[role] ? computeReputationBonus(stats.reputation) : 0
      };
    };

    return {
      available,
      hasAvailable: available.length > 0,
      provocant: buildEntry("provocant"),
      provoque: buildEntry("provoque"),
      canRoll: !!this.slots.provocant && !!this.slots.provoque,
      result: this.lastResult
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;

    root.querySelectorAll(".dc-stat-input").forEach(input => {
      input.addEventListener("change", ev => {
        const { role, stat } = ev.target.dataset;
        if (!this.overrides[role]) return;
        this.overrides[role][stat] = Number(ev.target.value) || 0;
        this.render();
      });
      input.addEventListener("click", ev => ev.stopPropagation());
      input.addEventListener("dragstart", ev => ev.stopPropagation());
    });

    root.querySelectorAll(".dc-rep-toggle-input").forEach(input => {
      input.addEventListener("change", ev => {
        const { role } = ev.target.dataset;
        this.useRepBonus[role] = ev.target.checked;
        this.render();
      });
    });

    for (const el of root.querySelectorAll("[draggable='true']")) {
      el.addEventListener("dragstart", ev => {
        ev.dataTransfer.setData("text/plain", el.dataset.tokenId);
      });
    }

    for (const zone of root.querySelectorAll("[data-zone]")) {
      zone.addEventListener("dragover", ev => ev.preventDefault());
      zone.addEventListener("drop", ev => {
        ev.preventDefault();
        const tokenId = ev.dataTransfer.getData("text/plain");
        if (!tokenId) return;
        this.#assignToZone(zone.dataset.zone, tokenId);
      });
    }
  }

  #assignToZone(zone, tokenId) {
    for (const role of ["provocant", "provoque"]) {
      if (this.slots[role]?.id === tokenId) {
        this.slots[role] = null;
        this.overrides[role] = null;
      }
    }

    if (zone === "available") {
      this.lastResult = null;
      this.render();
      return;
    }

    const entry = getSceneTokens().find(t => t.id === tokenId);
    if (!entry) return;

    this.slots[zone] = entry;
    this.overrides[zone] = freshStats(entry.actor);
    if (this.useRepBonus[zone] === undefined) this.useRepBonus[zone] = true;
    this.lastResult = null;
    this.render();
  }

  static #onClearSlot(_event, target) {
    const role = target.dataset.role;
    this.slots[role] = null;
    this.overrides[role] = null;
    this.lastResult = null;
    this.render();
  }

  static #onSettings(_event, _target) {
    new DuelsCatsSettingsApp().render(true);
  }

  static async #onRoll(_event, _target) {
    if (!this.slots.provocant || !this.slots.provoque) return;

    await showVsOverlay({
      leftImg: this.slots.provocant.img,
      leftName: this.slots.provocant.name,
      rightImg: this.slots.provoque.img,
      rightName: this.slots.provoque.name
    });

    const provocantStats = this.overrides.provocant;
    const provoqueStats = this.overrides.provoque;

    const seuilProvocant = computeThreshold(provoqueStats.caresse);
    const seuilProvoque = computeThreshold(provocantStats.coussinet);

    const repBonusProvocant = this.useRepBonus.provocant ? computeReputationBonus(provocantStats.reputation) : 0;
    const repBonusProvoque = this.useRepBonus.provoque ? computeReputationBonus(provoqueStats.reputation) : 0;

    const rollProvocant = await new Roll("1d10").evaluate();
    const rollProvoque = await new Roll("1d10").evaluate();

    if (game.dice3d) {
      await Promise.all([
        game.dice3d.showForRoll(rollProvocant, game.user, true),
        game.dice3d.showForRoll(rollProvoque, game.user, true)
      ]);
    }

    const totalProvocant = computeTotal(rollProvocant.total, provocantStats.coussinet, repBonusProvocant);
    const totalProvoque = computeTotal(rollProvoque.total, provoqueStats.caresse, repBonusProvoque);
    const successProvocant = totalProvocant >= seuilProvocant;
    const successProvoque = totalProvoque >= seuilProvoque;

    this.lastRollData = {
      rollProvocant: rollProvocant.total,
      rollProvoque: rollProvoque.total,
      totalProvocant,
      totalProvoque,
      seuilProvocant,
      seuilProvoque,
      successProvocant,
      successProvoque,
      repBonusProvocant,
      repBonusProvoque
    };

    this.lastResult = this.#buildResult(determineOutcome(successProvocant, successProvoque));
    this.#postResultChatMessage();
    this.render();
  }

  static #onResolveChoice(_event, target) {
    if (!this.lastRollData) return;
    const choice = target.dataset.choice; // "accept" | "combat"
    this.lastResult = this.#buildResult(choice === "accept" ? "provocant" : "combat");
    this.#postResultChatMessage();
    this.render();
  }

  static async #onStartCombat(_event, _target) {
    const tokenIds = [this.slots.provocant?.id, this.slots.provoque?.id].filter(Boolean);
    if (tokenIds.length < 2) return;

    let combat = game.combats.active;
    if (!combat) combat = await Combat.create({ scene: canvas.scene?.id });
    try {
      await combat.activate();
    } catch (err) {
      console.warn("Duels & Chats | could not activate the combat encounter", err);
    }

    for (const tokenId of tokenIds) {
      const already = combat.combatants.find(c => c.tokenId === tokenId);
      if (!already) await combat.createEmbeddedDocuments("Combatant", [{ tokenId, sceneId: canvas.scene?.id }]);
    }

    ui.notifications.info(game.i18n.localize("DUELSCATS.CombatStarted"));
  }

  static async #onApplyReputation(_event, _target) {
    const transfer = this.lastResult?.reputationTransfer;
    if (!transfer || this.lastResult.applied) return;

    const winnerEntry = transfer.role === "provocant" ? this.slots.provocant : this.slots.provoque;
    const actor = winnerEntry?.actor;
    const paths = getStatPaths();

    if (actor) {
      const current = readActorStat(actor, paths.reputation) ?? 0;
      try {
        await actor.update({ [paths.reputation]: current + transfer.amount });
      } catch (err) {
        console.warn("Duels & Chats | could not write reputation back to the actor", err);
        ui.notifications.warn(game.i18n.localize("DUELSCATS.ReputationWriteFailed"));
      }
    }

    this.overrides[transfer.role].reputation = (this.overrides[transfer.role].reputation || 0) + transfer.amount;
    this.lastResult.applied = true;
    this.render();
  }

  #buildResult(outcome) {
    const data = this.lastRollData;
    const provocant = this.slots.provocant;
    const provoque = this.slots.provoque;
    const provocantStats = this.overrides.provocant;
    const provoqueStats = this.overrides.provoque;

    const outcomeLabels = {
      provocant: game.i18n.format("DUELSCATS.OutcomeProvocant", { winner: provocant.name }),
      provoque: game.i18n.format("DUELSCATS.OutcomeProvoque", { winner: provoque.name }),
      combat: game.i18n.localize("DUELSCATS.OutcomeCombat"),
      impressionne: game.i18n.format("DUELSCATS.OutcomeImpressionne", { provocant: provocant.name, provoque: provoque.name })
    };

    let reputationTransfer = null;
    const winnerRole = outcome === "provocant" ? "provocant" : outcome === "provoque" ? "provoque" : null;
    if (winnerRole) {
      const loserRole = winnerRole === "provocant" ? "provoque" : "provocant";
      const winnerStats = winnerRole === "provocant" ? provocantStats : provoqueStats;
      const loserStats = winnerRole === "provocant" ? provoqueStats : provocantStats;
      const loserRepBonus = loserRole === "provocant" ? data.repBonusProvocant : data.repBonusProvoque;
      const amount = computeReputationGain(winnerStats.reputation, loserStats.reputation, loserRepBonus);
      if (amount > 0) {
        const winnerEntry = winnerRole === "provocant" ? provocant : provoque;
        reputationTransfer = { role: winnerRole, amount, winnerName: winnerEntry.name };
      }
    }

    return {
      outcome,
      outcomeLabel: outcomeLabels[outcome],
      needsChoice: outcome === "impressionne",
      canStartCombat: outcome === "combat",
      provocant: {
        name: provocant.name,
        img: provocant.img,
        roll: data.rollProvocant,
        stat: provocantStats.coussinet,
        repBonus: data.repBonusProvocant,
        total: data.totalProvocant,
        threshold: data.seuilProvocant,
        success: data.successProvocant
      },
      provoque: {
        name: provoque.name,
        img: provoque.img,
        roll: data.rollProvoque,
        stat: provoqueStats.caresse,
        repBonus: data.repBonusProvoque,
        total: data.totalProvoque,
        threshold: data.seuilProvoque,
        success: data.successProvoque
      },
      reputationTransfer,
      reputationTransferLabel: reputationTransfer
        ? game.i18n.format("DUELSCATS.ReputationTransfer", { winner: reputationTransfer.winnerName, amount: reputationTransfer.amount })
        : null,
      applied: false
    };
  }

  #postResultChatMessage() {
    const r = this.lastResult;
    ChatMessage.create({
      content: `
        <div class="duels-cats-chat-card">
          <div class="dc-chat-fighters">
            <div class="dc-chat-fighter"><img src="${r.provocant.img}" alt="${r.provocant.name}" /><span>${r.provocant.name}</span></div>
            <div class="dc-chat-vs">VS</div>
            <div class="dc-chat-fighter"><img src="${r.provoque.img}" alt="${r.provoque.name}" /><span>${r.provoque.name}</span></div>
          </div>
          <p class="dc-chat-roll">${game.i18n.format("DUELSCATS.ChatRollLine", {
            name: r.provocant.name,
            roll: r.provocant.roll,
            stat: r.provocant.stat,
            total: r.provocant.total,
            threshold: r.provocant.threshold,
            result: r.provocant.success ? "✅" : "❌"
          })}</p>
          <p class="dc-chat-roll">${game.i18n.format("DUELSCATS.ChatRollLine", {
            name: r.provoque.name,
            roll: r.provoque.roll,
            stat: r.provoque.stat,
            total: r.provoque.total,
            threshold: r.provoque.threshold,
            result: r.provoque.success ? "✅" : "❌"
          })}</p>
          <p class="dc-chat-outcome"><strong>${r.outcomeLabel}</strong></p>
          ${r.reputationTransferLabel ? `<p class="dc-chat-rep">${r.reputationTransferLabel}</p>` : ""}
        </div>
      `
    });
  }
}
