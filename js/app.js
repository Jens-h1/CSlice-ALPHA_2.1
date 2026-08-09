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
