/*
  MAKALENİN SINIR KONTROLLERİ — TEK KURAL, İKİ EKRAN (Makale Aşama 2,
  05.11.2026).

  Kelime sınırı, özet ve anahtar kelime kontrolleri burada hesaplanır ve
  iki yerde AYNEN kullanılır: Makale sekmesindeki gönderim öncesi kontrol
  (gonderim-kontrolu.ts) ve Yazım editörünün teslim listesi
  (lib/submission-checklist.ts, makaleTeslimMaddeleri). Eskiden editör
  makalede de üniversite kılavuzunun TEZ kelime sınırına bakıyordu ve
  sözcüğü kaynakça dahil sayıyordu; Makale sekmesi dergi sınırına,
  kaynakça ve özet hariç bakıyordu — aynı makale iki ekranda iki ayrı
  hüküm alabiliyordu.

  ÖZET VE ANAHTAR KELİME: İKİ KAYNAK, TEK ÖNCELİK.
  Eskiden kontrol özeti yalnızca Makale bilgileri formundan okuyordu;
  özeti editöre yazan kullanıcı "Özet girilmedi" uyarısı alıyordu.
  Kural:
    1. Müsveddede "Özet"/"Abstract" başlıklı bir bölüm varsa ESAS ODUR:
       dergiye gidecek metin müsveddedir.
    2. Yoksa Makale bilgilerindeki özet kullanılır.
    3. İkisi de varsa ve FARKLIYSA ikisi de korunur, hiçbiri otomatik
       değiştirilmez; kontrol bir "Bakılacak" maddesiyle farkı söyler.
       Sessiz eşitleme yok: hangisinin güncel olduğunu yalnızca yazar
       bilir.
  Anahtar kelimeler için aynı kural; müsveddedeki karşılığı özet
  bölümündeki "Anahtar kelimeler:" / "Keywords:" satırıdır.

  Sınır girilmemişse VARSAYILAN SINIR YOK: sayı söylenir, karşılaştırma
  yapılmaz. Dergi bilgileri kullanıcının beyanıdır; ArvoLab doğrulamaz.

  Saf modül; testi tests/unit/makale-ozet-ve-sinirlar.test.ts.
*/

import type { Dil } from "@/lib/dil";
import { anaMetinSozcukSayisi, makaleBolumleri, sozcukSayisi, type MakaleBolumu } from "./bolumler";
import type { KontrolMaddesi, MakaleProfili } from "./gonderim-kontrolu";

/** Sınır kontrollerinin ihtiyaç duyduğu profil alanları (editör de yalnızca bunları alır). */
export type SinirProfili = Pick<MakaleProfili, "dil" | "kelime_siniri" | "ozet_siniri" | "anahtar_en_az" | "anahtar_en_cok" | "ozet" | "anahtar_kelimeler">;

export type Kaynak = "musvedde" | "profil" | null;

/*
  "Anahtar kelimeler: a, b; c" satırı. Satır başında olmalı: cümle
  içinde geçen "anahtar kelimeler" ifadesi satır sayılmaz.
*/
const ANAHTAR_SATIRI = /^\s*(?:anahtar\s+(?:kelimeler|sözcükler)|keywords|key\s+words)\s*[:：]\s*(.+)$/imu;

const anahtarlariAyir = (satir: string) =>
  satir
    .split(/[;,،]/)
    .map((k) => k.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .slice(0, 20);

const karsilastirmaBicimi = (metin: string) => metin.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

/**
 * Müsveddedeki özet bölümü. Birden çok özet varsa (Türkçe makalede
 * "Özet" + "Abstract") makalenin diline uyan seçilir; makale İngilizce
 * ise "Abstract", değilse ilk özet.
 */
export function musveddeOzeti(bolumler: MakaleBolumu[], makaleDili: SinirProfili["dil"]): { metin: string; anahtarlar: string[] | null } | null {
  const ozetler = bolumler.filter((b) => b.tur === "ozet");
  if (!ozetler.length) return null;
  const secilen = (makaleDili === "en" ? ozetler.find((b) => /abstract|summary/i.test(b.baslik)) : null) ?? ozetler[0];
  const satir = ANAHTAR_SATIRI.exec(secilen.metin);
  const metin = secilen.metin.replace(ANAHTAR_SATIRI, "").trim();
  return { metin, anahtarlar: satir ? anahtarlariAyir(satir[1]) : null };
}

export function ozetKaynagi(profil: SinirProfili, bolumler: MakaleBolumu[]): { metin: string; kaynak: Kaynak; celiski: boolean } {
  const musvedde = musveddeOzeti(bolumler, profil.dil);
  const formdaki = (profil.ozet ?? "").trim();
  if (musvedde?.metin) {
    return { metin: musvedde.metin, kaynak: "musvedde", celiski: Boolean(formdaki) && karsilastirmaBicimi(formdaki) !== karsilastirmaBicimi(musvedde.metin) };
  }
  return formdaki ? { metin: formdaki, kaynak: "profil", celiski: false } : { metin: "", kaynak: null, celiski: false };
}

export function anahtarKaynagi(profil: SinirProfili, bolumler: MakaleBolumu[]): { kelimeler: string[]; kaynak: Kaynak; celiski: boolean } {
  const musvedde = musveddeOzeti(bolumler, profil.dil)?.anahtarlar ?? null;
  const formdaki = profil.anahtar_kelimeler.map((k) => k.trim()).filter(Boolean);
  if (musvedde?.length) {
    const kume = (liste: string[]) => [...liste.map(karsilastirmaBicimi)].sort().join("|");
    return { kelimeler: musvedde, kaynak: "musvedde", celiski: formdaki.length > 0 && kume(formdaki) !== kume(musvedde) };
  }
  return formdaki.length ? { kelimeler: formdaki, kaynak: "profil", celiski: false } : { kelimeler: [], kaynak: null, celiski: false };
}

/**
 * Kelime sınırı, özet ve anahtar kelime maddeleri. Makale sekmesi ve
 * editör bu fonksiyonun çıktısını kullanır; metinler ve durumlar aynı.
 */
export function makaleSinirMaddeleri(girdi: { profil: SinirProfili; bolumler: MakaleBolumu[] }, dil: Dil = "tr"): KontrolMaddesi[] {
  const en = dil === "en";
  const t = (tr: string, ing: string) => (en ? ing : tr);
  const { profil, bolumler } = girdi;
  const maddeler: KontrolMaddesi[] = [];
  const kaynakAdi = (k: Kaynak) => (k === "musvedde" ? t("müsveddeden", "from the manuscript") : t("Makale bilgilerinden", "from the article details"));

  // Kelime sınırı: ana metin, özet ve kaynakça hariç.
  const anaMetin = anaMetinSozcukSayisi(bolumler);
  const kelimeBaslik = t("Kelime sınırı", "Word limit");
  if (profil.kelime_siniri) {
    const asim = anaMetin - profil.kelime_siniri;
    maddeler.push({
      anahtar: "kelime",
      baslik: kelimeBaslik,
      durum: asim > 0 ? "eksik" : "tamam",
      aciklama: en
        ? (asim > 0
            ? `The main text is about ${anaMetin} words; the limit is ${profil.kelime_siniri}, about ${asim} words over.`
            : `The main text is about ${anaMetin} words; the limit is ${profil.kelime_siniri}.`) +
          " Abstract and references were excluded; check the journal's counting rule."
        : (asim > 0
            ? `Ana metin yaklaşık ${anaMetin} sözcük; sınır ${profil.kelime_siniri}, yaklaşık ${asim} sözcük fazla.`
            : `Ana metin yaklaşık ${anaMetin} sözcük; sınır ${profil.kelime_siniri}.`) +
          " Özet ve kaynakça hariç sayıldı; derginin sayma kuralını kontrol edin.",
    });
  } else {
    maddeler.push({
      anahtar: "kelime",
      baslik: kelimeBaslik,
      durum: "bilgi",
      aciklama: en
        ? `The main text is about ${anaMetin} words (abstract and references excluded). Enter the target journal's limit to compare.`
        : `Ana metin yaklaşık ${anaMetin} sözcük (özet ve kaynakça hariç). Hedef derginin sınırını girerseniz karşılaştırılır.`,
    });
  }

  // Özet.
  const ozet = ozetKaynagi(profil, bolumler);
  const ozetSozcuk = sozcukSayisi(ozet.metin);
  const ozetBaslik = t("Özet", "Abstract");
  const nereden = ozet.kaynak ? ` (${kaynakAdi(ozet.kaynak)})` : "";
  const ozetSinirli = en
    ? `The abstract${nereden} is ${ozetSozcuk} words; the limit is ${profil.ozet_siniri ?? ""}.`
    : `Özet${nereden} ${ozetSozcuk} sözcük; sınır ${profil.ozet_siniri ?? ""}.`;
  if (!ozetSozcuk) {
    maddeler.push({
      anahtar: "ozet",
      baslik: ozetBaslik,
      durum: "eksik",
      aciklama: t(
        "Özet girilmedi: müsveddede “Özet” başlıklı bölüm yok, Makale bilgilerinde de özet yok.",
        "No abstract: the manuscript has no “Abstract” section and the article details have no abstract.",
      ),
    });
  } else if (profil.ozet_siniri && ozetSozcuk > profil.ozet_siniri) {
    maddeler.push({ anahtar: "ozet", baslik: ozetBaslik, durum: "eksik", aciklama: ozetSinirli });
  } else {
    maddeler.push({
      anahtar: "ozet",
      baslik: ozetBaslik,
      durum: profil.ozet_siniri ? "tamam" : "bilgi",
      aciklama: profil.ozet_siniri
        ? ozetSinirli
        : en
          ? `The abstract${nereden} is ${ozetSozcuk} words. Enter the journal's abstract limit to compare.`
          : `Özet${nereden} ${ozetSozcuk} sözcük. Derginin özet sınırını girerseniz karşılaştırılır.`,
    });
  }
  if (ozet.celiski) {
    maddeler.push({
      anahtar: "ozet-tutarlilik",
      baslik: t("Özet iki yerde farklı", "Abstract differs in two places"),
      durum: "dikkat",
      aciklama: t(
        "Müsveddedeki özet ile Makale bilgilerindeki özet aynı değil. Kontroller müsveddedekini esas alıyor; hiçbiri otomatik değiştirilmedi. Güncel olmayanı kendiniz düzeltin.",
        "The abstract in the manuscript and the one in the article details are not the same. The checks use the manuscript's; neither was changed automatically. Correct the outdated one yourself.",
      ),
    });
  }

  // Anahtar kelimeler.
  const anahtar = anahtarKaynagi(profil, bolumler);
  const sayi = anahtar.kelimeler.length;
  const enAz = profil.anahtar_en_az;
  const enCok = profil.anahtar_en_cok;
  const anahtarBaslik = t("Anahtar kelimeler", "Keywords");
  const anahtarNereden = anahtar.kaynak ? ` (${kaynakAdi(anahtar.kaynak)})` : "";
  if (!sayi)
    maddeler.push({
      anahtar: "anahtar",
      baslik: anahtarBaslik,
      durum: "eksik",
      aciklama: t(
        "Anahtar kelime girilmedi: özet bölümünde “Anahtar kelimeler:” satırı yok, Makale bilgilerinde de yok.",
        "No keywords: the abstract section has no “Keywords:” line and the article details have none.",
      ),
    });
  else if ((enAz && sayi < enAz) || (enCok && sayi > enCok)) {
    const aralik = [enAz ? t(`en az ${enAz}`, `at least ${enAz}`) : "", enCok ? t(`en çok ${enCok}`, `at most ${enCok}`) : ""].filter(Boolean).join(", ");
    maddeler.push({
      anahtar: "anahtar",
      baslik: anahtarBaslik,
      durum: "eksik",
      aciklama: en
        ? `${sayi} ${sayi === 1 ? "keyword" : "keywords"}${anahtarNereden}; the journal requires ${aralik}.`
        : `${sayi} anahtar kelime var${anahtarNereden}; dergi ${aralik} istiyor.`,
    });
  } else
    maddeler.push({
      anahtar: "anahtar",
      baslik: anahtarBaslik,
      durum: enAz || enCok ? "tamam" : "bilgi",
      aciklama: en ? `${sayi} ${sayi === 1 ? "keyword" : "keywords"}${anahtarNereden}.` : `${sayi} anahtar kelime${anahtarNereden}.`,
    });
  if (anahtar.celiski) {
    maddeler.push({
      anahtar: "anahtar-tutarlilik",
      baslik: t("Anahtar kelimeler iki yerde farklı", "Keywords differ in two places"),
      durum: "dikkat",
      aciklama: t(
        "Müsveddedeki “Anahtar kelimeler” satırı ile Makale bilgilerindeki liste aynı değil. Kontroller müsveddedekini esas alıyor; hiçbiri otomatik değiştirilmedi.",
        "The “Keywords” line in the manuscript and the list in the article details are not the same. The checks use the manuscript's; neither was changed automatically.",
      ),
    });
  }
  return maddeler;
}

/**
 * Editörün teslim listesi için girdi: kayıtlı profil (yoksa null) ve
 * editördeki CANLI belge. Profil yoksa sınırlar boştur — varsayılan
 * sınır uydurulmaz; özet ve anahtar kelime yine müsveddeden okunur.
 */
export function makaleTeslimGirdisi(profil: SinirProfili | null, icerik: unknown, dil: Dil = "tr"): { profilVar: boolean; maddeler: KontrolMaddesi[] } {
  const bos: SinirProfili = { dil: "tr", kelime_siniri: null, ozet_siniri: null, anahtar_en_az: null, anahtar_en_cok: null, ozet: null, anahtar_kelimeler: [] };
  return { profilVar: Boolean(profil), maddeler: makaleSinirMaddeleri({ profil: profil ?? bos, bolumler: makaleBolumleri(icerik, dil) }, dil) };
}
