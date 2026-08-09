const slider = document.getElementById("infillSlider");
const number = document.getElementById("infillNumber");
const patterns = document.querySelectorAll(".pattern");
const stlInput = document.getElementById("stlInput");
const openStlButton = document.getElementById("openStlButton");
const viewport = document.getElementById("viewport");
const dropOverlay = document.getElementById("dropOverlay");
const fitButton = document.getElementById("fitButton");
const resetViewButton = document.getElementById("resetViewButton");
const printerSelect = document.getElementById("printerSelect");
const materialBrowser = document.getElementById("materialBrowser");
const materialName = document.getElementById("materialName");
const materialDescription = document.getElementById("materialDescription");
const materialSpecs = document.getElementById("materialSpecs");

slider.addEventListener("input", () => {
  number.textContent = slider.value;
});

patterns.forEach(pattern => {
  pattern.addEventListener("click", () => {
    patterns.forEach(item => item.classList.remove("selected"));
    pattern.classList.add("selected");
  });
});

openStlButton.addEventListener("click", () => stlInput.click());

stlInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) loadFile(file);
  event.target.value = "";
});

["dragenter", "dragover"].forEach(eventName => {
  viewport.addEventListener(eventName, event => {
    event.preventDefault();
    dropOverlay.classList.remove("hidden");
    dropOverlay.classList.add("active");
  });
});

["dragleave", "drop"].forEach(eventName => {
  viewport.addEventListener(eventName, event => {
    event.preventDefault();
    dropOverlay.classList.remove("active");
  });
});

viewport.addEventListener("drop", event => {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".stl")) {
    document.getElementById("viewerStatus").textContent = "Please drop an STL file";
    return;
  }
  loadFile(file);
});

async function loadFile(file) {
  try {
    document.getElementById("viewerStatus").textContent = `Loading ${file.name}…`;
    const buffer = await file.arrayBuffer();
    if (window.csliceViewer) {
      window.csliceViewer.loadSTL(buffer, file.name);
    } else {
      setTimeout(() => window.csliceViewer?.loadSTL(buffer, file.name), 100);
    }
  } catch (error) {
    console.error(error);
    document.getElementById("viewerStatus").textContent = "Could not read the STL file";
  }
}

fitButton.addEventListener("click", () => window.csliceViewer?.fitModel());
resetViewButton.addEventListener("click", () => window.csliceViewer?.resetView());

printerSelect.addEventListener("change", () => {
  const printer = printerSelect.options[printerSelect.selectedIndex].text;
  document.getElementById("viewerStatus").textContent = `${printer} selected — build plate preview updated`;
});

async function loadMaterialLibrary() {
  try {
    const indexResponse = await fetch("data/materials/index.json", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error("Material index could not be loaded");
    const index = await indexResponse.json();

    const families = await Promise.all(index.families.map(async file => {
      const response = await fetch(`data/materials/${file}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${file}`);
      return response.json();
    }));

    materialBrowser.innerHTML = "";

    families.forEach((family, familyIndex) => {
      const details = document.createElement("details");
      details.className = "material-family";
      if (familyIndex === 0) details.open = true;

      const summary = document.createElement("summary");
      summary.textContent = family.family;
      details.appendChild(summary);

      const variants = document.createElement("div");
      variants.className = "material-variants";

      family.variants.forEach((variant, variantIndex) => {
        const button = document.createElement("button");
        button.className = "material-variant";
        button.textContent = variant.name;
        button.dataset.materialId = variant.id;
        button.addEventListener("click", () => selectMaterial(variant, family, button));
        variants.appendChild(button);

        if (familyIndex === 0 && variantIndex === 0) {
          selectMaterial(variant, family, button);
        }
      });

      details.appendChild(variants);
      materialBrowser.appendChild(details);
    });
  } catch (error) {
    console.error(error);
    materialBrowser.innerHTML = '<div class="material-loading">Material library unavailable</div>';
  }
}

function selectMaterial(variant, family, selectedButton) {
  document.querySelectorAll(".material-variant").forEach(button => button.classList.remove("selected"));
  selectedButton.classList.add("selected");

  materialName.textContent = `${family.family} — ${variant.name}`;
  materialDescription.textContent = variant.description;
  materialSpecs.innerHTML = `
    <div class="material-spec"><b>Nozzle</b>${formatRange(variant.recommendedNozzle)}°C</div>
    <div class="material-spec"><b>Bed</b>${formatRange(variant.recommendedBed)}°C</div>
    <div class="material-spec"><b>Fan</b>${formatRange(variant.fan)}%</div>
    <div class="material-spec"><b>Speed</b>${formatRange(variant.speed)} mm/s</div>
  `;
}

function formatRange(value) {
  if (Array.isArray(value)) return value.length === 2 ? `${value[0]}–${value[1]}` : value.join(" / ");
  return value;
}

loadMaterialLibrary();
