import { aralikta, belgeBolumleri, type Dugum } from "@/lib/kaynakca-bolumu";

/*
  YAZARLIK RAPORU (03.11.2026). Belgenin ne kadarının yazım asistanından
  eklendiğini söyler: asistan izi taşıyan (lib/tiptap-asistan-izi.ts) ve
  hâlâ belgede duran metin / gövdenin tamamı.

  NE ÖLÇMEZ — raporda da yazıyor, çünkü bir yazarlık raporunun en kötü
  hâli olduğundan temiz görünmesidir:
    - Asistan panelinden "Kopyala" ile alınıp yapıştırılan metin izsizdir.
    - İşaretli parçanın ORTASINA yazılan metin işareti devralır; o
      durumda asistan payı fazla görünür (güvenli yön).
    - Başka bir araçtan (ChatGPT vb.) yapıştırılan metni hiçbir şey
      bilemez.
  Rapor bu yüzden bir "yapay zekâ tespit" puanı DEĞİL, ArvoLab içindeki
  eklemelerin kaydıdır.

  Sayım gövdede: kaynakça ve liste bölümleri (İçindekiler, Kısaltmalar…)
  dışarıda — öteki denetimlerle aynı sınır (lib/kaynakca-bolumu.ts).

  Saf modül; testi tests/unit/yazarlik-raporu.test.ts.
*/

export const ASISTAN_ISARETI = "asistanIzi";

type Isaret = { type?: string; attrs?: Record<string, unknown> };
type MetinDugumu = Dugum & { marks?: Isaret[] };

export type AsistanEklemesi = { kayit: string | null; kelime: number; ornek: string };

export type YazarlikRaporu = {
  toplamKelime: number;
  asistanKelime: number;
  /** Asistan payı, yüzde (tam sayı); gövde boşsa 0. */
  yuzde: number;
  eklemeler: AsistanEklemesi[];
};

const kelimeSay = (metin: string) => metin.split(/\s+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;

/** Bloğun metni, ardışık işaretli parçalar birleştirilerek. */
function parcalar(blok: Dugum): { metin: string; asistan: string | null | false }[] {
  const sonuc: { metin: string; asistan: string | null | false }[] = [];
  const gez = (d: MetinDugumu) => {
    if (d.type === "text") {
      const izi = (d.marks ?? []).find((m) => m.type === ASISTAN_ISARETI);
      const asistan = izi ? ((izi.attrs?.kayit as string | null | undefined) ?? null) : false;
      const son = sonuc.at(-1);
      if (son && son.asistan === asistan) son.metin += d.text ?? "";
      else sonuc.push({ metin: d.text ?? "", asistan });
      return;
    }
    // Blok sınırı ve satır sonu sözcük ayırır; aksi hâlde iki paragrafın uçları tek sözcük sayılırdı.
    if (d.type === "hardBreak" || d.type === "paragraph" || d.type === "heading") sonuc.push({ metin: " ", asistan: false });
    for (const c of d.content ?? []) gez(c);
  };
  gez(blok);
  return sonuc;
}

export function yazarlikRaporu(bloklar: Dugum[]): YazarlikRaporu {
  const { kaynakca, listeler } = belgeBolumleri(bloklar);
  const disarida = (i: number) => aralikta(kaynakca, i) || listeler.some((a) => i === a.bas || aralikta(a, i));
  let toplamKelime = 0;
  let asistanKelime = 0;
  const eklemeler = new Map<string, AsistanEklemesi>();
  let adsiz = 0;
  bloklar.forEach((blok, i) => {
    if (disarida(i) || (kaynakca && i === kaynakca.bas)) return;
    for (const p of parcalar(blok)) {
      const n = kelimeSay(p.metin);
      toplamKelime += n;
      if (p.asistan === false || n === 0) continue;
      asistanKelime += n;
      const anahtar = p.asistan ?? `adsiz-${adsiz++}`;
      const mevcut = eklemeler.get(anahtar);
      if (mevcut) mevcut.kelime += n;
      else eklemeler.set(anahtar, { kayit: p.asistan, kelime: n, ornek: p.metin.trim().slice(0, 80) });
    }
  });
  return {
    toplamKelime,
    asistanKelime,
    yuzde: toplamKelime ? Math.round((asistanKelime / toplamKelime) * 100) : 0,
    eklemeler: [...eklemeler.values()],
  };
}
