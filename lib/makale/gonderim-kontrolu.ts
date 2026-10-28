/*
  Makale gönderim öncesi kalite kontrolü.

  Her madde DETERMİNİSTİK: sözcük sayısı, anahtar kelime sayısı, planda
  olup metinde olmayan bölüm, kanıt matrisinde çözülmemiş iddia, dergi
  kurallarının ne zaman kontrol edildiği. Dil modeline sorulan bir şey
  yok; asistanın bölüm denetimi ayrı bir yetenek ve orada da hüküm değil
  bulgu üretiyor.

  BİLEREK OLMAYANLAR:
  - Kabul olasılığı. Hiçbir veriyle doğrulanamaz; yüzde vermek yanıltır.
  - "Dergiye uygun" hükmü. Dergi kuralları değişir ve ArvoLab onları bir
    dizinden okumuyor. Söylenebilen tek şey kullanıcının kuralları en son
    ne zaman kontrol ettiğidir; eskidikçe hatırlatılır.

  Saf modül; testi tests/unit/makale-gonderim.test.ts.
*/

import { MAKALE_TURLERI, bolumAdi, standartUyarisi, type MakaleTuru } from "./sablonlar";
import type { Dil } from "@/lib/dil";
import { anaMetinSozcukSayisi, sozcukSayisi, type MakaleBolumu } from "./bolumler";
import type { MatrisOzeti } from "@/lib/kanit/durum";

export type MakaleProfili = {
  makale_turu: MakaleTuru;
  arastirma_sorusu: string | null;
  arastirma_problemi: string | null;
  hedef_dergi: string | null;
  dergi_kurallari_adresi: string | null;
  dergi_kurallari_kontrol: string | null;
  dil: "tr" | "en" | "diger";
  kelime_siniri: number | null;
  ozet_siniri: number | null;
  anahtar_en_az: number | null;
  anahtar_en_cok: number | null;
  ozet: string | null;
  anahtar_kelimeler: string[];
  veri_durumu: "yok" | "toplaniyor" | "toplandi" | "analiz_edildi" | "gerekmiyor";
  raporlama_standardi: string | null;
};

export type MaddeDurumu = "tamam" | "eksik" | "dikkat" | "bilgi";

export type KontrolMaddesi = {
  anahtar: string;
  baslik: string;
  durum: MaddeDurumu;
  aciklama: string;
};

/** Dergi kuralları bundan eskiyse yeniden kontrol hatırlatılır. */
export const DERGI_KONTROL_GUN = 180;

const GUN_MS = 86_400_000;

/*
  dil: ARAYÜZ dili (28.10.2026). profil.dil ile karıştırmayın — o
  müsveddenin dilidir ve bölüm adlarını hangi dilde yazacağımızı o
  belirler (İngilizce bir makalenin eksik bölümü "Results" diye anılır,
  arayüz Türkçe olsa bile).
*/
export function gonderimKontrolu(
  girdi: {
    profil: MakaleProfili;
    bolumler: MakaleBolumu[];
    kanit: MatrisOzeti;
    /** "YYYY-AA-GG" ya da ISO; testlerde sabitlenebilsin diye dışarıdan. */
    bugun: string;
  },
  dil: Dil = "tr",
): KontrolMaddesi[] {
  const en = dil === "en";
  const t = (tr: string, ing: string) => (en ? ing : tr);
  const { profil, bolumler, kanit } = girdi;
  const tur = MAKALE_TURLERI[profil.makale_turu];
  const uyari = standartUyarisi(dil);
  const maddeler: KontrolMaddesi[] = [];

  const soruBaslik = t("Araştırma sorusu", "Research question");
  maddeler.push(
    profil.arastirma_sorusu?.trim()
      ? { anahtar: "soru", baslik: soruBaslik, durum: "tamam", aciklama: t("Araştırma sorusu tanımlı; sonuç bölümünün bu soruya döndüğünü kontrol edin.", "The research question is defined; check that the Conclusion returns to it.") }
      : { anahtar: "soru", baslik: soruBaslik, durum: "eksik", aciklama: t("Araştırma sorusu girilmedi. Bölüm denetimi ve sonuç–soru ilişkisi buna göre kuruluyor.", "No research question entered. The section review and the conclusion–question link are built on it.") },
  );

  // Planda olup metinde olmayan bölümler.
  const metindeki = new Set(bolumler.map((b) => b.tur).filter(Boolean));
  const eksikBolumler = tur.bolumler.filter((b) => b !== "ozet" && !metindeki.has(b));
  const planBaslik = t("Bölüm planı", "Section plan");
  const eksikAdlar = eksikBolumler.map((b) => bolumAdi(b, profil.dil)).join(", ");
  maddeler.push(
    eksikBolumler.length
      ? {
          anahtar: "bolumler",
          baslik: planBaslik,
          durum: "dikkat",
          aciklama: en
            ? `Sections in the template that were not found as headings in the manuscript: ${eksikAdlar}. If the target journal requires a different structure, the journal's instructions take precedence.`
            : `Şablonda olup müsveddede başlık olarak bulunamayan bölümler: ${eksikAdlar}. Hedef dergi farklı bir düzen istiyorsa dergi talimatı geçerlidir.`,
        }
      : { anahtar: "bolumler", baslik: planBaslik, durum: "tamam", aciklama: t("Şablondaki bütün bölümler müsveddede başlık olarak var.", "Every section in the template appears as a heading in the manuscript.") },
  );

  // Kelime sınırı.
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
        ? `The main text is about ${anaMetin} words. Enter the target journal's limit to compare.`
        : `Ana metin yaklaşık ${anaMetin} sözcük. Hedef derginin sınırını girerseniz karşılaştırılır.`,
    });
  }

  // Özet.
  const ozetSozcuk = sozcukSayisi(profil.ozet ?? "");
  const ozetBaslik = t("Özet", "Abstract");
  const ozetSinirli = en
    ? `The abstract is ${ozetSozcuk} words; the limit is ${profil.ozet_siniri ?? ""}.`
    : `Özet ${ozetSozcuk} sözcük; sınır ${profil.ozet_siniri ?? ""}.`;
  if (!ozetSozcuk) {
    maddeler.push({ anahtar: "ozet", baslik: ozetBaslik, durum: "eksik", aciklama: t("Özet girilmedi.", "No abstract entered.") });
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
          ? `The abstract is ${ozetSozcuk} words. Enter the journal's abstract limit to compare.`
          : `Özet ${ozetSozcuk} sözcük. Derginin özet sınırını girerseniz karşılaştırılır.`,
    });
  }

  // Anahtar kelimeler.
  const anahtar = profil.anahtar_kelimeler.filter((k) => k.trim()).length;
  const enAz = profil.anahtar_en_az;
  const enCok = profil.anahtar_en_cok;
  const anahtarBaslik = t("Anahtar kelimeler", "Keywords");
  if (!anahtar) maddeler.push({ anahtar: "anahtar", baslik: anahtarBaslik, durum: "eksik", aciklama: t("Anahtar kelime girilmedi.", "No keywords entered.") });
  else if ((enAz && anahtar < enAz) || (enCok && anahtar > enCok)) {
    const aralik = [enAz ? t(`en az ${enAz}`, `at least ${enAz}`) : "", enCok ? t(`en çok ${enCok}`, `at most ${enCok}`) : ""].filter(Boolean).join(", ");
    maddeler.push({
      anahtar: "anahtar",
      baslik: anahtarBaslik,
      durum: "eksik",
      aciklama: en ? `${anahtar} ${anahtar === 1 ? "keyword" : "keywords"}; the journal requires ${aralik}.` : `${anahtar} anahtar kelime var; dergi ${aralik} istiyor.`,
    });
  } else
    maddeler.push({
      anahtar: "anahtar",
      baslik: anahtarBaslik,
      durum: enAz || enCok ? "tamam" : "bilgi",
      aciklama: en ? `${anahtar} ${anahtar === 1 ? "keyword" : "keywords"}.` : `${anahtar} anahtar kelime.`,
    });

  // Dergi kuralları: doğrulanmıyor, kontrol tarihi hatırlatılıyor.
  const kurallarBaslik = t("Dergi yazım kuralları", "Journal author guidelines");
  if (!profil.hedef_dergi?.trim()) {
    maddeler.push({
      anahtar: "dergi",
      baslik: t("Hedef dergi", "Target journal"),
      durum: "eksik",
      aciklama: t("Hedef dergi seçilmedi. Yazım kuralları, sınırlar ve makale türleri dergiye göre değişir.", "No target journal selected. Author guidelines, limits and article types vary by journal."),
    });
  } else if (!profil.dergi_kurallari_kontrol) {
    maddeler.push({
      anahtar: "dergi",
      baslik: kurallarBaslik,
      durum: "eksik",
      aciklama: t(
        "Derginin güncel yazım kurallarını kendi sayfasından kontrol edip kontrol tarihini girin. ArvoLab dergi bilgilerini doğrulamıyor.",
        "Check the journal's current author guidelines on its own website and enter the date you checked them. ArvoLab does not verify journal information.",
      ),
    });
  } else {
    const gun = Math.floor((Date.parse(girdi.bugun) - Date.parse(profil.dergi_kurallari_kontrol)) / GUN_MS);
    const gecen = Math.max(gun, 0);
    maddeler.push(
      gun > DERGI_KONTROL_GUN
        ? {
            anahtar: "dergi",
            baslik: kurallarBaslik,
            durum: "dikkat",
            aciklama: en
              ? `You checked the guidelines ${gun} days ago. Journal information can change; check again before submitting.`
              : `Kuralları ${gun} gün önce kontrol ettiniz. Dergi bilgileri değişebilir; gönderimden önce yeniden kontrol edin.`,
          }
        : {
            anahtar: "dergi",
            baslik: kurallarBaslik,
            durum: "tamam",
            aciklama: en
              ? `You checked the guidelines ${gecen} ${gecen === 1 ? "day" : "days"} ago (as you reported; ArvoLab did not verify this).`
              : `Kuralları ${gecen} gün önce kontrol ettiniz (sizin beyanınız; ArvoLab doğrulamadı).`,
          },
    );
  }

  // Raporlama standardı.
  if (tur.standartlar.length) {
    const standartBaslik = t("Raporlama standardı", "Reporting guideline");
    const adlar = tur.standartlar.map((s) => s.ad).join(", ");
    maddeler.push(
      profil.raporlama_standardi?.trim()
        ? { anahtar: "standart", baslik: standartBaslik, durum: "tamam", aciklama: en ? `${profil.raporlama_standardi} selected. ${uyari}` : `${profil.raporlama_standardi} seçildi. ${uyari}` }
        : {
            anahtar: "standart",
            baslik: standartBaslik,
            durum: "dikkat",
            aciklama: en ? `Guidelines that may be relevant for this article type: ${adlar}. ${uyari}` : `Bu tür için ilgili olabilecek standartlar: ${adlar}. ${uyari}`,
          },
    );
  }

  // Veri ve analiz durumu.
  if ((profil.makale_turu === "ozgun" || profil.makale_turu === "meta_analiz" || profil.makale_turu === "teknik") && profil.veri_durumu !== "analiz_edildi" && profil.veri_durumu !== "gerekmiyor") {
    maddeler.push({
      anahtar: "veri",
      baslik: t("Veri ve analiz", "Data and analysis"),
      durum: "dikkat",
      aciklama: t(
        "Analiz henüz tamamlanmamış görünüyor. Bulgular bölümü yalnızca gerçek analiz çıktılarına dayanmalı; tahmini sonuç yazılmamalı.",
        "The analysis does not appear to be complete yet. The Results section must rest only on actual analysis output; do not write estimated results.",
      ),
    });
  }

  // Kanıt matrisi.
  const kanitBaslik = t("Kanıt matrisi", "Evidence matrix");
  if (!kanit.toplam) {
    maddeler.push({
      anahtar: "kanit",
      baslik: kanitBaslik,
      durum: "bilgi",
      aciklama: t("Matriste iddia yok. Makalenin temel iddialarını ekleyip kaynaklarıyla eşleştirin.", "The matrix has no claims. Add the article's key claims and match them with their sources."),
    });
  } else {
    const sorunlar = (
      en
        ? [
            kanit.celisen ? `${kanit.celisen} with contradicting evidence` : "",
            kanit.zayif ? `${kanit.zayif} only partially or indirectly supported` : "",
            kanit.degerlendirilmemis ? `${kanit.degerlendirilmemis} not assessed or could not be verified` : "",
            kanit.kunyeSorunlu ? `${kanit.kunyeSorunlu} ${kanit.kunyeSorunlu === 1 ? "source" : "sources"} with a citation-details problem` : "",
            kanit.incelemeBekleyen ? `${kanit.incelemeBekleyen} ${kanit.incelemeBekleyen === 1 ? "record" : "records"} awaiting human review` : "",
          ]
        : [
            kanit.celisen ? `${kanit.celisen} iddiada çelişen kanıt` : "",
            kanit.zayif ? `${kanit.zayif} iddia yalnızca kısmen ya da dolaylı destekleniyor` : "",
            kanit.degerlendirilmemis ? `${kanit.degerlendirilmemis} iddia değerlendirilmedi ya da doğrulanamadı` : "",
            kanit.kunyeSorunlu ? `${kanit.kunyeSorunlu} kaynakta künye sorunu` : "",
            kanit.incelemeBekleyen ? `${kanit.incelemeBekleyen} kayıt insan incelemesi bekliyor` : "",
          ]
    ).filter(Boolean);
    maddeler.push(
      sorunlar.length
        ? {
            anahtar: "kanit",
            baslik: kanitBaslik,
            durum: kanit.celisen ? "eksik" : "dikkat",
            aciklama: en ? `Of ${kanit.toplam} ${kanit.toplam === 1 ? "claim" : "claims"}: ${sorunlar.join(", ")}.` : `${kanit.toplam} iddiadan ${sorunlar.join(", ")}.`,
          }
        : {
            anahtar: "kanit",
            baslik: kanitBaslik,
            durum: "tamam",
            aciklama: en ? `All ${kanit.toplam} ${kanit.toplam === 1 ? "claim was" : "claims were"} reviewed and are directly supported.` : `${kanit.toplam} iddianın tamamı incelendi ve doğrudan destekleniyor.`,
          },
    );
  }

  return maddeler;
}
