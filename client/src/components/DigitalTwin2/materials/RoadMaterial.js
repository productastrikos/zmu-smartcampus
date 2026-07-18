// Roads, footpaths, and fences/gates are rendered as native MapLibre GL
// paint layers, not Three.js meshes — real vector-tile line rendering is a
// better fit than re-drawing OSM line geometry inside the WebGL custom
// layer, and it's what DSO/Astriverse-style twins do for the flat road
// network too.
//
// Every highway=* type gets its own width/colour via a MapLibre `match`
// expression, so "each road type has its own material" the moment real
// primary/secondary/residential/cycleway ways exist — today this site only
// has highway=service/unclassified, so most branches are unused but wired.
// Uniform width across every road, per explicit request — was previously
// varied by highway=* type, but all real roads here now render at the
// same stroke width. Rendered as 3 stacked lines on the same source: a
// wide dark-grey surface, a soft orange glow, and a slim orange
// centerline on top — a command-center "illuminated road" look rather
// than a flat single-color stroke.
const ROAD_WIDTH = 15;
const HIGHWAY_COLORS = ['match', ['get', 'highway'],
  'primary', '#ffb26b',
  'secondary', '#ffc98c',
  'residential', '#ffd9ab',
  'service', '#c9d6e0',
  'unclassified', '#d7c9a3',
  'cycleway', '#8fe0c9',
  '#ffb26b', // default
];

export const ROAD_PAINT = {
  surface: { 'line-color': '#1c222b', 'line-width': ROAD_WIDTH - 2, 'line-opacity': 0.95 },
  glow: { 'line-color': '#ff8a3d', 'line-width': ROAD_WIDTH + 8, 'line-blur': 6, 'line-opacity': 0.25 },
  line: { 'line-color': HIGHWAY_COLORS, 'line-width': 3, 'line-opacity': 0.95 },
};

export const FOOTPATH_PAINT = {
  line: { 'line-color': '#c9d6e0', 'line-width': 1.2, 'line-opacity': 0.5, 'line-dasharray': [1, 1] },
};

export const CYCLEWAY_PAINT = {
  line: { 'line-color': '#8fe0c9', 'line-width': 1.4, 'line-opacity': 0.6, 'line-dasharray': [3, 1] },
};

export const FENCE_PAINT = {
  line: { 'line-color': '#8fa4b8', 'line-width': 1, 'line-opacity': 0.6, 'line-dasharray': [3, 2] },
};

export const GATE_PAINT = {
  point: { 'circle-radius': 4, 'circle-color': '#ffb26b', 'circle-opacity': 0.9, 'circle-stroke-color': '#fff3e0', 'circle-stroke-width': 1 },
};
