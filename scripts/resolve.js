// Pure duel-resolution math, kept free of Foundry API calls so the rules stay easy to read/adjust.
//
// Rules (Chats & Griffes - scène de duel) :
// - Le provocant lance 1d10 + Coussinet, doit atteindre 5 + 2 x Caresse du provoqué.
// - Le provoqué lance 1d10 + Caresse, doit atteindre 5 + 2 x Coussinet du provocant.
// - Chacun peut ajouter +1 par tranche de 5 points de réputation à son jet (optionnel).
// - Si le perdant a plus de réputation que le gagnant, le gagnant gagne le bonus de réputation du perdant.

export function computeThreshold(opponentStatValue) {
  return 5 + 2 * (opponentStatValue || 0);
}

export function computeReputationBonus(reputation) {
  return Math.floor((reputation || 0) / 5);
}

export function computeTotal(dieRoll, statValue, repBonus) {
  return dieRoll + (statValue || 0) + (repBonus || 0);
}

// "provocant" | "provoque" | "combat" | "impressionne"
export function determineOutcome(successProvocant, successProvoque) {
  if (successProvocant && !successProvoque) return "provocant";
  if (successProvoque && !successProvocant) return "provoque";
  if (successProvocant && successProvoque) return "combat";
  return "impressionne";
}

// Returns the reputation points the winner gains, or 0 if the loser wasn't more reputed.
export function computeReputationGain(winnerReputation, loserReputation, loserRepBonus) {
  if ((loserReputation || 0) > (winnerReputation || 0)) return loserRepBonus || 0;
  return 0;
}
