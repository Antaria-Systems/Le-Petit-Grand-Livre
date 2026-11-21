/** Centre de la boîte englobante d'un chemin SVG (« M x,y L x,y … »). */
export function centreChemin(chemin: string): [number, number] {
  const n = chemin.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
