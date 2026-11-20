/*
  DİZİN METNİNDEKİ HTML VARLIKLARI (20.11.2026).

  Crossref ve OpenAlex başlık, dergi ve yazar adlarını çoğu zaman HTML
  kaçışlı veriyor ("Journal of Science &amp; Society", kimi zaman iki kez:
  "&amp;amp;"). Arama sonuçları bunu çözmeden kaydediyordu; kaynakçada ve
  Kaynaklar listesinde "&amp;" görünüyordu. DOI yolundaki temizleyici
  (lib/doi.ts) yalnızca &amp; &lt; &gt;'yi ve tek kez çözüyordu.

  Tek yardımcı: içe aktarmada (arama, DOI) VE gösterimde (önceden "&amp;"
  ile kaydedilmiş kayıtlar) aynı işlev çalışır. Veritabanındaki eski
  kayıtlar topluca dönüştürülmez; ekranda doğru görünür, kullanıcı kaydı
  düzenlediğinde temiz hâli yazılır.

  Etiketler (Crossref'in <i>, <sub>, <scp> işaretlemesi) atılır; ama
  yalnızca etikete BENZEYENLER: "a < b" ya da "p<0,05" içeren başlık
  bozulmamalı.
*/

const ADLI: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

const VARLIK = /&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi;
const ETIKET = /<\/?[a-z][a-z0-9:-]*(?:\s[^<>]*)?\/?>/gi;

function birTur(metin: string): string {
  return metin.replace(VARLIK, (tum, govde: string) => {
    if (govde[0] === "#") {
      const kod = govde[1]?.toLowerCase() === "x" ? parseInt(govde.slice(2), 16) : parseInt(govde.slice(1), 10);
      // Geçersiz ya da denetim karakteri olan kod olduğu gibi kalır (uydurulmaz).
      return Number.isFinite(kod) && kod >= 32 && kod <= 0x10ffff ? String.fromCodePoint(kod) : tum;
    }
    return ADLI[govde.toLowerCase()] ?? tum;
  });
}

/** HTML varlıklarını (çift kodlanmış dahil) çözer, etiketleri atar, boşlukları sadeleştirir. */
export function htmlVarliklariniCoz(deger: string | null | undefined): string {
  let metin = String(deger ?? "");
  // "&amp;amp;" → "&amp;" → "&": en çok üç tur; daha derin kodlama gerçek veride görülmedi.
  for (let tur = 0; tur < 3 && VARLIK.test(metin); tur++) {
    VARLIK.lastIndex = 0;
    metin = birTur(metin);
  }
  VARLIK.lastIndex = 0;
  return metin.replace(ETIKET, "").replace(/\s+/g, " ").trim();
}
