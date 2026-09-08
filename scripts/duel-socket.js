import { MODULE_ID } from "./constants.js";

const SOCKET_NAME = `module.${MODULE_ID}`;

export function emitVsOverlay(payload) {
  game.socket.emit(SOCKET_NAME, { action: "vsOverlay", ...payload });
}

export function emitRollRequest(payload) {
  game.socket.emit(SOCKET_NAME, { action: "rollRequest", ...payload });
}

export function emitRollResult(payload) {
  game.socket.emit(SOCKET_NAME, { action: "rollResult", ...payload, byUserId: game.user.id });
}

// Registered on every connected client (module.js, at ready) so the VS screen and the roll prompt
// show up regardless of which window someone has open, the same way Cartes & Chats pops up incoming
// trade offers.
export function registerDuelSocket({ onVsOverlay, onRollRequest, onRollResult }) {
  game.socket.on(SOCKET_NAME, data => {
    if (data.action === "vsOverlay") {
      onVsOverlay?.(data);
    } else if (data.action === "rollRequest" && data.toUserId === game.user.id) {
      onRollRequest?.(data);
    } else if (data.action === "rollResult") {
      onRollResult?.(data);
    }
  });
}

// The first connected, non-GM user with OWNER permission on the actor - i.e. the player who should
// get the "roll your die" prompt. Returns null for an NPC (or an offline owner), meaning the GM
// rolls that side themselves.
export function findOwningPlayer(actor) {
  if (!actor) return null;
  return game.users.find(u => !u.isGM && u.active && actor.testUserPermission?.(u, "OWNER")) ?? null;
}
