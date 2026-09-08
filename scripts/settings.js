import { MODULE_ID } from "./constants.js";

const STAT_PATHS_SETTING = "statPaths";
const HISS_SOUND_SETTING = "hissSound";

// Best-guess defaults, modeled on the "system.identity.reputation" path already used by Cartes & Chats.
// Adjustable from the in-app settings window since every table's actor sheet may differ.
const DEFAULT_STAT_PATHS = {
  coussinet: "system.identity.coussinet",
  caresse: "system.identity.caresse",
  reputation: "system.identity.reputation"
};

export function registerDuelSettings() {
  game.settings.register(MODULE_ID, STAT_PATHS_SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_STAT_PATHS
  });

  game.settings.register(MODULE_ID, HISS_SOUND_SETTING, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
}

export function getStatPaths() {
  return { ...DEFAULT_STAT_PATHS, ...(game.settings.get(MODULE_ID, STAT_PATHS_SETTING) ?? {}) };
}

export async function setStatPaths(paths) {
  await game.settings.set(MODULE_ID, STAT_PATHS_SETTING, {
    coussinet: paths.coussinet || DEFAULT_STAT_PATHS.coussinet,
    caresse: paths.caresse || DEFAULT_STAT_PATHS.caresse,
    reputation: paths.reputation || DEFAULT_STAT_PATHS.reputation
  });
}

export function getHissSound() {
  return game.settings.get(MODULE_ID, HISS_SOUND_SETTING) || "";
}

export async function setHissSound(path) {
  await game.settings.set(MODULE_ID, HISS_SOUND_SETTING, path ?? "");
}

// Reads a dot-path attribute off an actor (e.g. "system.identity.coussinet"). Returns null when the
// path doesn't resolve to a usable number, so callers can fall back to manual entry (0, editable).
export function readActorStat(actor, path) {
  if (!actor || !path) return null;
  const value = foundry.utils.getProperty(actor, path);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}
