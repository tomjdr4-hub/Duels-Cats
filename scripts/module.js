import { MODULE_ID } from "./constants.js";
import { DuelsCatsApp } from "./duel-app.js";
import { registerDuelSettings } from "./settings.js";

let duelApp = null;

function openDuel() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("DUELSCATS.GMOnly"));
    return;
  }
  duelApp ??= new DuelsCatsApp();
  duelApp.render(true);
}

function createWidget() {
  if (!game.user.isGM) return;
  if (document.getElementById("duels-cats-widget")) return;

  const widget = document.createElement("div");
  widget.id = "duels-cats-widget";
  widget.title = game.i18n.localize("DUELSCATS.OpenDuel");
  widget.innerHTML = `<i class="fa-solid fa-paw"></i>`;
  widget.addEventListener("click", () => openDuel());
  document.body.append(widget);

  positionWidget();
}

function positionWidget() {
  const widget = document.getElementById("duels-cats-widget");
  if (!widget) return;

  const players = document.getElementById("players");
  if (players) {
    const rect = players.getBoundingClientRect();
    widget.style.left = `${rect.right + 8}px`;
    widget.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  } else {
    widget.style.left = "80px";
    widget.style.bottom = "110px";
  }
}

Hooks.once("init", () => {
  registerDuelSettings();

  game.keybindings.register(MODULE_ID, "openDuel", {
    name: "DUELSCATS.OpenDuel",
    restricted: true,
    editable: [{ key: "KeyD", modifiers: ["Control", "Shift"] }],
    onDown: () => {
      openDuel();
      return true;
    }
  });
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { openDuel };
  createWidget();
});

Hooks.on("renderPlayerList", () => positionWidget());
window.addEventListener("resize", () => positionWidget());

for (const hookName of ["canvasReady", "createToken", "deleteToken", "updateToken"]) {
  Hooks.on(hookName, () => {
    if (duelApp?.rendered) duelApp.render();
  });
}
