/*
  Yazı tipi, punto ve satır aralığının kılavuza uyup uymadığı.

  Her tez yazım kılavuzunun ilk maddesi budur ("Times New Roman, 12 punto,
  1,5 satır aralığı") ve belge kontrolü tam da onu denetlemiyordu: kılavuz
  değerleri editörün VARSAYILANI olarak uygulanıyor, Word çıktısına da
  öyle yazılıyordu — ama metne elle verilmiş ya da başka bir yerden
  yapıştırılmış biçim varsayılanı eziyordu. Öğrenci ekranda tek tip bir
  belge görüyor, jüriye giden dosyada üç ayrı yazı tipi oluyordu.

  Denetlenen şey "belgenin yazı tipi" değil, METNE ELLE VERİLMİŞ biçim:
  değer verilmemiş metin zaten kılavuzun değeriyle çıkıyor. Bu yüzden
  Word'den aktarılan tezler kendiliğinden uyarı üretmez (aktarım biçim
  değil yapı taşır) — uyarı yalnızca gerçekten sapmış yerlerde çıkar.

  Saf modül; testi tests/unit/metin-bicimi.test.ts.
*/

interface BicimDugumu {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  marks?: { type?: string; attrs?: Record<string, unknown> | null }[];
  content?: BicimDugumu[];
}

export interface MetinBicimKurali {
  fontFamily?: string;
  fontSizePt?: number;
  lineSpacing?: number;
}

export interface BicimSapmasi {
  /** Sapan değer: "Arial", "11 pt", "1" */
  deger: string;
  /** Kaç metin parçası / paragraf böyle */
  sayi: number;
  /** Editörde bulunup gösterilecek ilk örnek */
  ornek: string;
}

export interface MetinBicimRaporu {
  yaziTipi: BicimSapmasi[];
  punto: BicimSapmasi[];
  satirAraligi: BicimSapmasi[];
}

/* Yazı tipi adı CSS'te tırnaklı ve yedekli gelebilir:
   "Times New Roman", Times, serif → ilk aile karşılaştırılır. */
const aileAdi = (deger: string) =>
  deger.split(",")[0].trim().replace(/^["']|["']$/g, "").toLocaleLowerCase("tr-TR");

const puntoDegeri = (deger: unknown): number | null => {
  const sayi = Number.parseFloat(String(deger ?? "").replace(",", "."));
  return Number.isFinite(sayi) && sayi > 0 ? sayi : null;
};

const yakin = (a: number, b: number) => Math.abs(a - b) < 0.01;

class Sayac {
  private kayitlar = new Map<string, BicimSapmasi>();
  ekle(deger: string, ornek: string) {
    const kayit = this.kayitlar.get(deger);
    if (kayit) kayit.sayi += 1;
    else this.kayitlar.set(deger, { deger, sayi: 1, ornek: ornek.slice(0, 60) });
  }
  /** Çoktan aza: en yaygın sapma önce görünsün. */
  liste(): BicimSapmasi[] {
    return [...this.kayitlar.values()].sort((a, b) => b.sayi - a.sayi);
  }
}

const metniAl = (dugum: BicimDugumu): string =>
  dugum.type === "text" ? dugum.text ?? "" : (dugum.content ?? []).map(metniAl).join("");

/**
 * Kılavuzdan sapan biçimleri toplar. Kural verilmemiş alan denetlenmez:
 * kılavuz yazı tipi söylemiyorsa sapma da yoktur.
 */
export function metinBiciminiDenetle(
  doc: { content?: BicimDugumu[] } | null | undefined,
  kural: MetinBicimKurali,
): MetinBicimRaporu | null {
  const { fontFamily, fontSizePt, lineSpacing } = kural;
  if (!fontFamily && !fontSizePt && !lineSpacing) return null;

  const yaziTipi = new Sayac();
  const punto = new Sayac();
  const satirAraligi = new Sayac();
  const beklenenAile = fontFamily ? aileAdi(fontFamily) : null;

  const gez = (dugum: BicimDugumu, paragrafMetni: string) => {
    const metin = dugum.type === "paragraph" || dugum.type === "heading" ? metniAl(dugum).trim() : paragrafMetni;

    if (lineSpacing && dugum.type === "paragraph" && metin) {
      const aralik = puntoDegeri(dugum.attrs?.lineSpacing);
      if (aralik !== null && !yakin(aralik, lineSpacing)) {
        satirAraligi.ekle(String(aralik).replace(".", ","), metin);
      }
    }

    if (dugum.type === "text" && (dugum.text ?? "").trim()) {
      const stil = dugum.marks?.find((mark) => mark.type === "textStyle")?.attrs ?? null;
      const ad = typeof stil?.fontFamily === "string" ? stil.fontFamily.trim() : "";
      if (beklenenAile && ad && aileAdi(ad) !== beklenenAile) {
        yaziTipi.ekle(ad.split(",")[0].trim().replace(/^["']|["']$/g, ""), metin || dugum.text || "");
      }
      const boyut = puntoDegeri(stil?.fontSize);
      if (fontSizePt && boyut !== null && !yakin(boyut, fontSizePt)) {
        punto.ekle(`${String(boyut).replace(".", ",")} pt`, metin || dugum.text || "");
      }
    }

    for (const cocuk of dugum.content ?? []) gez(cocuk, metin);
  };

  for (const dugum of doc?.content ?? []) gez(dugum, "");

  const rapor = { yaziTipi: yaziTipi.liste(), punto: punto.liste(), satirAraligi: satirAraligi.liste() };
  return rapor.yaziTipi.length || rapor.punto.length || rapor.satirAraligi.length ? rapor : null;
}
