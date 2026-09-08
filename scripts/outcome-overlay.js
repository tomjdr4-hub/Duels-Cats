// Post-duel reveal, shown once both dice are in (or once the provoqué's choice on a double-fail is
// resolved). Same broadcast pattern as the VS overlay: whoever triggers it shows it locally and
// pushes it to everyone else over the module socket.
//
// payload:
// - { mode: "winner", side: "left" | "right", img, name }              -> single fighter, "WINNER"
// - { mode: "fight", leftImg, leftName, rightImg, rightName }          -> both fighters, "FIGHT"
export function showOutcomeOverlay(payload) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "duels-cats-outcome-overlay";

    if (payload.mode === "fight") {
      overlay.classList.add("dc-outcome-fight-mode");
      overlay.innerHTML = `
        <div class="dc-outcome-fighter dc-outcome-left">
          <img src="${payload.leftImg}" alt="${payload.leftName}" />
          <span>${payload.leftName}</span>
        </div>
        <div class="dc-outcome-word dc-outcome-fight">FIGHT</div>
        <div class="dc-outcome-fighter dc-outcome-right">
          <img src="${payload.rightImg}" alt="${payload.rightName}" />
          <span>${payload.rightName}</span>
        </div>
      `;
    } else {
      const sideClass = payload.side === "right" ? "dc-outcome-right" : "dc-outcome-left";
      overlay.innerHTML = `
        <div class="dc-outcome-fighter dc-outcome-solo ${sideClass}">
          <img src="${payload.img}" alt="${payload.name}" />
          <span>${payload.name}</span>
        </div>
        <div class="dc-outcome-word dc-outcome-winner">WINNER</div>
      `;
    }

    document.body.append(overlay);

    requestAnimationFrame(() => overlay.classList.add("dc-outcome-active"));

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      overlay.classList.add("dc-outcome-fading");
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 350);
    };

    overlay.addEventListener("click", dismiss);
    setTimeout(dismiss, 3000);
  });
}
