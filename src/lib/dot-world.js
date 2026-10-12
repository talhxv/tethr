// A strip of the world as dots: where there is land on a 7.5° grid, from
// 75°N to 52.5°S. Coastlines only, to the nearest cell — no borders and no
// country shapes. Each row is a latitude with the longitude runs that are
// land at it.
const STEP = 7.5
const TOP = 75

const LAND = [
  [71.25,  [[-165, -142], [-125, -75], [-55, -22], [22, 30], [52, 180]]],
  [63.75,  [[-166, -93], [-78, -63], [-52, -40], [-23, -14], [8, 178]]],
  [56.25,  [[-162, -155], [-132, -94], [-77, -60], [-6, -2], [8, 13], [21, 137], [156, 163]]],
  [48.75,  [[-125, -55], [-5, 142]]],
  [41.25,  [[-124, -70], [-9, 3], [12, 17], [20, 48], [53, 129], [140, 142]]],
  [33.75,  [[-120, -77], [-7, 11], [35, 120], [131, 137]]],
  [26.25,  [[-112, -97], [-82, -80], [-14, 34], [35, 57], [61, 120]]],
  [18.75,  [[-105, -95], [-91, -87], [-73, -69], [-16, 38], [42, 55], [73, 85], [94, 108], [120, 122]]],
  [11.25,  [[-86, -83], [-75, -62], [-15, 51], [76, 79], [99, 109], [122, 126]]],
  [3.75,   [[-77, -52], [9, 47], [96, 104], [109, 118]]],
  [-3.75,  [[-80, -37], [11, 40], [102, 106], [110, 116], [131, 150]]],
  [-11.25, [[-77, -37], [14, 40], [131, 136], [142, 143]]],
  [-18.75, [[-70, -40], [12, 36], [44, 49], [122, 146]]],
  [-26.25, [[-70, -48], [15, 33], [114, 153]]],
  [-33.75, [[-72, -54], [18, 26], [116, 122], [135, 151]]],
  [-41.25, [[-73, -63], [145, 148], [172, 176]]],
  [-48.75, [[-75, -67]]],
]

export const COLS = 360 / STEP
export const ROWS = LAND.length

// Longitude -> column (fractional), latitude -> row (fractional)
export const lonToCol = (lon) => (lon + 180) / STEP - 0.5
export const latToRow = (lat) => (TOP - lat) / STEP - 0.5

// -> [[col, row], ...] for every land cell
export function landDots() {
  const dots = []
  LAND.forEach(([, runs], row) => {
    for (let col = 0; col < COLS; col++) {
      const lon = -180 + (col + 0.5) * STEP
      if (runs.some(([from, to]) => lon >= from - STEP * 0.3 && lon <= to + STEP * 0.3)) dots.push([col, row])
    }
  })
  return dots
}
