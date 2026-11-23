/*
  OLASI STİL (23.11.2026): kaynakçanın ve metnin BİÇİMİNDEN stil tahmini.

  Neden öneri, seçim değil: stili yanlış bilmek denetimin tamamını
  anlamsızlaştırıyor. Vancouver yazılmış bir kaynakçayı APA sanan denetim
  doğru yazılmış her künyeye biçim hatası basar; tersi de olur, numara
  stilinde atıf–künye eşleşmesi hiç aranmadığı için denetim "temiz"
  görünür. Öğrenci hangi stili seçtiğini çoğu zaman biliyor ama PDF
  yüklerken ya da danışmanın gönderdiği metni denetlerken bilmiyor.

  Bu yüzden modül KARAR VERMEZ: uyan stilleri gerekçesiyle sıralar, son
  seçim kullanıcınındır. Tek aday varken de seçim onun: bir biçim
  işaretinin iki stilde de bulunabildiği durumlar var (Chicago'nun
  Notlar–Kaynakça kaynakçası ile klasik dipnot kaynakçası gözle bile
  ayrılmıyor) ve "kesin" demek, olmayan bir kesinliği ürüne yazmak olurdu.

  Kanıt yoksa öneri HİÇ verilmez (`yeterliKanit: false`). Zayıf bir
  tahmini öneri diye göstermek, kullanıcıyı yanlış stile ikna etmenin en
  kolay yolu — yanlış alarm kaçırılan tahminden sinsidir (AGENTS.md).

  Saf modül; testi tests/unit/atif-olasi-stil.test.ts.
*/

import type { Metin } from "@/lib/dil";
import type { StilKimligi } from "./stiller";

export type StilAdayi = {
  stil: StilKimligi;
  /** Toplam kanıt ağırlığı; sıralama bununla. */
  puan: number;
  /** Kullanıcıya gösterilen gerekçeler: hangi işaret kaç yerde görüldü. */
  gerekce: Metin[];
};

export type OlasiStilSonucu = {
  /** Kanıt yoksa öneri gösterilmez. */
  yeterliKanit: boolean;
  adaylar: StilAdayi[];
  /** Kaç künye incelendi — gerekçenin ölçeği. */
  incelenenKunye: number;
};

/** En az bu kadar künye olmadan biçimden stil çıkarmak tahmindir. */
const EN_AZ_KUNYE = 3;
/** Bir işaretin "stilin kuralı" sayılması için künyelerin bu kadarında olması gerekir. */
const ORAN_ESIGI = 0.5;

/* Künye başındaki numara: "[1] …" (IEEE) ve "1. …" / "1) …" (Vancouver). */
const KOSELI_NUMARA = /^\[\d{1,3}\]\s*\S/;
const DUZ_NUMARA = /^\d{1,3}[.)]\s*\S/;
/* "(2020)." — parantezli yıl ve ARDINDAN nokta: APA'nın künye noktalaması. */
const PARANTEZ_YIL_NOKTA = /\((?:\d{4}[a-z]?|n\.d\.|t\.y\.)\)\s*\./;
/* "(2020) 'Başlık'" — yıldan sonra nokta YOK, başlık tek tırnakta: Harvard (Cite Them Right). */
const PARANTEZ_YIL_TIRNAK = /\((?:\d{4}[a-z]?|n\.d\.|t\.y\.)\)\s*[‘'][^’']{4,}[’']/;
/* "Yılmaz, Ahmet. 2020." — yıl yazardan sonra, parantezsiz: Chicago yazar–tarih. */
const YAZARDAN_SONRA_YIL = /^[^.]{3,}\.\s+(?:\d{4}[a-z]?|n\.d\.|t\.y\.)\.\s/;
/* "Yılmaz, Ahmet." — soyadından sonra AÇIK ad (baş harf değil): MLA, Chicago, klasik dipnot. */
const ACIK_AD = /^[\p{Lu}][\p{L}'’-]+,\s*[\p{Lu}][\p{L}'’-]{2,}/u;
/* "İstanbul: Yayınevi," — Chicago'nun basım yeri noktalaması. */
const YER_IKI_NOKTA = /[\p{Lu}][\p{L}'’ -]{2,}:\s*[\p{Lu}][\p{L}'’ .-]{2,},/u;
/*
  Yıl künyenin SONLARINDA: MLA / Chicago Notlar / klasik dipnot.

  Desenle ("yıldan sonra rakam yok") denemek yanlıştı: bu stillerde yılın
  ardından sayfa aralığı geliyor ("2020, pp. 45-67.") ve kusursuz MLA
  künyelerinin hiçbiri eşleşmiyordu. Ölçüt, SON dört haneli yılın
  künyenin ikinci yarısında durması.
*/
const sondaYilMi = (kunye: string) => {
  const yillar = [...kunye.matchAll(/(?:19|20)\d{2}/g)];
  const son = yillar.at(-1)?.index;
  return son !== undefined && son > kunye.length * 0.55;
};

/* Metin içi: "[3]", "[3, 5]" (IEEE) · "(3)", "(3,5)" (Vancouver). */
const METIN_KOSELI = /\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\]/g;
const METIN_PARANTEZ_NUMARA = /\(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\)/g;
/* "(Yılmaz, 2020)" — virgüllü: APA. */
const METIN_YAZAR_VIRGUL_YIL = /\(\s*[\p{Lu}][\p{L}'’.\- ]{2,40},\s*(?:\d{4}[a-z]?|n\.d\.|t\.y\.)/gu;
/* "(Yılmaz 2020)" — virgülsüz: Chicago yazar–tarih ve Harvard. */
const METIN_YAZAR_YIL = /\(\s*[\p{Lu}][\p{L}'’.\- ]{2,40}\s(?:\d{4}[a-z]?)\s*[),:;]/gu;
/* "(Yılmaz 45)" — ikinci sayı yıl DEĞİL, sayfa: MLA. */
const METIN_YAZAR_SAYFA = /\(\s*[\p{Lu}][\p{L}'’.\- ]{2,40}\s(\d{1,3})(?:[-–]\d{1,3})?\s*\)/gu;
/* Üst simge atıf: "…bulunmuştur.¹" */
const METIN_UST_SIMGE = /[.,;:)\]][⁰¹²³⁴⁵⁶⁷⁸⁹]/g;
/* Sayfa altı not satırı: "1 A. Yılmaz, Kitap, 2020, s. 45." */
const DIPNOT_SATIRI = /^\s{0,4}\d{1,3}[.)]?\s+\p{Lu}/u;

const sayi = (metin: string, desen: RegExp) => (metin.match(desen) ?? []).length;

export function olasiStiller({ kunyeler, govde = "" }: { kunyeler: string[]; govde?: string }): OlasiStilSonucu {
  const temiz = kunyeler.map((k) => k.trim()).filter((k) => k.length > 10);
  const puanlar = new Map<StilKimligi, { puan: number; gerekce: Metin[] }>();
  const ekle = (stil: StilKimligi, puan: number, gerekce: Metin) => {
    const onceki = puanlar.get(stil) ?? { puan: 0, gerekce: [] };
    puanlar.set(stil, { puan: onceki.puan + puan, gerekce: [...onceki.gerekce, gerekce] });
  };

  if (temiz.length < EN_AZ_KUNYE) return { yeterliKanit: false, adaylar: [], incelenenKunye: temiz.length };

  /* Bir işaret künyelerin yarısında görülmüşse stilin kuralı sayılıyor;
     tek künyeden stil çıkarmak, kopyala-yapıştır bir satıra bakmaktır. */
  const kunyeIsareti = (desen: RegExp) => temiz.filter((k) => desen.test(k)).length;
  const yeter = (adet: number) => adet >= Math.max(2, Math.ceil(temiz.length * ORAN_ESIGI));
  const kacinda = (adet: number): Metin => ({
    tr: `${adet}/${temiz.length} künyede`,
    en: `in ${adet} of ${temiz.length} references`,
  });

  const koseli = kunyeIsareti(KOSELI_NUMARA);
  if (yeter(koseli)) {
    ekle("ieee", 3, {
      tr: `Künyeler köşeli parantezli numarayla başlıyor ("[1] …") — ${kacinda(koseli).tr}.`,
      en: `References start with a bracketed number ("[1] …") — ${kacinda(koseli).en}.`,
    });
  }
  const duz = kunyeIsareti(DUZ_NUMARA);
  if (yeter(duz)) {
    ekle("vancouver", 3, {
      tr: `Künyeler sıra numarasıyla başlıyor ("1. …") — ${kacinda(duz).tr}.`,
      en: `References start with a plain number ("1. …") — ${kacinda(duz).en}.`,
    });
  }

  const apaYil = kunyeIsareti(PARANTEZ_YIL_NOKTA);
  if (yeter(apaYil)) {
    ekle("apa7", 3, {
      tr: `Yıl parantez içinde ve ardından nokta geliyor ("(2020). Başlık") — ${kacinda(apaYil).tr}.`,
      en: `The year is in parentheses followed by a period ("(2020). Title") — ${kacinda(apaYil).en}.`,
    });
  }
  const harvardTirnak = kunyeIsareti(PARANTEZ_YIL_TIRNAK);
  if (yeter(harvardTirnak)) {
    ekle("harvard", 3, {
      tr: `Yıldan sonra nokta yok ve başlık tek tırnak içinde ("(2020) 'Başlık'") — ${kacinda(harvardTirnak).tr}.`,
      en: `No period after the year and the title is in single quotes ("(2020) 'Title'") — ${kacinda(harvardTirnak).en}.`,
    });
  }
  const chicagoYil = kunyeIsareti(YAZARDAN_SONRA_YIL);
  if (yeter(chicagoYil)) {
    ekle("chicago", 3, {
      tr: `Yıl yazardan hemen sonra, parantezsiz ("Yılmaz, Ahmet. 2020.") — ${kacinda(chicagoYil).tr}.`,
      en: `The year follows the author without parentheses ("Smith, John. 2020.") — ${kacinda(chicagoYil).en}.`,
    });
  }

  /*
    AÇIK AD + SONDA YIL: üç stilin ortak künye iskeleti (MLA, Chicago
    Notlar–Kaynakça, klasik dipnot). Hangisi olduğu kaynakçadan
    anlaşılmıyor; ayıran işaret METİNDE. Üçü birden aday oluyor ve seçim
    kullanıcıya kalıyor — "kesin MLA" demek burada uydurma olurdu.
  */
  const acikAd = kunyeIsareti(ACIK_AD);
  const sondaYil = temiz.filter(sondaYilMi).length;
  if (yeter(acikAd) && yeter(sondaYil) && !yeter(chicagoYil) && !yeter(apaYil)) {
    const gerekce: Metin = {
      tr: `Yazarın adı açık yazılı ve yıl künyenin sonunda ("Yılmaz, Ahmet. … , 2020.") — ${kacinda(Math.min(acikAd, sondaYil)).tr}.`,
      en: `The author's given name is spelled out and the year is at the end ("Smith, John. … , 2020.") — ${kacinda(Math.min(acikAd, sondaYil)).en}.`,
    };
    ekle("mla", 2, gerekce);
    ekle("chicago-notlar", 2, gerekce);
    ekle("dipnot", 2, gerekce);
    const yerIkiNokta = kunyeIsareti(YER_IKI_NOKTA);
    if (yerIkiNokta >= 2) {
      ekle("chicago-notlar", 1, {
        tr: `Basım yeri iki nokta ile yazılı ("İstanbul: Yayınevi") — ${kacinda(yerIkiNokta).tr}; Chicago'nun noktalaması.`,
        en: `The place of publication uses a colon ("London: Publisher") — ${kacinda(yerIkiNokta).en}; Chicago's punctuation.`,
      });
    }
  }

  /* --- METİN İÇİ İŞARETLER ------------------------------------------- */
  const metin = govde.trim();
  if (metin) {
    const satirlar = metin.split("\n");
    const isaret = (adet: number): Metin => ({ tr: `metinde ${adet} yerde`, en: `in ${adet} places in the text` });

    const mKoseli = sayi(metin, METIN_KOSELI);
    if (mKoseli >= 2) {
      ekle("ieee", 3, {
        tr: `Atıflar köşeli parantezli numara ("[3]") — ${isaret(mKoseli).tr}.`,
        en: `Citations are bracketed numbers ("[3]") — ${isaret(mKoseli).en}.`,
      });
    }
    const mParantez = sayi(metin, METIN_PARANTEZ_NUMARA);
    if (mParantez >= 2) {
      ekle("vancouver", 3, {
        tr: `Atıflar parantez içinde numara ("(3)") — ${isaret(mParantez).tr}.`,
        en: `Citations are numbers in parentheses ("(3)") — ${isaret(mParantez).en}.`,
      });
    }
    const mVirgul = sayi(metin, METIN_YAZAR_VIRGUL_YIL);
    if (mVirgul >= 2) {
      ekle("apa7", 3, {
        tr: `Atıflarda yazar ile yıl virgülle ayrılıyor ("(Yılmaz, 2020)") — ${isaret(mVirgul).tr}.`,
        en: `Citations separate author and year with a comma ("(Smith, 2020)") — ${isaret(mVirgul).en}.`,
      });
    }
    const mYazarYil = sayi(metin, METIN_YAZAR_YIL);
    if (mYazarYil >= 2) {
      const gerekce: Metin = {
        tr: `Atıflarda yazar ile yıl arasında virgül yok ("(Yılmaz 2020)") — ${isaret(mYazarYil).tr}.`,
        en: `Citations have no comma between author and year ("(Smith 2020)") — ${isaret(mYazarYil).en}.`,
      };
      ekle("chicago", 2, gerekce);
      ekle("harvard", 2, gerekce);
    }
    const mSayfa = sayi(metin, METIN_YAZAR_SAYFA);
    if (mSayfa >= 2) {
      ekle("mla", 3, {
        tr: `Atıflarda yıl değil SAYFA yazılı ("(Yılmaz 45)") — ${isaret(mSayfa).tr}.`,
        en: `Citations carry a PAGE, not a year ("(Smith 45)") — ${isaret(mSayfa).en}.`,
      });
    }
    const dipnotlar = satirlar.filter((s) => DIPNOT_SATIRI.test(s)).length;
    const mUst = sayi(metin, METIN_UST_SIMGE);
    if (dipnotlar >= 2 || mUst >= 2) {
      const gerekce: Metin = dipnotlar >= 2
        ? { tr: `Metinde numarayla başlayan ${dipnotlar} dipnot satırı var.`, en: `The text has ${dipnotlar} footnote lines beginning with a number.` }
        : { tr: `Atıflar üst simge rakamla yapılıyor ("…bulunmuştur.¹") — ${isaret(mUst).tr}.`, en: `Citations use superscript numbers ("…was found.¹") — ${isaret(mUst).en}.` };
      ekle("dipnot", 3, gerekce);
      ekle("chicago-notlar", 2, gerekce);
    }
  }

  const adaylar = [...puanlar.entries()]
    .map(([stil, { puan, gerekce }]) => ({ stil, puan, gerekce }))
    /* Eşit puanda sıra kararlı olsun: aynı girdi her çağrıda aynı listeyi
       versin (ekran sırası testlerle sabitlenebilsin). */
    .sort((a, b) => b.puan - a.puan || a.stil.localeCompare(b.stil))
    /* Tek bir zayıf işaret (puan 1) öneri değildir. */
    .filter((a) => a.puan >= 2);

  return { yeterliKanit: adaylar.length > 0, adaylar, incelenenKunye: temiz.length };
}
