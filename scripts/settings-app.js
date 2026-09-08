import { MODULE_ID } from "./constants.js";
import { getStatPaths, setStatPaths, getHissSound, setHissSound } from "./settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DuelsCatsSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "duels-cats-settings",
    tag: "form",
    window: {
      title: "DUELSCATS.SettingsTitle",
      icon: "fa-solid fa-gear",
      resizable: true
    },
    position: { width: 480, height: "auto" },
    actions: {
      browseSound: DuelsCatsSettingsApp.#onBrowseSound,
      clearSound: DuelsCatsSettingsApp.#onClearSound,
      inspectActor: DuelsCatsSettingsApp.#onInspectActor,
      save: DuelsCatsSettingsApp.#onSave
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/settings.hbs`, scrollable: [".dc-inspect-output"] }
  };

  async _prepareContext(_options) {
    const actors = game.actors.contents
      .map(a => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { paths: getStatPaths(), hissSound: getHissSound(), actors, hasActors: actors.length > 0 };
  }

  // Dumps the selected actor's system data as JSON so the GM can find the exact key path to type
  // above (e.g. seeing {"identity":{"coussinet":3}} means the path is system.identity.coussinet).
  static #onInspectActor(_event, _target) {
    const select = this.element.querySelector('select[name="inspectActorId"]');
    const output = this.element.querySelector(".dc-inspect-output");
    const actor = game.actors.get(select?.value);
    if (!actor || !output) return;
    output.textContent = JSON.stringify(actor.system, null, 2);
    output.hidden = false;
  }

  static #onBrowseSound(_event, _target) {
    const input = this.element.querySelector('input[name="hissSound"]');
    const picker = new FilePicker({
      type: "audio",
      current: input?.value ?? "",
      callback: path => {
        if (input) input.value = path;
      }
    });
    picker.render(true);
  }

  static #onClearSound(_event, _target) {
    const input = this.element.querySelector('input[name="hissSound"]');
    if (input) input.value = "";
  }

  static async #onSave(_event, _target) {
    const form = this.element;
    await setStatPaths({
      coussinet: form.elements.coussinet.value.trim(),
      caresse: form.elements.caresse.value.trim(),
      reputation: form.elements.reputation.value.trim()
    });
    await setHissSound(form.elements.hissSound.value.trim());
    ui.notifications.info(game.i18n.localize("DUELSCATS.SettingsSaved"));
    this.close();
  }
}
