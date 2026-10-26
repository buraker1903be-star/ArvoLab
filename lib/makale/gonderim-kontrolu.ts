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

import { MAKALE_TURLERI, STANDART_UYARISI, bolumAdi, type MakaleTuru } from "./sablonlar";
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

export function gonderimKontrolu(girdi: {
  profil: MakaleProfili;
  bolumler: MakaleBolumu[];
  kanit: MatrisOzeti;
  /** "YYYY-AA-GG" ya da ISO; testlerde sabitlenebilsin diye dışarıdan. */
  bugun: string;
}): KontrolMaddesi[] {
  const { profil, bolumler, kanit } = girdi;
  const tur = MAKALE_TURLERI[profil.makale_turu];
  const maddeler: KontrolMaddesi[] = [];

  maddeler.push(
    profil.arastirma_sorusu?.trim()
      ? { anahtar: "soru", baslik: "Araştırma sorusu", durum: "tamam", aciklama: "Araştırma sorusu tanımlı; sonuç bölümünün bu soruya döndüğünü kontrol edin." }
      : { anahtar: "soru", baslik: "Araştırma sorusu", durum: "eksik", aciklama: "Araştırma sorusu girilmedi. Bölüm denetimi ve sonuç–soru ilişkisi buna göre kuruluyor." },
  );

  // Planda olup metinde olmayan bölümler.
  const metindeki = new Set(bolumler.map((b) => b.tur).filter(Boolean));
  const eksikBolumler = tur.bolumler.filter((b) => b !== "ozet" && !metindeki.has(b));
  maddeler.push(
    eksikBolumler.length
      ? {
          anahtar: "bolumler",
          baslik: "Bölüm planı",
          durum: "dikkat",
          aciklama: `Şablonda olup müsveddede başlık olarak bulunamayan bölümler: ${eksikBolumler.map((b) => bolumAdi(b, profil.dil)).join(", ")}. Hedef dergi farklı bir düzen istiyorsa dergi talimatı geçerlidir.`,
        }
      : { anahtar: "bolumler", baslik: "Bölüm planı", durum: "tamam", aciklama: "Şablondaki bütün bölümler müsveddede başlık olarak var." },
  );

  // Kelime sınırı.
  const anaMetin = anaMetinSozcukSayisi(bolumler);
  if (profil.kelime_siniri) {
    const asim = anaMetin - profil.kelime_siniri;
    maddeler.push({
      anahtar: "kelime",
      baslik: "Kelime sınırı",
      durum: asim > 0 ? "eksik" : "tamam",
      aciklama:
        (asim > 0
          ? `Ana metin yaklaşık ${anaMetin} sözcük; sınır ${profil.kelime_siniri}, yaklaşık ${asim} sözcük fazla.`
          : `Ana metin yaklaşık ${anaMetin} sözcük; sınır ${profil.kelime_siniri}.`) +
        " Özet ve kaynakça hariç sayıldı; derginin sayma kuralını kontrol edin.",
    });
  } else {
    maddeler.push({ anahtar: "kelime", baslik: "Kelime sınırı", durum: "bilgi", aciklama: `Ana metin yaklaşık ${anaMetin} sözcük. Hedef derginin sınırını girerseniz karşılaştırılır.` });
  }

  // Özet.
  const ozetSozcuk = sozcukSayisi(profil.ozet ?? "");
  if (!ozetSozcuk) {
    maddeler.push({ anahtar: "ozet", baslik: "Özet", durum: "eksik", aciklama: "Özet girilmedi." });
  } else if (profil.ozet_siniri && ozetSozcuk > profil.ozet_siniri) {
    maddeler.push({ anahtar: "ozet", baslik: "Özet", durum: "eksik", aciklama: `Özet ${ozetSozcuk} sözcük; sınır ${profil.ozet_siniri}.` });
  } else {
    maddeler.push({
      anahtar: "ozet",
      baslik: "Özet",
      durum: profil.ozet_siniri ? "tamam" : "bilgi",
      aciklama: profil.ozet_siniri ? `Özet ${ozetSozcuk} sözcük; sınır ${profil.ozet_siniri}.` : `Özet ${ozetSozcuk} sözcük. Derginin özet sınırını girerseniz karşılaştırılır.`,
    });
  }

  // Anahtar kelimeler.
  const anahtar = profil.anahtar_kelimeler.filter((k) => k.trim()).length;
  const enAz = profil.anahtar_en_az;
  const enCok = profil.anahtar_en_cok;
  if (!anahtar) maddeler.push({ anahtar: "anahtar", baslik: "Anahtar kelimeler", durum: "eksik", aciklama: "Anahtar kelime girilmedi." });
  else if ((enAz && anahtar < enAz) || (enCok && anahtar > enCok))
    maddeler.push({ anahtar: "anahtar", baslik: "Anahtar kelimeler", durum: "eksik", aciklama: `${anahtar} anahtar kelime var; dergi ${[enAz ? `en az ${enAz}` : "", enCok ? `en çok ${enCok}` : ""].filter(Boolean).join(", ")} istiyor.` });
  else maddeler.push({ anahtar: "anahtar", baslik: "Anahtar kelimeler", durum: enAz || enCok ? "tamam" : "bilgi", aciklama: `${anahtar} anahtar kelime.` });

  // Dergi kuralları: doğrulanmıyor, kontrol tarihi hatırlatılıyor.
  if (!profil.hedef_dergi?.trim()) {
    maddeler.push({ anahtar: "dergi", baslik: "Hedef dergi", durum: "eksik", aciklama: "Hedef dergi seçilmedi. Yazım kuralları, sınırlar ve makale türleri dergiye göre değişir." });
  } else if (!profil.dergi_kurallari_kontrol) {
    maddeler.push({ anahtar: "dergi", baslik: "Dergi yazım kuralları", durum: "eksik", aciklama: "Derginin güncel yazım kurallarını kendi sayfasından kontrol edip kontrol tarihini girin. ArvoLab dergi bilgilerini doğrulamıyor." });
  } else {
    const gun = Math.floor((Date.parse(girdi.bugun) - Date.parse(profil.dergi_kurallari_kontrol)) / GUN_MS);
    maddeler.push(
      gun > DERGI_KONTROL_GUN
        ? { anahtar: "dergi", baslik: "Dergi yazım kuralları", durum: "dikkat", aciklama: `Kuralları ${gun} gün önce kontrol ettiniz. Dergi bilgileri değişebilir; gönderimden önce yeniden kontrol edin.` }
        : { anahtar: "dergi", baslik: "Dergi yazım kuralları", durum: "tamam", aciklama: `Kuralları ${Math.max(gun, 0)} gün önce kontrol ettiniz (sizin beyanınız; ArvoLab doğrulamadı).` },
    );
  }

  // Raporlama standardı.
  if (tur.standartlar.length) {
    maddeler.push(
      profil.raporlama_standardi?.trim()
        ? { anahtar: "standart", baslik: "Raporlama standardı", durum: "tamam", aciklama: `${profil.raporlama_standardi} seçildi. ${STANDART_UYARISI}` }
        : { anahtar: "standart", baslik: "Raporlama standardı", durum: "dikkat", aciklama: `Bu tür için ilgili olabilecek standartlar: ${tur.standartlar.map((s) => s.ad).join(", ")}. ${STANDART_UYARISI}` },
    );
  }

  // Veri ve analiz durumu.
  if ((profil.makale_turu === "ozgun" || profil.makale_turu === "meta_analiz" || profil.makale_turu === "teknik") && profil.veri_durumu !== "analiz_edildi" && profil.veri_durumu !== "gerekmiyor") {
    maddeler.push({ anahtar: "veri", baslik: "Veri ve analiz", durum: "dikkat", aciklama: "Analiz henüz tamamlanmamış görünüyor. Bulgular bölümü yalnızca gerçek analiz çıktılarına dayanmalı; tahmini sonuç yazılmamalı." });
  }

  // Kanıt matrisi.
  if (!kanit.toplam) {
    maddeler.push({ anahtar: "kanit", baslik: "Kanıt matrisi", durum: "bilgi", aciklama: "Matriste iddia yok. Makalenin temel iddialarını ekleyip kaynaklarıyla eşleştirin." });
  } else {
    const sorunlar = [
      kanit.celisen ? `${kanit.celisen} iddiada çelişen kanıt` : "",
      kanit.zayif ? `${kanit.zayif} iddia yalnızca kısmen ya da dolaylı destekleniyor` : "",
      kanit.degerlendirilmemis ? `${kanit.degerlendirilmemis} iddia değerlendirilmedi ya da doğrulanamadı` : "",
      kanit.kunyeSorunlu ? `${kanit.kunyeSorunlu} kaynakta künye sorunu` : "",
      kanit.incelemeBekleyen ? `${kanit.incelemeBekleyen} kayıt insan incelemesi bekliyor` : "",
    ].filter(Boolean);
    maddeler.push(
      sorunlar.length
        ? { anahtar: "kanit", baslik: "Kanıt matrisi", durum: kanit.celisen ? "eksik" : "dikkat", aciklama: `${kanit.toplam} iddiadan ${sorunlar.join(", ")}.` }
        : { anahtar: "kanit", baslik: "Kanıt matrisi", durum: "tamam", aciklama: `${kanit.toplam} iddianın tamamı incelendi ve doğrudan destekleniyor.` },
    );
  }

  return maddeler;
}
