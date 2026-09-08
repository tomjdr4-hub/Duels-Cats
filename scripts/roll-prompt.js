import { emitRollResult } from "./duel-socket.js";

// Popup shown to the player controlling a duelist's token, letting them roll their own die instead
// of the GM rolling on their behalf. Fires regardless of which window the player has open.
export function showRollPrompt(data) {
  const content = `
    <div class="dc-roll-prompt">
      <img src="${data.tokenImg}" alt="${data.tokenName}" />
      <p>${game.i18n.format("DUELSCATS.RollPromptLabel", {
        name: data.tokenName,
        opponent: data.opponentName,
        stat: data.statLabel
      })}</p>
    </div>
  `;

  foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("DUELSCATS.RollPromptTitle") },
    content,
    buttons: [
      {
        action: "roll",
        label: game.i18n.localize("DUELSCATS.RollDie"),
        icon: "fa-solid fa-dice",
        default: true,
        callback: async () => {
          const roll = await new Roll("1d10").evaluate();
          if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
          const total = roll.total + (data.statValue || 0) + (data.repBonus || 0);
          emitRollResult({ duelId: data.duelId, role: data.role, rollTotal: total, rollDie: roll.total });
        }
      }
    ],
    rejectClose: false
  });
}
