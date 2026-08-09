# CSlice

Free browser-based 3D slicer project.

## Current milestone

### Alpha 2.1
- Interactive Three.js build-plate viewport
- Orbit camera controls: rotate, pan and zoom
- STL file loading from the Open STL button
- STL drag-and-drop support
- Automatic model centering and fit-to-view
- Model dimensions display
- 350 × 350 mm K2 Plus build plate preview
- JSON-backed material library
- Expandable material families and variants
- Material recommendation cards
- Infill density control with live percentage display
- Infill pattern selector with visual SVG previews
- Local `.cslice.json` project export

## Project structure

```text
CSlice/
├── assets/
├── css/
├── data/
│   ├── materials/
│   ├── printers/
│   └── profiles/
├── js/
├── profiles/
└── index.html
```

CSlice is currently a frontend prototype. Actual toolpath generation and G-code export are planned for a later milestone.
