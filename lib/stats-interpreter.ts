/**
 * SPSS Çıktısı → APA 7 Biçimlendirme Yardımcısı
 * ------------------------------------------------------------
 * Kullanıcının SPSS'ten kopyaladığı, ZATEN HESAPLANMIŞ istatistik
 * değerlerini (t, F, r, χ², p vb.) tanır ve APA 7 raporlama
 * biçimine çevirir. Yeni bir analiz YAPMAZ, yorum/sonuç ÜRETMEZ;
 * yalnızca sayısal değerleri standart akademik biçime dönüştürür
 * ve anlamlılık eşiğini (p < .05) mekanik olarak işaretler.
 *
 * Dört ağır hata düzeltildi (testi tests/unit/stats-interpreter.test.ts):
 *
 * 1. "p < .05" GİRDİSİ "p = .050 (istatistiksel olarak anlamlı değil)"
 *    olarak çıkıyordu. Karşılaştırma işareti atılıp sayı eşitlik sanılıyordu;
 *    öğrencinin ANLAMLI bulgusu anlamsıza çevriliyordu. Türkçe tezlerde
 *    anlamlılığın en yaygın yazımı budur.
 * 2. Modülün kendi yorumunda desteklendiği yazan "t = 2.45, df = 28"
 *    biçimi hiç tanınmıyordu; kullanıcı sessizce boş sonuç alıyordu.
 * 3. Harf sınırı yoktu: "Ortalama değer = .42, p = .003" cümlesindeki
 *    "değer" sözcüğünün son harfi korelasyon sanılıyor ve GİRDİDE OLMAYAN
 *    bir istatistik üretiliyordu (AGENTS.md: üretilen her sayı girdide
 *    geçmek zorunda).
 * 4. r sıfırla yazılıyordu ("r = 0.42"). APA'da ±1 ile sınırlı değerler
 *    baştaki sıfır olmadan yazılır.
 */

export interface DetectedStatistic {
  raw: string;
  type: "t-test" | "anova" | "correlation" | "chi-square" | "regression" | "unknown";
  apaSentenceFragment: string;
  /**
   * true = anlamlı, false = anlamlı değil.
   * null = BU İFADEDEN BELİRLENEMEZ. "p < .10" gibi bir sınır anlamlılığı
   * ne kanıtlar ne çürütür; "anlamlı değil" demek olmayan bir bilgiyi
   * uydurmak olurdu.
   */
  significant: boolean | null;
}

/**
 * p değerinin yazılışı: eşitlik mi, üst sınır mı.
 *
 * `ham` kullanıcının YAZDIĞI rakamları taşır. Yalnızca sayıya çevirmek
 * sondaki sıfırı yutuyordu: "p < .10" → "p < .1", "p < .050" → "p < .05".
 * APA'da p en az iki ondalıkla yazılır ve zaten bu modülün kendi kuralı
 * yazılanı korumak.
 */
type PDegeri = { islec: "=" | "<"; deger: number; ham: string };

const sayi = (ham: string): number => parseFloat(ham.replace(",", "."));

/** APA: ±1 ile sınırlı değerlerde (p, r) baştaki sıfır yazılmaz. */
const sifirsiz = (metin: string) => metin.replace(/^(-?)0\./, "$1.");

/*
  Yazılan p ifadesi KORUNUR. "p < .05" yazan kullanıcıya "p = .050"
  döndürmek, kaynağında olmayan bir kesinlik uydurmaktır.
*/
function apaP({ islec, deger, ham }: PDegeri): string {
  // Üst sınırda yazılan rakamlar korunur; yalnızca APA'nın baştaki sıfır
  // kuralı uygulanır ("0.05" → ".05", ama ".050" olduğu gibi kalır).
  if (islec === "<") return `p < ${sifirsiz(ham.replace(",", "."))}`;
  if (deger < 0.001) return "p < .001";
  return `p = ${sifirsiz(deger.toFixed(3))}`;
}

/*
  "p < X" bir ÜST SINIR: X 0.05'ten küçük ya da eşitse p kesinlikle
  eşiğin altındadır (anlamlı). X daha büyükse p değeri 0.05'in altında da
  üstünde de olabilir — cevap "bilmiyorum".
*/
/*
  Yalnızca işleç ve değer yeter; `ham` (yazılan rakamlar) burada
  kullanılmıyor. İmza daraltıldı ki `ham` PDegeri'nde ZORUNLU kalabilsin:
  isteğe bağlı olsaydı yeni bir çözümleyici onu sessizce atlayabilirdi ve
  sondaki sıfır yine kaybolurdu.
*/
export function anlamlilik({ islec, deger }: Pick<PDegeri, "islec" | "deger">): boolean | null {
  if (islec === "<") return deger <= 0.05 ? true : null;
  return deger < 0.05;
}

const anlamlilikNotu = (sonuc: boolean | null) =>
  sonuc === true ? "" : sonuc === false ? " (istatistiksel olarak anlamlı değil)" : " (anlamlılık bu ifadeden belirlenemiyor)";

/*
  Harf sınırı: istatistik harfinden önce başka bir harf gelmemeli. Yoksa
  Türkçede "r" ile biten her sözcük ("değer", "faktör") korelasyon
  sanılıyordu.
*/
const HARF_ONCESI_YOK = "(?<![\\p{L}\\p{N}])";
const P_PARCASI = "p\\s*([=<])\\s*([.,]?\\d+[.,]?\\d*)";

// t(28) = 2.45, p = .021   |   t = 2.45, df = 28, p = .021
const T_TEST_RE = new RegExp(
  `${HARF_ONCESI_YOK}t\\s*(?:\\(\\s*(\\d+(?:[.,]\\d+)?)\\s*\\)\\s*=\\s*(-?\\d+[.,]\\d+)` +
    `|=\\s*(-?\\d+[.,]\\d+)[,;]?\\s*df\\s*=\\s*(\\d+(?:[.,]\\d+)?))[,;]?\\s*${P_PARCASI}`,
  "giu",
);

const ANOVA_RE = new RegExp(
  `${HARF_ONCESI_YOK}F\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)\\s*=\\s*(\\d+[.,]\\d+)[,;]?\\s*${P_PARCASI}`,
  "giu",
);

const CORRELATION_RE = new RegExp(
  `${HARF_ONCESI_YOK}r\\s*\\(?\\s*(\\d*)\\s*\\)?\\s*=\\s*(-?[.,]\\d+)[,;]?\\s*${P_PARCASI}`,
  "giu",
);

const CHI_SQUARE_RE = new RegExp(
  `${HARF_ONCESI_YOK}(?:χ2|χ²|chi-square)\\s*\\(\\s*(\\d+)\\s*(?:,\\s*N\\s*=\\s*(\\d+))?\\s*\\)\\s*=\\s*(\\d+[.,]\\d+)[,;]?\\s*${P_PARCASI}`,
  "giu",
);

type Cozumleyici = {
  desen: RegExp;
  tur: DetectedStatistic["type"];
  /** Eşleşmeden APA gövdesini ve p değerini üretir. */
  oku: (m: RegExpExecArray) => { govde: string; p: PDegeri };
};

const COZUMLEYICILER: Cozumleyici[] = [
  {
    desen: T_TEST_RE,
    tur: "t-test",
    oku: (m) => {
      // İki yazım: t(df) = değer  ya da  t = değer, df = ...
      const df = m[1] ?? m[4];
      const t = sayi(m[2] ?? m[3]);
      return { govde: `t(${df}) = ${t.toFixed(2)}`, p: { islec: m[5] as "=" | "<", deger: sayi(m[6]), ham: m[6] } };
    },
  },
  {
    desen: ANOVA_RE,
    tur: "anova",
    oku: (m) => ({
      govde: `F(${m[1]}, ${m[2]}) = ${sayi(m[3]).toFixed(2)}`,
      p: { islec: m[4] as "=" | "<", deger: sayi(m[5]), ham: m[5] },
    }),
  },
  {
    desen: CORRELATION_RE,
    tur: "correlation",
    oku: (m) => ({
      govde: `r${m[1] ? `(${m[1]})` : ""} = ${sifirsiz(sayi(m[2]).toFixed(2))}`,
      p: { islec: m[3] as "=" | "<", deger: sayi(m[4]), ham: m[4] },
    }),
  },
  {
    desen: CHI_SQUARE_RE,
    tur: "chi-square",
    oku: (m) => ({
      govde: `χ²(${m[1]}${m[2] ? `, N = ${m[2]}` : ""}) = ${sayi(m[3]).toFixed(2)}`,
      p: { islec: m[4] as "=" | "<", deger: sayi(m[5]), ham: m[5] },
    }),
  },
];

export function detectStatistics(rawText: string): DetectedStatistic[] {
  const bulunanlar: (DetectedStatistic & { konum: number })[] = [];

  for (const { desen, tur, oku } of COZUMLEYICILER) {
    const re = new RegExp(desen.source, desen.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const { govde, p } = oku(m);
      const sonuc = anlamlilik(p);
      bulunanlar.push({
        konum: m.index,
        raw: m[0],
        type: tur,
        significant: sonuc,
        apaSentenceFragment: `${govde}, ${apaP(p)}${anlamlilikNotu(sonuc)}`,
      });
    }
  }

  /* Metindeki sırasına göre: eskiden türe göre kümeleniyordu ve kullanıcı
     yapıştırdığı sırayı listede bulamıyordu. */
  return bulunanlar
    .sort((a, b) => a.konum - b.konum)
    .map((kayit) => ({
      raw: kayit.raw,
      type: kayit.type,
      apaSentenceFragment: kayit.apaSentenceFragment,
      significant: kayit.significant,
    }));
}
