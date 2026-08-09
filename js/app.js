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
const saveProjectButton = document.getElementById("saveProjectButton");
const layerHeightSelect = document.getElementById("layerHeightSelect");
const transformButtons = {
  translate: document.getElementById("moveButton"),
  rotate: document.getElementById("rotateButton"),
  scale: document.getElementById("scaleButton")
};

let selectedMaterial = null;
let selectedPattern = "Grid";
let loadedModelName = null;
let printerProfiles = [];
let materialFamilies = [];

slider.addEventListener("input", () => {
  number.textContent = slider.value;
});

patterns.forEach(pattern => {
  pattern.addEventListener("click", () => {
    patterns.forEach(item => item.classList.remove("selected"));
    pattern.classList.add("selected");
    selectedPattern = pattern.dataset.pattern || pattern.textContent.trim();
  });
});

Object.entries(transformButtons).forEach(([mode, button]) => {
  button.addEventListener("click", () => {
    Object.values(transformButtons).forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    window.csliceViewer?.setTransformMode(mode);
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
    loadedModelName = file.name;
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
  const printer = printerProfiles.find(profile => profile.id === printerSelect.value);
  if (!printer) return;

  if (printer.buildVolume && window.csliceViewer?.setBuildPlate) {
    window.csliceViewer.setBuildPlate(printer.buildVolume.x, printer.buildVolume.y, printer.buildVolume.z);
  }

  updateMaterialAvailability(printer);

  const volume = printer.buildVolume;
  document.getElementById("viewerStatus").textContent = `${printer.name} — ${volume.x} × ${volume.y} × ${volume.z} mm build volume`;
  window.csliceViewer?.fitModel();
});

saveProjectButton.addEventListener("click", () => {
  const project = {
    format: "CSlice Project",
    version: 1,
    createdAt: new Date().toISOString(),
    printer: printerSelect.value,
    filament: selectedMaterial?.name || null,
    layerHeight: layerHeightSelect?.value || "0.20mm Standard",
    infill: {
      density: Number(slider.value),
      pattern: selectedPattern
    },
    model: loadedModelName
  };

  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${loadedModelName ? loadedModelName.replace(/\.stl$/i, "") : "CSlice-project"}.cslice.json`;
  link.click();
  URL.revokeObjectURL(url);
  document.getElementById("viewerStatus").textContent = "Project saved";
});

async function loadPrinterLibrary() {
  try {
    const indexResponse = await fetch("data/printers/index.json", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error("Printer index could not be loaded");
    const index = await indexResponse.json();
    printerProfiles = await Promise.all(index.printers.map(async file => {
      const response = await fetch(`data/printers/${file}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${file}`);
      const profile = await response.json();
      return { ...profile, id: profile.id || file.replace(/\.json$/i, "") };
    }));

    printerSelect.innerHTML = "";
    printerProfiles.forEach(profile => {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      printerSelect.appendChild(option);
    });

    const firstPrinter = printerProfiles[0];
    if (firstPrinter?.buildVolume && window.csliceViewer?.setBuildPlate) {
      window.csliceViewer.setBuildPlate(firstPrinter.buildVolume.x, firstPrinter.buildVolume.y, firstPrinter.buildVolume.z);
    }
    if (firstPrinter) updateMaterialAvailability(firstPrinter);
  } catch (error) {
    console.error(error);
    printerSelect.innerHTML = '<option value="k2-plus">Creality K2 Plus</option>';
  }
}

async function loadMaterialLibrary() {
  try {
    const indexResponse = await fetch("data/materials/index.json", { cache: "no-store" });
    if (!indexResponse.ok) throw new Error("Material index could not be loaded");
    const index = await indexResponse.json();

    materialFamilies = await Promise.all(index.families.map(async file => {
      const response = await fetch(`data/materials/${file}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load ${file}`);
      return response.json();
    }));

    renderMaterialLibrary();
  } catch (error) {
    console.error(error);
    materialBrowser.innerHTML = '<div class="material-loading">Material library unavailable</div>';
  }
}

function renderMaterialLibrary() {
  materialBrowser.innerHTML = "";
  const printer = printerProfiles.find(profile => profile.id === printerSelect.value);

  materialFamilies.forEach((family, familyIndex) => {
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

      const supported = !printer?.supportedMaterials || printer.supportedMaterials.some(name => name.toLowerCase() === variant.name.toLowerCase());
      if (!supported) {
        button.classList.add("unsupported");
        button.title = `${variant.name} is not listed as supported by ${printer.name}`;
      }

      button.addEventListener("click", () => selectMaterial(variant, family, button));
      variants.appendChild(button);

      if (familyIndex === 0 && variantIndex === 0 && !selectedMaterial) {
        selectMaterial(variant, family, button);
      }
    });

    details.appendChild(variants);
    materialBrowser.appendChild(details);
  });
}

function updateMaterialAvailability(printer) {
  if (!materialFamilies.length) return;
  renderMaterialLibrary();

  if (selectedMaterial) {
    const supported = printer.supportedMaterials?.some(name => name.toLowerCase() === selectedMaterial.name.toLowerCase());
    if (!supported) {
      document.getElementById("viewerStatus").textContent += " — selected material may not be supported";
    }
  }
}

function selectMaterial(variant, family, selectedButton) {
  selectedMaterial = { ...variant, family: family.family };
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

loadPrinterLibrary();
loadMaterialLibrary();
