import { getHissSound } from "./settings.js";

// Full-screen "VS" faceoff shown before the dice are rolled. Purely cosmetic/local-DOM: it does not
// touch game state. Resolves once the intro has played (auto-dismiss, or an early click to skip).
//
// playSound defaults to true for the GM who starts the duel (AudioHelper's push:true already
// broadcasts that sound to everyone) - callers displaying the overlay in response to the socket
// broadcast must pass { playSound: false } so the sound doesn't fire again on every client.
export function showVsOverlay({ leftImg, leftName, rightImg, rightName }, { playSound = true } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "duels-cats-vs-overlay";
    overlay.innerHTML = `
      <div class="dc-vs-fighter dc-vs-left">
        <img src="${leftImg}" alt="${leftName}" />
        <span>${leftName}</span>
      </div>
      <div class="dc-vs-versus">VS</div>
      <div class="dc-vs-fighter dc-vs-right">
        <img src="${rightImg}" alt="${rightName}" />
        <span>${rightName}</span>
      </div>
    `;
    document.body.append(overlay);

    if (playSound) {
      const hissSound = getHissSound();
      if (hissSound) {
        foundry.audio.AudioHelper.play({ src: hissSound, volume: 0.8, autoplay: true, loop: false }, true);
      }
    }

    requestAnimationFrame(() => overlay.classList.add("dc-vs-active"));

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.classList.add("dc-vs-fading");
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 350);
    };

    overlay.addEventListener("click", dismiss);
    setTimeout(dismiss, 2600);
  });
}
