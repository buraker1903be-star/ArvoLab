/*
  DOÇENTLİK PUANI: GRUPLARA GÖRE ÖZET (26.10.2026, personel gözüyle
  ikinci geçiş). Başvuru hazırlayan akademisyen puanına kategori kategori
  bakıyor ("makalelerden kaç, atıflardan kaç"); eskiden faaliyetler tek
  düz listeydi ve grup toplamları yalnızca küçük etiketlerdeydi.

  Ekran ve yazdırılabilir döküm AYNI fonksiyondan besleniyor: biri bir
  toplam, öteki başka bir toplam yazarsa ikisine de güvenilmez.

  Saf modül; testi tests/unit/docentlik-ozeti.test.ts.
*/

export const GRUPSUZ = "Diğer";

type Kayit = { computed_points: number; criteria: { category_group: string | null } | null };

export type PuanGrubu<T> = { grup: string; toplam: number; pay: number; kayitlar: T[] };

/** Kayıtları kategori grubuna göre toplar; en çok puan getiren grup önce. */
export function puanGruplari<T extends Kayit>(kayitlar: T[]): { toplam: number; gruplar: PuanGrubu<T>[] } {
  const harita = new Map<string, T[]>();
  for (const k of kayitlar) {
    const grup = k.criteria?.category_group?.trim() || GRUPSUZ;
    harita.set(grup, [...(harita.get(grup) ?? []), k]);
  }
  const yuvarla = (n: number) => Math.round(n * 1e6) / 1e6;
  const toplam = yuvarla(kayitlar.reduce((t, k) => t + Number(k.computed_points || 0), 0));
  const gruplar = [...harita.entries()]
    .map(([grup, liste]) => {
      const grupToplami = yuvarla(liste.reduce((t, k) => t + Number(k.computed_points || 0), 0));
      return { grup, toplam: grupToplami, pay: toplam > 0 ? Math.round((grupToplami / toplam) * 100) : 0, kayitlar: liste };
    })
    .sort((a, b) => b.toplam - a.toplam || a.grup.localeCompare(b.grup, "tr"));
  return { toplam, gruplar };
}

/** Kriterleri gruplarına göre dizer; grup ve kod sırasıyla. */
export function kriterGruplari<T extends { code: string; category_group: string | null }>(kriterler: T[]): { grup: string; kriterler: T[] }[] {
  const harita = new Map<string, T[]>();
  for (const k of kriterler) {
    const grup = k.category_group?.trim() || GRUPSUZ;
    harita.set(grup, [...(harita.get(grup) ?? []), k]);
  }
  return [...harita.entries()]
    .sort(([a], [b]) => (a === GRUPSUZ ? 1 : b === GRUPSUZ ? -1 : a.localeCompare(b, "tr")))
    .map(([grup, liste]) => ({ grup, kriterler: liste.sort((a, b) => a.code.localeCompare(b.code, "tr", { numeric: true })) }));
}

/** "12,5" — ekranda ondalık virgülle, gereksiz sıfırsız. */
export const puanYazisi = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
