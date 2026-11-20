/** fetch JSON avec quelques tentatives (les API publiques sont parfois lentes). */
export async function getJson<T>(url: string, tentatives = 3): Promise<T> {
  let derniereErreur: unknown;
  for (let i = 0; i < tentatives; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      derniereErreur = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw derniereErreur;
}

export function odsExport(base: string, dataset: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `${base}/api/explore/v2.1/catalog/datasets/${dataset}/exports/json?${q}`;
}
