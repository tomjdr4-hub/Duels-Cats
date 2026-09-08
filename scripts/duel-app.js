import { MODULE_ID } from "./constants.js";
import { getStatPaths, readActorStat } from "./settings.js";
import { DuelsCatsSettingsApp } from "./settings-app.js";
import { showVsOverlay } from "./vs-overlay.js";
import { showOutcomeOverlay } from "./outcome-overlay.js";
import { emitVsOverlay, emitOutcomeOverlay, emitRollRequest, findOwningPlayer } from "./duel-socket.js";
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

const ROLE_STAT_KEY = { provocant: "coussinet", provoque: "caresse" };

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
      forceRoll: DuelsCatsApp.#onForceRoll,
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
    this.pendingDuelId = null;
    this.pendingRolls = null;
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
      canRoll: !!this.slots.provocant && !!this.slots.provoque && !this.pendingRolls,
      pending: this.pendingRolls
        ? { provocant: this.#pendingEntry("provocant"), provoque: this.#pendingEntry("provoque") }
        : null,
      result: this.lastResult
    };
  }

  #pendingEntry(role) {
    const p = this.pendingRolls[role];
    if (!p) return null;
    if (p.status === "waiting") {
      return {
        waiting: true,
        canForce: !p.isAuto,
        label: game.i18n.format("DUELSCATS.WaitingFor", { name: p.waitingForName })
      };
    }
    return { waiting: false, total: p.total };
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
    if (this.pendingRolls) return; // don't reshuffle combatants mid-roll

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
    if (this.pendingRolls) return;
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
    if (!this.slots.provocant || !this.slots.provoque || this.pendingRolls) return;

    this.pendingDuelId = foundry.utils.randomID();
    this.pendingRolls = {
      provocant: { status: "waiting", waitingForName: "" },
      provoque: { status: "waiting", waitingForName: "" }
    };
    this.lastResult = null;
    this.render();

    const vsPayload = {
      leftImg: this.slots.provocant.img,
      leftName: this.slots.provocant.name,
      rightImg: this.slots.provoque.img,
      rightName: this.slots.provoque.name
    };
    emitVsOverlay(vsPayload);
    await showVsOverlay(vsPayload);

    this.#requestOrAutoRoll("provocant");
    this.#requestOrAutoRoll("provoque");
    this.render();
  }

  #requestOrAutoRoll(role) {
    const token = this.slots[role];
    const stats = this.overrides[role];
    const statKey = ROLE_STAT_KEY[role];
    const statLabel = game.i18n.localize(role === "provocant" ? "DUELSCATS.Coussinet" : "DUELSCATS.Caresse");
    const repBonus = this.useRepBonus[role] ? computeReputationBonus(stats.reputation) : 0;
    const opponentRole = role === "provocant" ? "provoque" : "provocant";

    const owner = findOwningPlayer(token.actor);
    if (owner) {
      this.pendingRolls[role] = { status: "waiting", waitingForName: owner.character?.name ?? owner.name, isAuto: false };
      emitRollRequest({
        duelId: this.pendingDuelId,
        toUserId: owner.id,
        role,
        statLabel,
        statValue: stats[statKey],
        repBonus,
        tokenImg: token.img,
        tokenName: token.name,
        opponentName: this.slots[opponentRole].name
      });
    } else {
      this.pendingRolls[role] = { status: "waiting", waitingForName: game.user.name, isAuto: true };
      this.#performLocalRoll(role, stats[statKey], repBonus);
    }
  }

  async #performLocalRoll(role, statValue, repBonus) {
    const roll = await new Roll("1d10").evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
    const total = computeTotal(roll.total, statValue, repBonus);
    this.#recordRoll(role, total, roll.total);
  }

  // Called from module.js's socket listener when a player sends back their roll result.
  handleRemoteRollResult(data) {
    if (!this.pendingDuelId || data.duelId !== this.pendingDuelId) return;
    this.#recordRoll(data.role, data.rollTotal, data.rollDie ?? data.rollTotal);
  }

  static #onForceRoll(_event, target) {
    const role = target.dataset.role;
    if (!this.pendingRolls || this.pendingRolls[role]?.status !== "waiting") return;
    const stats = this.overrides[role];
    const repBonus = this.useRepBonus[role] ? computeReputationBonus(stats.reputation) : 0;
    this.#performLocalRoll(role, stats[ROLE_STAT_KEY[role]], repBonus);
  }

  #recordRoll(role, total, die) {
    if (!this.pendingRolls || this.pendingRolls[role]?.status === "done") return;
    this.pendingRolls[role] = { status: "done", total, die };
    this.render();
    this.#maybeResolve();
  }

  async #maybeResolve() {
    if (this.pendingRolls.provocant.status !== "done" || this.pendingRolls.provoque.status !== "done") return;

    const provocantStats = this.overrides.provocant;
    const provoqueStats = this.overrides.provoque;
    const seuilProvocant = computeThreshold(provoqueStats.caresse);
    const seuilProvoque = computeThreshold(provocantStats.coussinet);
    const totalProvocant = this.pendingRolls.provocant.total;
    const totalProvoque = this.pendingRolls.provoque.total;
    const successProvocant = totalProvocant >= seuilProvocant;
    const successProvoque = totalProvoque >= seuilProvoque;

    this.lastRollData = {
      rollProvocant: this.pendingRolls.provocant.die,
      rollProvoque: this.pendingRolls.provoque.die,
      totalProvocant,
      totalProvoque,
      seuilProvocant,
      seuilProvoque,
      successProvocant,
      successProvoque,
      repBonusProvocant: this.useRepBonus.provocant ? computeReputationBonus(provocantStats.reputation) : 0,
      repBonusProvoque: this.useRepBonus.provoque ? computeReputationBonus(provoqueStats.reputation) : 0
    };

    const outcome = determineOutcome(successProvocant, successProvoque);
    this.lastResult = this.#buildResult(outcome);
    this.pendingDuelId = null;
    this.pendingRolls = null;

    // A double-fail needs the provoqué's choice first - no winner/fight reveal until #onResolveChoice.
    await this.#playOutcomeAnimation(outcome);

    this.#postResultChatMessage();
    this.render();
  }

  // Broadcasts + shows the post-duel "WINNER"/"FIGHT" screen matching the resolved outcome.
  async #playOutcomeAnimation(outcome) {
    const provocant = this.slots.provocant;
    const provoque = this.slots.provoque;

    let payload;
    if (outcome === "provocant") {
      payload = { mode: "winner", side: "left", img: provocant.img, name: provocant.name };
    } else if (outcome === "provoque") {
      payload = { mode: "winner", side: "right", img: provoque.img, name: provoque.name };
    } else if (outcome === "combat") {
      payload = { mode: "fight", leftImg: provocant.img, leftName: provocant.name, rightImg: provoque.img, rightName: provoque.name };
    } else {
      return; // "impressionne" - wait for the provoqué's choice
    }

    emitOutcomeOverlay(payload);
    await showOutcomeOverlay(payload);
  }

  static async #onResolveChoice(_event, target) {
    if (!this.lastRollData) return;
    const choice = target.dataset.choice; // "accept" | "combat"
    const outcome = choice === "accept" ? "provocant" : "combat";
    this.lastResult = this.#buildResult(outcome);
    await this.#playOutcomeAnimation(outcome);
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
