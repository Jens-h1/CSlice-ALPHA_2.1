const WELCOME_KEY = "cslice-welcome-seen";

export function initWelcome({ onComplete } = {}) {
  if (localStorage.getItem(WELCOME_KEY) === "1") return;

  const modal = document.createElement("div");
  modal.className = "welcome-overlay";
  modal.innerHTML = `
    <div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <button class="welcome-close" aria-label="Close">×</button>
      <div class="welcome-logo"><span>CS</span></div>
      <p class="eyebrow">WELCOME TO CSLICE</p>
      <h1 id="welcome-title">Let's set up your workspace.</h1>
      <p class="welcome-copy">Choose your printer to start with the correct build plate, print volume and compatible materials.</p>
      <label for="welcomePrinter">Printer</label>
      <select id="welcomePrinter"><option>Loading printers…</option></select>
      <div class="welcome-actions">
        <button class="welcome-skip secondary">Skip for now</button>
        <button class="welcome-start">Start printing</button>
      </div>
      <p class="welcome-note">You can change your printer anytime from the sidebar.</p>
    </div>`;
  document.body.appendChild(modal);

  const select = modal.querySelector("#welcomePrinter");
  const finish = (skipped = false) => {
    localStorage.setItem(WELCOME_KEY, "1");
    modal.remove();
    if (!skipped && onComplete) onComplete(select.value);
  };

  fetch("data/printers/index.json")
    .then(r => r.json())
    .then(async index => {
      const profiles = await Promise.all(index.printers.map(file => fetch(`data/printers/${file}`).then(r => r.json())));
      select.innerHTML = profiles.map(p => `<option value="${p.id || p.name}">${p.name}</option>`).join("");
    })
    .catch(() => { select.innerHTML = `<option value="Creality K2 Plus">Creality K2 Plus</option>`; });

  modal.querySelector(".welcome-close").onclick = () => finish(true);
  modal.querySelector(".welcome-skip").onclick = () => finish(true);
  modal.querySelector(".welcome-start").onclick = () => finish(false);
}
