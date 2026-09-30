/**
 * A small subset of LDraw colour definitions, used only when the official
 * LDConfig.ldr (from the parts library) isn't available. Values are close to
 * the official ones but this is NOT the full palette — configure the library
 * for accurate colours (see README → LDraw setup).
 *
 * [code, name, value, edge, alpha?]
 */
const COLORS = [
  [0, 'Black', '#1B2A34', '#808080'],
  [1, 'Blue', '#1E5AA8', '#333333'],
  [2, 'Green', '#00852B', '#333333'],
  [3, 'Dark_Turquoise', '#069D9F', '#333333'],
  [4, 'Red', '#B40000', '#333333'],
  [5, 'Dark_Pink', '#D3359D', '#333333'],
  [6, 'Brown', '#543324', '#1E1E1E'],
  [7, 'Light_Grey', '#8A928D', '#333333'],
  [8, 'Dark_Grey', '#545955', '#333333'],
  [10, 'Bright_Green', '#58AB41', '#333333'],
  [14, 'Yellow', '#FAC80A', '#333333'],
  [15, 'White', '#F4F4F4', '#333333'],
  [16, 'Main_Colour', '#7F7F7F', '#333333'],
  [19, 'Tan', '#E4CD9E', '#333333'],
  [24, 'Edge_Colour', '#7F7F7F', '#333333'],
  [25, 'Orange', '#D67923', '#333333'],
  [26, 'Magenta', '#901F76', '#333333'],
  [27, 'Lime', '#A5CA18', '#333333'],
  [28, 'Dark_Tan', '#897D62', '#333333'],
  [33, 'Trans_Dark_Blue', '#0020A0', '#000064', 128],
  [36, 'Trans_Red', '#C91A09', '#880000', 128],
  [40, 'Trans_Black', '#635F52', '#171316', 128],
  [41, 'Trans_Light_Blue', '#AEEFEC', '#6ABCBA', 128],
  [46, 'Trans_Yellow', '#F5CD2F', '#8E7400', 128],
  [47, 'Trans_Clear', '#FCFCFC', '#C3C3C3', 128],
  [70, 'Reddish_Brown', '#5F3109', '#333333'],
  [71, 'Light_Bluish_Grey', '#969696', '#333333'],
  [72, 'Dark_Bluish_Grey', '#646464', '#333333'],
  [73, 'Medium_Blue', '#7396C8', '#333333'],
  [191, 'Bright_Light_Orange', '#FCAC00', '#333333'],
  [212, 'Bright_Light_Blue', '#9DC3F7', '#333333'],
  [226, 'Bright_Light_Yellow', '#FFEC6C', '#333333'],
  [272, 'Dark_Blue', '#19325A', '#1E1E1E'],
  [288, 'Dark_Green', '#00451A', '#1E1E1E'],
  [308, 'Dark_Brown', '#352100', '#1E1E1E'],
  [320, 'Dark_Red', '#720012', '#333333'],
  [321, 'Dark_Azure', '#469BC3', '#333333'],
  [322, 'Medium_Azure', '#68C3E2', '#333333'],
  [326, 'Yellowish_Green', '#E2F99A', '#333333'],
  [484, 'Dark_Orange', '#91501C', '#333333'],
];

export const FALLBACK_LDCONFIG = [
  '0 Built-in fallback colours (subset) for Local 3D Viewer',
  ...COLORS.map(
    ([code, name, value, edge, alpha]) =>
      `0 !COLOUR ${name} CODE ${code} VALUE ${value} EDGE ${edge}${alpha ? ` ALPHA ${alpha}` : ''}`,
  ),
].join('\n');
