/*
  Kaydedilmiş müsveddeyi (TipTap JSON) bölümlere ayırır.

  Makale çalışma alanı bölüm uzunluklarını, şablondaki bölümlerin metinde
  olup olmadığını ve asistanın hangi bölümü denetleyeceğini buradan
  okur. Bölüm sınırı EN ÜST düzey başlıktır: "2.1 Örneklem" yöntemin
  parçasıdır, ayrı bir bölüm değil. Tezin adı gibi kapsayıcı bir üst
  başlık bölüm sayılmaz (aşağıda, duzle). Belgede başlık yoksa tek bir
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

type Dal = { baslik: string; duzey: number; satirlar: string[]; cocuklar: Dal[] };

/** Bölümün kendi metni ve alt başlıklarıyla birlikte bütün metni. */
const tumSatirlar = (dal: Dal): string[] => [...dal.satirlar, ...dal.cocuklar.flatMap((c) => [c.baslik, ...tumSatirlar(c)])];

/*
  BELGE BAŞLIĞI BÖLÜM DEĞİLDİR (26.10.2026). Öğrenciler tezin adını
  çoğu zaman en üst düzey başlık yapıp bölümleri onun altına yazıyor.
  Eskiden en üst düzey her başlık bir bölüm sayılıyordu: ana sayfada
  "Bölümlerim"in ilk satırı tezin adıydı ve bütün metni o topluyordu
  (2.531 kelime), gerçek bölümler görünmüyordu.

  Kural: tanınan bir bölüm adı OLMAYAN (lib/makale/sablonlar.ts,
  bolumTuru), altında alt başlıklar bulunan ve kendi metni kısa olan bir
  üst başlık bir kapsayıcıdır — yerine çocukları bölüm olarak listelenir.
  "BİRİNCİ BÖLÜM: GİRİŞ" gibi tanınan bir başlık bölüm olarak kalır.
  Bedeli: tanınmayan adla yazılmış bir bölüm (ör. "Türkiye
  Ekonomisinde Enflasyon") alt başlıklarıyla listelenir; kelime
  sayıları yine doğru, yalnızca daha ayrıntılı.
*/
const KAPSAYICI_EN_COK_SOZCUK = 60;

function duzle(dal: Dal): Dal[] {
  if (dal.baslik && dal.cocuklar.length && !bolumTuru(dal.baslik) && sozcukSayisi(dal.satirlar.join(" ")) <= KAPSAYICI_EN_COK_SOZCUK)
    return dal.cocuklar;
  return [dal];
}

export function makaleBolumleri(icerik: unknown): MakaleBolumu[] {
  const kok = (icerik ?? null) as { content?: Dugum[] } | null;
  const dugumler = duzlestir(kok?.content);

  // Başlıklardan ağaç: her başlık kendinden derin olanları kapsar.
  const kokler: Dal[] = [];
  const yigin: Dal[] = [];
  let baslikOncesi: Dal | null = null;
  for (const dugum of dugumler) {
    const metin = metniOf(dugum).trim();
    if (dugum.type === "heading") {
      const duzey = Number(dugum.attrs?.level ?? 1) || 1;
      const dal: Dal = { baslik: metin || "Adsız bölüm", duzey, satirlar: [], cocuklar: [] };
      while (yigin.length && yigin[yigin.length - 1].duzey >= duzey) yigin.pop();
      (yigin.length ? yigin[yigin.length - 1].cocuklar : kokler).push(dal);
      yigin.push(dal);
      continue;
    }
    if (!metin) continue;
    if (yigin.length) yigin[yigin.length - 1].satirlar.push(metin);
    else {
      if (!baslikOncesi) {
        baslikOncesi = { baslik: "", duzey: 0, satirlar: [], cocuklar: [] };
        kokler.unshift(baslikOncesi);
      }
      baslikOncesi.satirlar.push(metin);
    }
  }

  return kokler.flatMap(duzle).map((dal) => {
    const metin = tumSatirlar(dal).join("\n");
    return { baslik: dal.baslik, tur: dal.baslik ? bolumTuru(dal.baslik) : null, metin, sozcuk: sozcukSayisi(metin) };
  });
}

/** Ana metnin sözcük sayısı: kaynakça ve özet hariç (dergilerin çoğu böyle sayar). */
export function anaMetinSozcukSayisi(bolumler: MakaleBolumu[]): number {
  return bolumler
    .filter((b) => b.tur !== "kaynakca" && b.tur !== "ozet")
    .reduce((toplam, b) => toplam + b.sozcuk + sozcukSayisi(b.baslik), 0);
}
