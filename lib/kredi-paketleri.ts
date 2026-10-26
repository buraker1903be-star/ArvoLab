/*
  AI KREDİ PAKETLERİ — ArvoOS'un bildirdiği liste (26.10.2026).

  Fiyat ve paket ArvoOS'ta tanımlı (ArvoOS lib/ai-kredi-paketleri.ts);
  bireysel abone de kurumla aynı paketleri alıyor (kurum sahibinin
  kararı). ArvoLab listeyi KOPYALAMIYOR: abonelik köprüsünün "ensure"
  yanıtında creditPackages olarak geliyor. Kopya tutulsaydı fiyat
  değiştiği gün iki taraf ayrı fiyat gösterirdi; ödemede ArvoOS'un tutarı
  geçerli olduğu için müşteri ekranda gördüğünden farklı öderdi.

  Yanıt hoşgörülü okunuyor (lib/billing-plan.ts ile aynı ilke): eksik ya
  da tanınmayan alanlı paket ATILIYOR, uydurulmuyor. Fiyatı bilinmeyen bir
  "Satın al" düğmesi müşteriden ne ödeyeceğini söylemeden para istemek
  olurdu.

  Saf modül; testi tests/unit/kredi-paketleri.test.ts.
*/

export type KrediPaketi = {
  kod: string;
  ad: string;
  kredi: number;
  /** Kuruş cinsinden tamsayı. */
  fiyat: number;
};

const tamsayi = (deger: unknown): number | null => {
  const sayi = typeof deger === "string" && /^\d+$/.test(deger.trim()) ? Number(deger) : deger;
  return typeof sayi === "number" && Number.isInteger(sayi) && sayi > 0 ? sayi : null;
};

export function krediPaketleriniOku(payload: unknown): KrediPaketi[] {
  const liste = (payload as { creditPackages?: unknown } | null)?.creditPackages;
  if (!Array.isArray(liste)) return [];
  const paketler: KrediPaketi[] = [];
  for (const oge of liste) {
    if (!oge || typeof oge !== "object") continue;
    const o = oge as Record<string, unknown>;
    const kod = typeof o.kod === "string" && /^[a-z0-9_-]{1,32}$/i.test(o.kod) ? o.kod : null;
    const kredi = tamsayi(o.kredi);
    const fiyat = tamsayi(o.fiyat);
    if (!kod || !kredi || !fiyat) continue;
    const ad = typeof o.ad === "string" && o.ad.trim() ? o.ad.trim().slice(0, 60) : `${kredi.toLocaleString("tr-TR")} kredi`;
    paketler.push({ kod, ad, kredi, fiyat });
  }
  return paketler.sort((a, b) => a.kredi - b.kredi);
}

/** "499 TL" — kuruş tamsayıdan; kesirli kısım yalnızca varsa yazılır. */
export function paketFiyati(kurus: number): string {
  const tl = kurus / 100;
  return `${tl.toLocaleString("tr-TR", { minimumFractionDigits: Number.isInteger(tl) ? 0 : 2, maximumFractionDigits: 2 })} TL`;
}

/** 1.000 kredi başına fiyat (kuruş): paketleri karşılaştırmak için. */
export const binKrediFiyati = (paket: KrediPaketi) => Math.round((paket.fiyat / paket.kredi) * 1000);
