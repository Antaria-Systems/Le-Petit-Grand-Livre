/** Projection et simplification des contours communaux pour la carte de situation. */

type Point = [number, number];

/**
 * Douglas-Peucker sur un contour FERMÉ : le premier et le dernier point étant confondus, on coupe
 * l'anneau en deux au point le plus éloigné du départ, puis on simplifie chaque moitié.
 */
export function simplifier(points: Point[], tolerance: number): Point[] {
  if (points.length <= 3) return points;
  const [x0, y0] = points[0];
  let loin = 1;
  for (let i = 1; i < points.length; i++) {
    if (Math.hypot(points[i][0] - x0, points[i][1] - y0) > Math.hypot(points[loin][0] - x0, points[loin][1] - y0)) loin = i;
  }
  const a = simplifierOuvert(points.slice(0, loin + 1), tolerance);
  const b = simplifierOuvert(points.slice(loin), tolerance);
  return [...a, ...b.slice(1)];
}

/** Douglas-Peucker : retire les points qui s'écartent de moins de `tolerance` du tracé. */
function simplifierOuvert(points: Point[], tolerance: number): Point[] {
  if (points.length <= 3) return points;
  const garder = new Uint8Array(points.length);
  garder[0] = garder[points.length - 1] = 1;
  const pile: [number, number][] = [[0, points.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop()!;
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const longueur = Math.hypot(dx, dy) || 1;
    let max = 0;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / longueur;
      if (d > max) {
        max = d;
        indice = i;
      }
    }
    if (max > tolerance && indice > 0) {
      garder[indice] = 1;
      pile.push([a, indice], [indice, b]);
    }
  }
  return points.filter((_, i) => garder[i]);
}

export type Geometrie = { type: "Polygon"; coordinates: Point[][] } | { type: "MultiPolygon"; coordinates: Point[][][] };

const anneaux = (g: Geometrie): Point[][] => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());

/**
 * Projette les contours d'un département dans un cadre de 1000 unités de large
 * (équirectangulaire corrigée par la latitude moyenne : fidèle à cette échelle).
 */
export function projeterDepartement(contours: Map<string, Geometrie>, largeur = 1000, tolerance = 0.9) {
  let [lonMin, latMin, lonMax, latMax] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const g of contours.values()) {
    for (const r of anneaux(g)) {
      for (const [lon, lat] of r) {
        lonMin = Math.min(lonMin, lon);
        lonMax = Math.max(lonMax, lon);
        latMin = Math.min(latMin, lat);
        latMax = Math.max(latMax, lat);
      }
    }
  }
  const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
  const echelle = largeur / ((lonMax - lonMin) * k);
  const hauteur = Math.ceil((latMax - latMin) * echelle);
  const projeter = ([lon, lat]: Point): Point => [(lon - lonMin) * k * echelle, (latMax - lat) * echelle];

  const chemins = new Map<string, string>();
  for (const [code, g] of contours) {
    const d = anneaux(g)
      .map((r) => simplifier(r.map(projeter), tolerance))
      .filter((r) => r.length >= 3)
      .map((r) => "M" + r.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z")
      .join("");
    chemins.set(code, d);
  }
  return { viewBox: `0 0 ${largeur} ${hauteur}`, chemins };
}
