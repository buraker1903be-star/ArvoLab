/*
  TEZ YAZIM KILAVUZUNUN (TYK) ATIF ÖRNEĞİ — "virgülüne kadar"
  (26.10.2026, kurum sahibinin geri bildirimi: "bazı danışmanlar
  atıfları virgülüne kadar önemsiyor").

  Stil adı (APA, Chicago) yetmiyor: aynı "APA" diyen iki kılavuzdan biri
  "(Yılmaz, 2020, s. 14)", öteki "(Yılmaz, 2020: 14)" istiyor. Kılavuzdan
  örneği otomatik çıkarmak yanlış örnek yakalayabilir (kılavuzlar yanlış
  kullanımı da örnekliyor); bu yüzden öğrenci ya da kurum örneği BİR KEZ
  yapıştırıyor, kalıp ondan okunuyor:

    yazar ile yıl arasında   virgül mü boşluk mu
    yıl ile sayfa arasında   ":" mi "," mi
    sayfa öneki              "s." mi yok mu
    iki yazar bağlacı        "ve" mi "&" mi
    çok yazar                "vd." mi "et al." mi

  Denetim yalnızca örnekte GÖRÜLEN kuralları uygular: örnekte sayfa yoksa
  sayfa biçimine karışılmaz — bilmediği kuralı uydurmak, doğru yazılmış
  atıfa hata demek olurdu.

  Saf modül; testi tests/unit/atif-tyk.test.ts.
*/

export type AtifKalibi = {
  ornek: string;
  /** Yazar ile yıl arasında: "," → "(Yılmaz, 2020)", " " → "(Yılmaz 2020)". */
  yazarYilAyraci: "," | " ";
  /** Yıl ile sayfa arasında; örnekte sayfa yoksa null (denetlenmez). */
  sayfaAyraci: ":" | "," | null;
  /** Sayfa öneki; örnekte sayfa yoksa null. */
  sayfaOneki: "s." | "" | null;
  ikiYazar: "ve" | "&" | "and" | null;
  cokYazar: "vd." | "et al." | null;
};

const YIL = /\b(1[5-9]\d{2}|20\d{2})[a-z]?\b|\bt\.y\.|\bn\.d\./;

/** Parantez içindeki tek bir atıfın parçaları; yıl yoksa null. */
function parcala(ic: string) {
  const yil = ic.match(YIL);
  if (!yil || yil.index === undefined) return null;
  const yazar = ic.slice(0, yil.index);
  const sonra = ic.slice(yil.index + yil[0].length);
  if (!/\p{Lu}/u.test(yazar)) return null;
  const sayfa = sonra.match(/^\s*([:,])\s*((?:ss?\.|pp?\.)\s*)?\d/);
  return {
    yazarYilAyraci: /,\s*$/.test(yazar) ? ("," as const) : (" " as const),
    sayfaAyraci: sayfa ? (sayfa[1] as ":" | ",") : null,
    sayfaOneki: sayfa ? (sayfa[2] ? ("s." as const) : ("" as const)) : null,
    ikiYazar: /\s&\s/.test(yazar) ? ("&" as const) : /\sve\s/.test(yazar) ? ("ve" as const) : /\sand\s/.test(yazar) ? ("and" as const) : null,
    cokYazar: /\bvd\./.test(yazar) ? ("vd." as const) : /\bet al\./.test(yazar) ? ("et al." as const) : null,
  };
}

/** Örnek atıftan kalıp; içinde parantezli, yıllı bir atıf yoksa null. */
export function ornekKalibi(ornek: string | null | undefined): AtifKalibi | null {
  const metin = (ornek ?? "").trim();
  if (!metin) return null;
  for (const grup of metin.matchAll(/\(([^()]{3,200})\)/g)) {
    const p = parcala(grup[1].split(";")[0].trim());
    if (p) return { ornek: metin, ...p };
  }
  return null;
}

/** Kalıbın öğrenciye okunur özeti (kılavuz penceresinde). */
export function kalipOzeti(k: AtifKalibi): string[] {
  const satirlar = [`Yazar ile yıl arasında ${k.yazarYilAyraci === "," ? "virgül" : "yalnızca boşluk"}`];
  if (k.sayfaAyraci) satirlar.push(`Yıl ile sayfa arasında "${k.sayfaAyraci}"${k.sayfaOneki ? `, sayfa önünde "${k.sayfaOneki}"` : ", sayfa öneki yok"}`);
  if (k.ikiYazar) satirlar.push(`İki yazar "${k.ikiYazar}" ile bağlanır`);
  if (k.cokYazar) satirlar.push(`Üç ve daha çok yazarda "${k.cokYazar}"`);
  return satirlar;
}

export type TykBulgusu = { tur: "yilsiz" | "kalip" | "yil_uyusmazligi"; atif: string; aciklama: string };

const EN_COK = 30;

/*
  Kalıba uymayan atıflar. Yalnızca örnekte görülen kurallar denetlenir;
  aynı atıf metni bir kez raporlanır.
*/
export function kalibaUymayanlar(govde: string, kalip: AtifKalibi): TykBulgusu[] {
  const bulgular: TykBulgusu[] = [];
  const gorulen = new Set<string>();
  for (const grup of govde.matchAll(/\(([^()]{3,300})\)/g)) {
    if (bulgular.length >= EN_COK) break;
    const nedenler = new Set<string>();
    for (const parca of grup[1].split(";")) {
      const p = parcala(parca.trim());
      if (!p) continue;
      if (p.yazarYilAyraci !== kalip.yazarYilAyraci)
        nedenler.add(kalip.yazarYilAyraci === "," ? "yazar ile yıl arasında virgül olmalı" : "yazar ile yıl arasında virgül olmamalı");
      if (kalip.sayfaAyraci && p.sayfaAyraci && p.sayfaAyraci !== kalip.sayfaAyraci)
        nedenler.add(`yıl ile sayfa arasında "${kalip.sayfaAyraci}" olmalı`);
      if (kalip.sayfaOneki !== null && p.sayfaOneki !== null && p.sayfaOneki !== kalip.sayfaOneki)
        nedenler.add(kalip.sayfaOneki ? `sayfa önünde "${kalip.sayfaOneki}" olmalı` : "sayfa önünde \"s.\" olmamalı");
      if (kalip.ikiYazar && p.ikiYazar && p.ikiYazar !== kalip.ikiYazar) nedenler.add(`iki yazar "${kalip.ikiYazar}" ile bağlanmalı`);
      if (kalip.cokYazar && p.cokYazar && p.cokYazar !== kalip.cokYazar) nedenler.add(`çok yazarda "${kalip.cokYazar}" kullanılmalı`);
    }
    if (!nedenler.size || gorulen.has(grup[0])) continue;
    gorulen.add(grup[0]);
    bulgular.push({ tur: "kalip", atif: grup[0], aciklama: `Kılavuz örneği ${kalip.ornek}: ${[...nedenler].join("; ")}.` });
  }
  return bulgular;
}

/*
  YILI OLMAYAN ATIFLAR: "(Yılmaz)", "(Yılmaz ve Demir)", "(Yılmaz vd.)".
  Yazar–tarih stillerinde yıl şart; editörün atıf penceresi artık hep yıl
  yazıyor ama elle yazılan ya da Word'den gelen atıflarda eksik kalıyor.

  Yanlış alarmı düşük tutmak için parantezin içi YALNIZCA ad olmalı:
  büyük harfle başlayan bir-üç kelime ve bağlaç. "(Tablo 3)", "(bkz.
  Ek A)", "(Türkiye İstatistik Kurumu verileri)" gibi ifadeler eşleşmez;
  ay ve mevsim adları ("(Haziran)") ayrıca dışarıda.
*/
const AD = "\\p{Lu}[\\p{L}'’-]+";
const YALNIZ_AD = new RegExp(`^${AD}(?:\\s+(?:ve|&|and)\\s+${AD}|\\s+(?:vd\\.|et al\\.)|,\\s*${AD}(?:,?\\s*(?:ve|&)\\s*${AD})?)?$`, "u");
const AD_DEGIL = new Set([
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık",
  "bahar", "yaz", "güz", "kış", "ek", "tablo", "şekil", "not", "örnek", "bkz", "türkiye", "abd", "ab", "oecd", "tüik",
]);

export function yilsizAtiflar(govde: string): TykBulgusu[] {
  const bulgular: TykBulgusu[] = [];
  const gorulen = new Set<string>();
  for (const grup of govde.matchAll(/\(([^()\d]{3,80})\)/g)) {
    if (bulgular.length >= EN_COK) break;
    const ic = grup[1].trim();
    if (!YALNIZ_AD.test(ic)) continue;
    if (AD_DEGIL.has(ic.split(/[\s,]/)[0].toLocaleLowerCase("tr-TR").replace(/\.$/, ""))) continue;
    if (gorulen.has(grup[0])) continue;
    gorulen.add(grup[0]);
    bulgular.push({ tur: "yilsiz", atif: grup[0], aciklama: "Atıfta yıl yok; yazar–tarih atıfında yıl şart." });
  }
  return bulgular;
}

/*
  Atıfı kalıba göre yazar (editörün atıf penceresi): örnek girilmişse
  eklenen atıf onun noktalamasıyla yazılır, öğrenci sonradan düzeltmez.
*/
export function kalibaGoreAtif(yazar: string, yil: string, sayfa: string | null, kalip: AtifKalibi): string {
  // Öğrenci "s. 14" yazmış olabilir; önek kalıptan gelir, ikinci kez yazılmaz.
  sayfa = sayfa?.replace(/^(?:ss?|pp?)\.\s*/i, "").trim() || null;
  let yazarMetni = yazar;
  if (kalip.ikiYazar) yazarMetni = yazarMetni.replace(/\s(?:ve|&|and)\s/, ` ${kalip.ikiYazar} `);
  if (kalip.cokYazar) yazarMetni = yazarMetni.replace(/\b(?:vd\.|et al\.)/, kalip.cokYazar);
  const ayrac = kalip.yazarYilAyraci === "," ? ", " : " ";
  const sayfaMetni = sayfa
    ? `${kalip.sayfaAyraci === ":" ? ": " : ", "}${kalip.sayfaOneki === "" ? "" : `${/[-–]/.test(sayfa) && kalip.sayfaOneki === "s." ? "ss." : "s."} `}${sayfa}`
    : "";
  return `(${yazarMetni}${ayrac}${yil}${sayfaMetni})`;
}
