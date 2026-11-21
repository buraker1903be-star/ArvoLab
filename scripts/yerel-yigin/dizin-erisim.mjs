/*
  GERÇEK DİZİN ERİŞİMİ DENETİMİ (21.11.2026). Davranış kabulünden AYRI:
  her dizine TEK istek atar, sonucu yazar. Yeniden denemez (429'u aşmak
  için art arda istek atmak hem servise yük hem de sonucu yanıltır).
  Çıkış kodu: 0 = ikisi de erişilebilir, 2 = en az biri ENGELLİ.
  Engel hiçbir zaman başarı sayılmaz.
*/
const HEDEFLER = [
  ["OpenAlex arama", "https://api.openalex.org/works?per-page=1&search=peer%20learning"],
  ["Crossref arama", "https://api.crossref.org/works?rows=1&query=peer%20learning"],
];
let engel = 0;
for (const [ad, adres] of HEDEFLER) {
  try {
    const c = await fetch(adres, { headers: { Accept: "application/json", "User-Agent": "ArvoLab/1.0 (erisim-denetimi)" }, signal: AbortSignal.timeout(15000) });
    const ek = c.status === 429 ? ` (retry-after: ${c.headers.get("retry-after") ?? "?"})` : "";
    if (c.status !== 200) engel++;
    console.log(`${c.status === 200 ? "ERİŞİLEBİLİR" : "ENGEL"} ${ad}: HTTP ${c.status}${ek}`);
  } catch (e) {
    engel++;
    console.log(`ENGEL ${ad}: ${String(e).slice(0, 120)}`);
  }
}
process.exit(engel ? 2 : 0);
