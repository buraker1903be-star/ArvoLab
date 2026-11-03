import type { Metin } from "@/lib/dil";
import { aralikta, belgeBolumleri, type Dugum } from "@/lib/kaynakca-bolumu";

/*
  YAZARKEN EŞLİK EDEN İPUÇLARI (03.11.2026, Jenni AI'daki anlık geri
  bildirimin karşılığı). Editörde imlecin durduğu paragraf yazılırken
  okunur ve akademik metnin en sık dört kusuru gösterilir:

    - atıfsız iddia: "çalışmalar göstermektedir", "literatürde…" diyen
      ama aynı cümlede atıf taşımayan cümle. Jüri ve danışmanın ilk
      sorduğu şey "kim göstermiş?".
    - aşırı kesin dil: "kanıtlamaktadır", "kesinlikle", "proves". Tek bir
      çalışma bir şeyi kanıtlamaz; "göstermektedir/desteklemektedir".
    - kişisel görüş kalıbı: "bence", "düşünüyorum", "I think".
    - çok uzun cümle (45 sözcükten fazla) ve paragraf (220'den fazla).

  NEDEN KURAL, NEDEN YAPAY ZEKÂ DEĞİL: her tuşta çalışıyor; modele
  gitseydi her paragraf bir çağrı, saniyeler süren gecikme ve kurumun
  kredisi demekti. Kurallar anlık, ücretsiz ve aynı metne hep aynı
  cevabı veriyor. Bedeli: anlamı bilmiyor — "araştırma sorusuyla bağ"
  gibi bir yargıyı buradan veremiyoruz, vermeye de çalışmıyoruz.

  YANLIŞ ALARMA KARŞI dar tutuldu: ipucu bir uyarıdır, hata değil, ve
  her paragrafta çıkan bir uyarıyı öğrenci okumayı bırakır. İddia
  kalıpları yalnızca LİTERATÜRE gönderme yapanlar ("çalışmalar",
  "araştırmalar", "literatür", "studies"); "bulunmuştur" gibi öğrencinin
  KENDİ bulgusunu da anlatabilen fiiller tek başına sayılmaz.

  Saf modül; testi tests/unit/yazim-ipuclari.test.ts.
*/

export type IpucuTuru = "atifsiz-iddia" | "kesin-dil" | "kisisel-gorus" | "uzun-cumle" | "uzun-paragraf";

export type Ipucu = {
  tur: IpucuTuru;
  mesaj: Metin;
  /** Paragraftaki ilgili parça (editörde seçip göstermek için); paragrafın tamamıysa yok. */
  parca?: string;
};

/** Dipnot düğümünün düz metindeki yer tutucusu (çağıran koyar). */
export const DIPNOT_IZI = "";

export const UZUN_CUMLE = 45;
export const UZUN_PARAGRAF = 220;

/*
  Atıf izi: yazar-tarih ("(Yılmaz, 2020)", "Yılmaz (2020)", "(Smith 2020,
  p. 5)"), numara ("[3]", "[1–4]", "(3)"), üst simge ("…bulunmuştur.¹")
  ya da dipnot. Yıl yalnızca PARANTEZ içinde sayılıyor: "2008 krizinde"
  bir atıf değil.
*/
const ATIF_IZI = new RegExp(
  [
    String.raw`\([^()]*?(?:1[6-9]|20)\d{2}[a-z]?(?:[,:;][^()]*)?\)`,
    String.raw`\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*(?:[,\s][^\]]{0,24})?\]`,
    String.raw`\(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\)`,
    "[⁰¹²³⁴⁵⁶⁷⁸⁹]",
    DIPNOT_IZI,
  ].join("|"),
  "u",
);

/*
  Literatüre gönderme kalıpları. Türkçede ek yığılması yüzünden kök
  aranıyor ("çalışmalarda", "araştırmaların"); İngilizcede yalnızca
  çoğul ve "the literature". Tek bir "çalışmada" (öğrencinin kendisi:
  "bu çalışmada") sayılmaz — çoğul ya da "yapılan/önceki/birçok" ister.
*/
const IDDIA = new RegExp(
  [
    String.raw`(?:yapılan|önceki|birçok|pek çok|bazı|son|ilgili|farklı|çeşitli)\s+(?:çalışma|araştırma|inceleme)`,
    String.raw`(?:çalışmalar|araştırmalar|incelemeler)(?:da|de|ın|in|ı|i|a|e)?\s+(?:göster|ortaya|belirt|bul|işaret|vurgula|ifade|tespit|saptan|kanıtla|desteklen)`,
    String.raw`(?:literatür|alanyazın|yazın)(?:de|da|e|a|ın|in)?\s`,
    String.raw`(?:uzmanlar|araştırmacılar|yazarlar)(?:a göre|ca)?\s`,
    String.raw`(?:studies|researchers|scholars|authors|the literature|previous research|prior research|research)\s+(?:have\s+|has\s+)?(?:show|shown|found|suggest|report|indicate|argue|demonstrate)`,
    String.raw`it\s+(?:has|have)\s+been\s+(?:shown|found|reported|argued|suggested|demonstrated)`,
    String.raw`(?:in|according to)\s+the\s+literature`,
  ].join("|"),
  "iu",
);

const KESIN = /(?<![\p{L}])(?:kanıtla(?:maktadır|mıştır|madır|nmıştır|r)|kesinlikle|şüphesiz(?:dir)?|tartışmasız(?:dır)?|su götürmez|proves?|proven|undoubtedly|unquestionabl[ey]|clearly\s+(?:shows?|proves?|demonstrates?))(?![\p{L}])/iu;

const GORUS = /(?<![\p{L}])(?:bence|bana göre|düşünüyorum|inanıyorum|kanaatimce|I\s+(?:think|believe|feel)|in\s+my\s+(?:opinion|view))(?![\p{L}])/iu;

/*
  Cümle bölme: nokta/soru/ünlem + boşluk + büyük harf ya da rakam. Kısaltma
  noktaları ("vd.", "s.", "örn.", "et al.", "Dr.") cümle bitirmez; baş
  harf ("A. Yılmaz") da öyle.
*/
const KISALTMA = /(?:^|[\s(\[])(?:vd|vb|örn|bkz|s|ss|p|pp|Dr|Prof|Doç|yy|et al|e\.g|i\.e|cf|vs|no|Fig|Tab|\p{Lu})\.$/u;
export function cumleler(metin: string): string[] {
  const sonuc: string[] = [];
  let bas = 0;
  for (const m of metin.matchAll(/[.!?…]+[”"’)]*(?=\s+[\p{Lu}\d“"(])/gu)) {
    const son = (m.index ?? 0) + m[0].length;
    const aday = metin.slice(bas, son);
    if (KISALTMA.test(aday.trimEnd())) continue;
    sonuc.push(aday.trim());
    bas = son;
  }
  const kalan = metin.slice(bas).trim();
  if (kalan) sonuc.push(kalan);
  return sonuc.filter(Boolean);
}

const sozcukSayisi = (metin: string) => metin.split(/\s+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
const kisalt = (metin: string, uzunluk = 80) => (metin.length > uzunluk ? `${metin.slice(0, uzunluk - 1)}…` : metin);

/**
 * Bir paragrafın ipuçları. `metin` paragrafın düz metni; dipnot düğümleri
 * DIPNOT_IZI ile işaretlenmiş olmalı (yoksa dipnotlu atıf görülmez ve
 * dipnot stilindeki her iddia "atıfsız" çıkar).
 */
export function paragrafIpuclari(metin: string): Ipucu[] {
  const temiz = metin.replace(/\s+/g, " ").trim();
  if (sozcukSayisi(temiz) < 6) return [];
  const ipuclari: Ipucu[] = [];
  for (const cumle of cumleler(temiz)) {
    const iddia = IDDIA.exec(cumle);
    if (iddia && !ATIF_IZI.test(cumle)) {
      ipuclari.push({
        tur: "atifsiz-iddia",
        parca: cumle.replace(DIPNOT_IZI, ""),
        mesaj: {
          tr: `"${kisalt(iddia[0].trim(), 40)}" literatüre gönderme yapıyor ama cümlede atıf yok. Hangi çalışma? Kaynağı ekleyin ya da ifadeyi kendi bulgunuz olarak yazın.`,
          en: `"${kisalt(iddia[0].trim(), 40)}" refers to the literature but the sentence has no citation. Which study? Add the source or phrase it as your own finding.`,
        },
      });
    }
    const kesin = KESIN.exec(cumle);
    if (kesin) {
      ipuclari.push({
        tur: "kesin-dil",
        parca: kesin[0],
        mesaj: {
          tr: `"${kesin[0]}" aşırı kesin. Tek bir çalışma ya da analiz bir şeyi kanıtlamaz; "göstermektedir", "desteklemektedir" gibi ölçülü bir fiil seçin.`,
          en: `"${kesin[0]}" is too strong. A single study or analysis doesn't prove something; choose a measured verb such as "shows" or "supports".`,
        },
      });
    }
    const gorus = GORUS.exec(cumle);
    if (gorus) {
      ipuclari.push({
        tur: "kisisel-gorus",
        parca: gorus[0],
        mesaj: {
          tr: `"${gorus[0]}" kişisel görüş kalıbı. Akademik metinde yargıyı veriye ya da kaynağa dayandırın ("bulgular … işaret etmektedir").`,
          en: `"${gorus[0]}" signals personal opinion. In academic writing, ground the claim in data or a source ("the findings indicate …").`,
        },
      });
    }
    const n = sozcukSayisi(cumle);
    if (n > UZUN_CUMLE) {
      ipuclari.push({
        tur: "uzun-cumle",
        parca: cumle.replace(DIPNOT_IZI, ""),
        mesaj: {
          tr: `Bu cümle ${n} sözcük. Okur ${UZUN_CUMLE} sözcüğü aşan cümlede özneyi kaybeder; iki cümleye bölmeyi deneyin.`,
          en: `This sentence is ${n} words. Readers lose the subject in sentences over ${UZUN_CUMLE} words; try splitting it in two.`,
        },
      });
    }
  }
  const toplam = sozcukSayisi(temiz);
  if (toplam > UZUN_PARAGRAF) {
    ipuclari.push({
      tur: "uzun-paragraf",
      mesaj: {
        tr: `Paragraf ${toplam} sözcük. Bir paragraf tek bir fikri işler; ${UZUN_PARAGRAF} sözcüğü aşıyorsa büyük olasılıkla iki fikir taşıyor.`,
        en: `This paragraph is ${toplam} words. A paragraph develops one idea; past ${UZUN_PARAGRAF} words it most likely carries two.`,
      },
    });
  }
  return ipuclari;
}

/** Paragrafın düz metni; dipnot düğümü DIPNOT_IZI olur. */
export function paragrafMetni(d: Dugum): string {
  if (d.type === "text") return d.text ?? "";
  if (d.type === "footnoteReference") return DIPNOT_IZI;
  if (d.type === "hardBreak") return " ";
  return (d.content ?? []).map(paragrafMetni).join("");
}

export type BelgeIpucu = Ipucu & { paragraf: number; paragrafBasi: string };

/**
 * Belgenin gövde paragraflarının ipuçları. Kaynakça ve liste bölümleri
 * (İçindekiler, Kısaltmalar…) dışarıda: künye "Studies have shown…"
 * başlıklı bir makale olabilir ve atıf taşımaz — orada uyarı anlamsız.
 * Yalnızca belgenin üst düzey paragrafları okunur; tablo hücresi ve
 * liste maddesi kısa ve biçimce farklı, iddia kuralı orada gürültü üretir.
 */
export function belgeIpuclari(bloklar: Dugum[]): BelgeIpucu[] {
  const { kaynakca, listeler } = belgeBolumleri(bloklar);
  const disarida = (i: number) => aralikta(kaynakca, i) || listeler.some((a) => i === a.bas || aralikta(a, i));
  const sonuc: BelgeIpucu[] = [];
  bloklar.forEach((blok, i) => {
    if (blok.type !== "paragraph" || disarida(i)) return;
    const metin = paragrafMetni(blok);
    for (const ipucu of paragrafIpuclari(metin)) {
      sonuc.push({ ...ipucu, paragraf: i, paragrafBasi: kisalt(metin.replace(DIPNOT_IZI, "").trim(), 60) });
    }
  });
  return sonuc;
}
