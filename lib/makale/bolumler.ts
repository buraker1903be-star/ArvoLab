/*
  Kaydedilmiş müsveddeyi (TipTap JSON) bölümlere ayırır.

  Makale çalışma alanı bölüm uzunluklarını, şablondaki bölümlerin metinde
  olup olmadığını ve asistanın hangi bölümü denetleyeceğini buradan
  okur. Bölüm sınırı EN ÜST düzey başlıktır: "2.1 Örneklem" yöntemin
  parçasıdır, ayrı bir bölüm değil. Belgede başlık yoksa tek bir
  "başlıksız" bölüm döner — müsveddenin henüz yapılandırılmadığını
  göstermenin dürüst yolu.

  Saf modül; testi tests/unit/makale-bolumler.test.ts.
*/

import { bolumTuru, type BolumTuru } from "./sablonlar";

type Dugum = { type?: string; text?: string; attrs?: Record<string, unknown> | null; content?: Dugum[] };

export type MakaleBolumu = {
  baslik: string;
  tur: BolumTuru | null;
  metin: string;
  sozcuk: number;
};

const metniOf = (dugum: Dugum): string => dugum.text ?? (dugum.content ?? []).map(metniOf).join(dugum.type === "table" || dugum.type === "tableRow" ? " " : "");

/*
  Sözcük sayımı: harf/rakam dizileri, kesme ve tire ile birleşik olanlar
  tek sözcük ("COVID-19", "Türkiye'de"). Editördeki sayaçla birebir
  aynı olmak zorunda değil; dergiler de farklı sayıyor. Ekranda bu
  yüzden "yaklaşık" yazıyor ve derginin sayma kuralına bakılması
  hatırlatılıyor.
*/
export function sozcukSayisi(metin: string): number {
  return (metin.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function duzlestir(dugumler: Dugum[] | undefined, cikti: Dugum[] = []): Dugum[] {
  for (const dugum of dugumler ?? []) {
    if (dugum.type === "heading" || dugum.type === "paragraph" || dugum.type === "table" || dugum.type === "codeBlock") cikti.push(dugum);
    else if (dugum.content) duzlestir(dugum.content, cikti);
  }
  return cikti;
}

export function makaleBolumleri(icerik: unknown): MakaleBolumu[] {
  const kok = (icerik ?? null) as { content?: Dugum[] } | null;
  const dugumler = duzlestir(kok?.content);
  const duzeyler = dugumler
    .filter((d) => d.type === "heading")
    .map((d) => Number(d.attrs?.level ?? 1))
    .filter((d) => Number.isFinite(d));
  const ustDuzey = duzeyler.length ? Math.min(...duzeyler) : null;

  const bolumler: { baslik: string; satirlar: string[] }[] = [];
  let aktif: { baslik: string; satirlar: string[] } | null = null;

  for (const dugum of dugumler) {
    const metin = metniOf(dugum).trim();
    if (dugum.type === "heading" && Number(dugum.attrs?.level ?? 1) === ustDuzey) {
      aktif = { baslik: metin || "Adsız bölüm", satirlar: [] };
      bolumler.push(aktif);
      continue;
    }
    if (!metin) continue;
    if (!aktif) {
      aktif = { baslik: "", satirlar: [] };
      bolumler.push(aktif);
    }
    aktif.satirlar.push(metin);
  }

  return bolumler.map(({ baslik, satirlar }) => {
    const metin = satirlar.join("\n");
    return { baslik, tur: baslik ? bolumTuru(baslik) : null, metin, sozcuk: sozcukSayisi(metin) };
  });
}

/** Ana metnin sözcük sayısı: kaynakça ve özet hariç (dergilerin çoğu böyle sayar). */
export function anaMetinSozcukSayisi(bolumler: MakaleBolumu[]): number {
  return bolumler
    .filter((b) => b.tur !== "kaynakca" && b.tur !== "ozet")
    .reduce((toplam, b) => toplam + b.sozcuk + sozcukSayisi(b.baslik), 0);
}
