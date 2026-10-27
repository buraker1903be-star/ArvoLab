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

/*
  HEDEFLER (20261027081037). grup null = toplam hedef. Kurum hedefi aynı
  gruptaki genel hedefin yerine geçer: kurum kendi yönetmeliğiyle genel
  ÜAK eşiğini yükseltebilir, iki hedefin birden gösterilmesi "hangisi
  geçerli" sorusunu kullanıcıya bırakırdı.
*/
export type Hedef = { organization_id: string | null; grup: string | null; asgari_puan: number };
export type HedefDurumu = { grup: string | null; hedef: number; mevcut: number; eksik: number; kaynak: "genel" | "kurum" };

export function etkinHedefler(hedefler: Hedef[], kurum: string | null): Hedef[] {
  const harita = new Map<string, Hedef>();
  for (const h of hedefler) {
    if (h.organization_id !== null && h.organization_id !== kurum) continue;
    const anahtar = h.grup?.trim() || "";
    const onceki = harita.get(anahtar);
    if (!onceki || (onceki.organization_id === null && h.organization_id !== null)) harita.set(anahtar, h);
  }
  return [...harita.values()];
}

export function hedefDurumlari(
  hedefler: Hedef[],
  toplam: number,
  gruplar: { grup: string; toplam: number }[],
): { toplamHedef: HedefDurumu | null; grupHedefleri: HedefDurumu[] } {
  const yuvarla = (n: number) => Math.round(n * 1e6) / 1e6;
  const durum = (h: Hedef, mevcut: number): HedefDurumu => ({
    grup: h.grup?.trim() || null,
    hedef: Number(h.asgari_puan),
    mevcut,
    eksik: Math.max(0, yuvarla(Number(h.asgari_puan) - mevcut)),
    kaynak: h.organization_id ? "kurum" : "genel",
  });
  const toplamH = hedefler.find((h) => !h.grup?.trim());
  const grupHedefleri = hedefler
    .filter((h) => h.grup?.trim())
    .map((h) => durum(h, gruplar.find((g) => g.grup === h.grup!.trim())?.toplam ?? 0))
    .sort((a, b) => b.eksik - a.eksik || (a.grup ?? "").localeCompare(b.grup ?? "", "tr"));
  return { toplamHedef: toplamH ? durum(toplamH, toplam) : null, grupHedefleri };
}

/*
  DÖNEM. Faaliyet doktora tarihinden SONRA mı? Tarih karşılaştırması gün
  anahtarıyla ("2024-05-01"), saat dilimi yok: ikisi de takvim günü.
  Aynı gün "sonra" sayılmıyor — unvan o gün alınıyor, ÜAK "aldıktan
  sonra" diyor; şüphede kullanıcının lehine değil, temkinli taraf.
  Tarihi girilmemiş faaliyet hiçbir döneme sayılmaz, ayrıca sayılır:
  sessizce "sonra" saymak puanı şişirirdi.
*/
export type Donem = "sonra" | "once" | "bilinmiyor";

export function faaliyetDonemi(faaliyetTarihi: string | null | undefined, doktoraTarihi: string | null | undefined): Donem {
  if (!faaliyetTarihi || !doktoraTarihi) return "bilinmiyor";
  return faaliyetTarihi.slice(0, 10) > doktoraTarihi.slice(0, 10) ? "sonra" : "once";
}
