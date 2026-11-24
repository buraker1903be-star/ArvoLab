/*
  KILAVUZDAKİ ÖRNEK KÜNYELER — İNTERNET KAYNAKLARI (24.11.2026).

  Tez kılavuzlarının çoğu internet kaynakları için BİRDEN ÇOK örnek
  verir: kurumsal web sayfası, çevrimiçi rapor, bazen veri tabanı kaydı.
  Aralarındaki fark küçük ama gerçek (erişim tarihinin yeri, "Erişim
  adresi:" öneki, rapor numarasının yazımı) ve ArvoLab bu kuralları
  kılavuzdan OKUMUYOR. Hazır kaynakça düzeltmesi (lib/atif/hazir-duzeltme.ts)
  bu yüzden internet kaynaklarında "kılavuzun özel kuralı doğrulanmadı"
  diyerek düzeltmeyi seçili getirmiyordu — ama öğrenciye kılavuzunda ne
  yazdığını da göstermiyordu, yani karşılaştırması için elinde bir şey
  yoktu.

  Bu modül kılavuzun KENDİ cümlelerini çıkarır. Üç kural:

  - ÖRNEK UYDURULMAZ. Dönen her metin kılavuzda BİREBİR geçer; modül
    hiçbir şeyi düzeltmez, tamamlamaz, biçimlemez.
  - TÜR EMİN DEĞİLSE SÖYLENMEZ. Rapor mu kurumsal sayfa mı olduğu açık
    bir işaretle anlaşılmıyorsa `kesin: false` döner ve karar
    öğrencinindir; "kesin" damgası, olmayan bir kesinliği ürüne
    yazmaktır.
  - KONUM GÖSTERİLİR. Her örnek, üstündeki bölüm başlığı ve (metinde
    sayfa ayracı varsa) sayfasıyla birlikte döner: öğrenci kılavuzunu
    açıp doğrulayabilsin.

  Saf modül; testi tests/unit/kilavuz-ornek-kunyeler.test.ts.
*/

import { sayfaNo, ustBaslik } from "./kilavuz-stil-dayanagi";

export type OrnekTuru = "kurumsal-sayfa" | "cevrimici-rapor" | "genel-internet";

export type OrnekKunye = {
  /** Kılavuzda yazdığı gibi; değiştirilmez. */
  metin: string;
  tur: OrnekTuru;
  /** Tür açık bir işaretle belirlendi mi; false ise seçim öğrencinin. */
  kesin: boolean;
  bolum: string | null;
  sayfa: number | null;
};

/* En fazla kaç örnek gösterilir: liste karşılaştırılabilir kalsın. */
const SINIR = 6;
/* Künye uzunluğu: kısa satır başlık, uzun satır paragraftır. */
const EN_AZ = 40;
const EN_COK = 400;

/* İnternet kaynağı işareti: adres ya da erişim ifadesi. */
const ADRES = /(https?:\/\/|www\.|erişim adresi|erisim adresi|erişim tarihi|erisim tarihi|retrieved from|available (?:from|at)|son erişim|son erisim)/i;
/* Künye yılı; tarihsiz kaynak da künyedir. */
const YIL = /(?:^|[\s,.(])(?:19|20)\d{2}(?:[a-z])?(?=[\s,.):])|\bt\.y\.|\bn\.d\./i;
/*
  KURALI ANLATAN CÜMLE ÖRNEK DEĞİLDİR. Kılavuzlar "İnternet kaynakları
  şu biçimde yazılır:" der ve örneği ALTINA koyar; üstteki cümlede de
  adres geçebiliyor. Yüklemi olan satır eleniyor.
*/
const KURAL_CUMLESI = /\b(yazılır|yazilir|gösterilir|gosterilir|kullanılır|kullanilir|belirtilir|verilir|eklenir|düzenlenir|duzenlenir|olmalıdır|olmalidir|gerekir|should be|must be|is written|are written)\b/i;
/* Satır başındaki "Örnek:" / "Örneğin" sayılmaz, künye ondan sonra başlar. */
const ORNEK_ONEKI = /^\s*(?:[-•*]\s*)?(?:örnek|ornek|örneğin|ornegin|example|e\.g\.)\s*[:.\-–]?\s*/i;

/*
  İşaretler GÖVDEYLE aranıyor: Türkçe çekim ekleri sözcüğün sonuna
  geliyor ve "\brapor\b" kalıbı "raporu"yu kaçırıyordu — kılavuzlardaki
  örneklerin neredeyse hepsi çekimli ("… tüberküloz raporu 2022").
*/
/* ÇEVRİMİÇİ RAPOR işaretleri. */
const RAPOR = /\b(rapor\p{L}*|report\p{L}*|bülten\p{L}*|bulten\p{L}*|bulletin\p{L}*|yıllığ\p{L}*|yilli[gğ]\p{L}*|annual|working paper|tebliğ\p{L}*|teblig\p{L}*|no\.\s*\d|nr\.\s*\d)/iu;
/* KURUMSAL SAYFA işaretleri: yazar bir kurum. */
const KURUM = /\b(kurum\p{L}*|bakanlı[ğg]\p{L}*|üniversite\p{L}*|universite\p{L}*|enstitü\p{L}*|enstitu\p{L}*|örgüt\p{L}*|orgut\p{L}*|derne[kğg]\p{L}*|birli[ğg]\p{L}*|başkanlı[ğg]\p{L}*|baskanli[ğg]\p{L}*|müdürlü[ğg]\p{L}*|mudurlu[ğg]\p{L}*|oda(?:sı|si)|ministry|institute|organization|organisation|agency|association|commission|bureau|council|TÜİK|TUIK|TÜBİTAK|TUBITAK|YÖK|WHO|OECD|UNESCO|UNICEF|NASA|CDC|EUROSTAT)/iu;

const temizle = (metin: string) => metin.replace(/\s+/g, " ").trim();

/** Örneğin türü ve türün ne kadar açık olduğu. */
export function ornekTuru(metin: string): { tur: OrnekTuru; kesin: boolean } {
  const rapor = RAPOR.test(metin);
  const kurum = KURUM.test(metin);
  /* İkisi birden varsa rapor kazanır: kurumun yayımladığı rapor da rapordur. */
  if (rapor) return { tur: "cevrimici-rapor", kesin: true };
  if (kurum) return { tur: "kurumsal-sayfa", kesin: true };
  return { tur: "genel-internet", kesin: false };
}

/**
 * Kılavuz metninden internet kaynağı örnek künyeleri.
 *
 * Satır satır bakılıyor: kılavuzlarda örnekler kendi satırlarında
 * durur. Paragrafın içinden cümle kesmek, kuralı anlatan metni örnek
 * diye göstermeye açık kapı bırakırdı.
 */
export function internetOrnekKunyeleri(metin: string, sinir = SINIR): OrnekKunye[] {
  if (!metin?.trim()) return [];
  const ornekler: OrnekKunye[] = [];
  const gorulen = new Set<string>();
  let konum = 0;
  for (const satir of metin.split("\n")) {
    const satirBasi = konum;
    konum += satir.length + 1;
    const ham = satir.replace(ORNEK_ONEKI, "");
    const aday = temizle(ham);
    if (aday.length < EN_AZ || aday.length > EN_COK) continue;
    if (!ADRES.test(aday) || !YIL.test(aday)) continue;
    if (KURAL_CUMLESI.test(aday)) continue;
    const anahtar = aday.toLocaleLowerCase("tr");
    if (gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    const { tur, kesin } = ornekTuru(aday);
    ornekler.push({ metin: aday, tur, kesin, bolum: ustBaslik(metin, satirBasi), sayfa: sayfaNo(metin, satirBasi) });
    if (ornekler.length >= sinir) break;
  }
  return ornekler;
}

/* ---------------------------------------------------------------- */

export type InternetKaynagi = {
  title?: string | null;
  authors?: string | null;
  container_title?: string | null;
  publisher?: string | null;
  doi_or_url?: string | null;
};

/**
 * Kaynağın internet türü: hangi örneğin ona uyduğunu bulmak için.
 *
 * `kesin: false` dönmesi bir başarısızlık değil, dürüst cevap: tür
 * belirsizken bir örneği "uygun" diye işaretlemek, öğrenciyi
 * doğrulamadığımız bir kurala yönlendirmek olurdu.
 */
export function kaynakInternetTuru(kaynak: InternetKaynagi): { tur: OrnekTuru; kesin: boolean } {
  const metin = [kaynak.title, kaynak.authors, kaynak.container_title, kaynak.publisher].filter(Boolean).join(" · ");
  return ornekTuru(metin);
}

/**
 * Kaynağa ÖNERİLEN örnek; emin olunamıyorsa null (karşılaştırma sunulur).
 *
 * Tek örnek varsa karşılaştıracak bir şey yoktur, o önerilir. Birden
 * çok örnekte yalnızca türü KESİN olarak eşleşen TEK örnek varsa
 * önerilir; iki örnek aynı türdeyse ya da kaynağın türü belirsizse
 * öneri yapılmaz.
 */
export function onerilenOrnek(ornekler: OrnekKunye[], kaynak: InternetKaynagi): OrnekKunye | null {
  if (ornekler.length === 0) return null;
  if (ornekler.length === 1) return ornekler[0];
  const kaynakTuru = kaynakInternetTuru(kaynak);
  if (!kaynakTuru.kesin) return null;
  const uyanlar = ornekler.filter((o) => o.kesin && o.tur === kaynakTuru.tur);
  return uyanlar.length === 1 ? uyanlar[0] : null;
}

/* ---------------------------------------------------------------- */

/*
  ÖRNEKTEN GÜVENLE ÇIKARILABİLEN KURAL.

  Bir örnek satırından künyenin TAMAMINI yeniden türetmek mümkün değil
  (yazar biçimi, italikler, noktalama sırası tek satırdan okunmaz) ve
  denemek, doğrulamadığımız bir biçimi öğrencinin kaynakçasına yazmak
  olurdu. Buradan yalnızca İKİ şey okunuyor, çünkü yalnızca bu ikisi
  kılavuzdan kılavuza gerçekten değişiyor ve tek satırdan kesin olarak
  görülüyor:

    - ADRESİN ÖNÜNDEKİ ETİKET: "Erişim adresi: https://…" mi, çıplak
      "https://…" mi. Etiket TANINAN bir listeden seçiliyor; örnekte
      tanınmayan bir yapı varsa ("… adresinden alınmıştır") kural
      ÇIKARILAMADI sayılır — etiketi örnekten kopyalamak, kılavuzun
      kendi metnini öğrencinin künyesine taşımak olurdu.
    - ERİŞİM TARİHİ İSTENİYOR MU: örnekte erişim tarihi varsa kural onu
      ister; ArvoLab'da kayıtlı erişim bilgisi olmadığı için o künye
      "eksik bilgi" listesine düşer, tarih UYDURULMAZ.

  Örnekteki yazar, yıl ve adres hiçbir koşulda öğrencinin künyesine
  taşınmaz; buradan çıkan şey yalnızca KALIP.
*/

export type OrnekKurali = {
  /** Adresin önüne yazılan etiket; çıplak adres için boş dize. */
  adresOneki: string;
  /** Örnek erişim tarihi gösteriyor mu. */
  erisimTarihiIstiyor: boolean;
  /** Kural güvenle okunabildi mi; false ise örnek yalnızca karşılaştırma içindir. */
  cikarilabilir: boolean;
};

/* Adresin önünde geçebilen TANINAN etiketler; başkası varsa kural okunamaz. */
const ADRES_ONEKLERI = [
  "Erişim adresi:",
  "Erisim adresi:",
  "Erişim adresi",
  "Erişim:",
  "Adres:",
  "Available at:",
  "Available from:",
  "Retrieved from",
  "URL:",
];
/* Erişim tarihi etiketleri: varlığını anlamak için; tarih DEĞERİ okunmaz. */
const ERISIM_TARIHI = /(erişim tarihi|erisim tarihi|son erişim|son erisim|accessed|date accessed|erişildi|erisildi)/i;
/*
  Adresten SONRA gelebilecek, kalıbı bozmayan tek şey: noktalama ve
  erişim tarihi eki. Başka bir sözcük varsa ("… adresinden alınmıştır")
  kalıbı okuduğumuzu söyleyemeyiz.
*/
const sonrasiTaninir = (sonrasi: string) => {
  const kalan = sonrasi.replace(/^[\s.,;:)\]]*/, "").trim();
  if (!kalan) return true;
  return new RegExp(`^[([]?\\s*(?:${ERISIM_TARIHI.source})`, "i").test(kalan);
};

const ADRES_YERI = /(https?:\/\/|www\.)\S+/i;

export function ornekKurali(ornek: OrnekKunye): OrnekKurali {
  const metin = ornek.metin;
  const adres = ADRES_YERI.exec(metin);
  const okunamadi: OrnekKurali = { adresOneki: "", erisimTarihiIstiyor: false, cikarilabilir: false };
  if (!adres) return okunamadi;
  const once = metin.slice(0, adres.index);
  const sonrasi = metin.slice(adres.index + adres[0].length);
  const etiket = ADRES_ONEKLERI.find((e) => once.trimEnd().toLocaleLowerCase("tr").endsWith(e.toLocaleLowerCase("tr")));
  if (etiket) {
    return sonrasiTaninir(sonrasi)
      ? { adresOneki: etiket.endsWith(":") ? etiket : `${etiket}:`, erisimTarihiIstiyor: ERISIM_TARIHI.test(metin), cikarilabilir: true }
      : okunamadi;
  }
  /*
    Etiket yok: adres ÇIPLAK yazılmışsa bu da bir kuraldır — ama
    yalnızca adres künyenin SONUNDAYSA. "… verileri, https://… adresinden
    alınmıştır." yapısında adresin ardından gelen sözcükler kalıbın
    parçası ve biz onu okuyamıyoruz; "çıplak adres" demek, kılavuzun
    söylemediği bir kuralı uygulamak olurdu.
  */
  return sonrasiTaninir(metin.slice(adres.index + adres[0].length))
    ? { adresOneki: "", erisimTarihiIstiyor: ERISIM_TARIHI.test(metin), cikarilabilir: true }
    : okunamadi;
}

export const ORNEK_TURU_ADI: Record<OrnekTuru, { tr: string; en: string }> = {
  "kurumsal-sayfa": { tr: "Kurumsal web sayfası", en: "Institutional web page" },
  "cevrimici-rapor": { tr: "Çevrimiçi rapor", en: "Online report" },
  "genel-internet": { tr: "İnternet kaynağı", en: "Website source" },
};
