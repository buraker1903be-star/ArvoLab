/*
  Kılavuzun künyesi: sürüm, yürürlük tarihi ve tez sayfa sınırı.

  Bu üç alan (version_label, effective_from, min_pages/max_pages) şemada
  vardı ama hiçbir zaman otomatik doldurulmuyordu. Sonuçları:

  - Sürüm takibi tamamen dosya özetine (checksum) bağlıydı. Kurum aynı
    belgeyi yeniden kaydettiğinde özet değişiyor ve "yeni sürüm algılandı"
    yanlış pozitifi üretiliyordu; gerçek bir sürüm değişikliğiyle ayırt
    edilemiyordu.
  - Sayfa sınırı boş kaldığı için teslim kontrolündeki sayfa uyarısı
    (lib/submission-checklist.ts) hiçbir çalışmada çalışmıyordu.

  YANLIŞ POZİTİF RİSKİ BURADA YÜKSEK. "Özet en fazla 2 sayfa olmalıdır"
  cümlesi tezin sınırı değildir; kabul edilirse her öğrenciye "teziniz 2
  sayfayı aştı" denirdi. Bu yüzden sayfa sınırı yalnızca cümlede tezden söz
  ediliyorsa ve yakınında özet/kaynakça/ek gibi bir bölüm adı yoksa kabul
  edilir. Emin olunamayan yerde null dönmek doğrudur.

  Saf modül; testi tests/unit/kilavuz-kunyesi.test.ts.
*/

import { SOZCUK_BASI, SOZCUK_SONU } from "@/lib/sozcuk-siniri";

export type SayfaSiniri = { enAz: number | null; enFazla: number | null };

/*
  Sayfa sınırı, tezin BÜTÜNÜ için verilmiş olmalı. Bu adlardan biri
  yakındaysa sınır başka bir bölüme aittir (özetin, kaynakçanın, ekin
  sayfa sınırı) ve tezin sınırı sayılamaz.
*/
const BASKA_BOLUM = /(özet|abstract|kaynakça|kaynaklar|ek(?:ler)?|tablo|şekil|dipnot|kapak|içindekiler|makale|bildiri|poster)/iu;

/** Akla yatkın tez uzunluğu; dışındaki sayı başka bir şeyi ölçüyordur. */
const EN_KUCUK_SAYFA = 10;
const EN_BUYUK_SAYFA = 1500;

const gecerliSayfa = (deger: string | undefined) => {
  if (!deger) return null;
  const sayi = Number(deger);
  return Number.isInteger(sayi) && sayi >= EN_KUCUK_SAYFA && sayi <= EN_BUYUK_SAYFA ? sayi : null;
};

/** Cümlenin tezin bütününden söz edip etmediği. */
// \b yerine SOZCUK_BASI: "çalışma" Türkçe harfle başladığı için \b onu hiç
// yakalamıyordu, yani "bu çalışma…" diye başlayan kılavuz cümleleri tezle
// ilgisiz sayılıp atlanıyordu (lib/sozcuk-siniri.ts).
const TEZDEN_SOZ = new RegExp(`${SOZCUK_BASI}(?:tez|çalışma|metin)\\p{L}*`, "iu");
const tezdenSozEdiyor = (cumle: string) => TEZDEN_SOZ.test(cumle);

/**
 * Tez sayfa sınırı; bulunamazsa null.
 *
 * Metin cümlelere bölünüp her cümle ayrı değerlendirilir: sınırın hangi
 * bölüme ait olduğu ancak kendi cümlesinden anlaşılır.
 */
export function sayfaSiniriCikar(metin: string): SayfaSiniri {
  const duz = metin.replace(/\s+/g, " ");
  let enAz: number | null = null;
  let enFazla: number | null = null;

  for (const cumle of duz.split(/(?<=[.;:!?])\s+/)) {
    if (!tezdenSozEdiyor(cumle) || BASKA_BOLUM.test(cumle)) continue;
    if (!/sayfa/iu.test(cumle)) continue;

    // "50-150 sayfa arasında", "50 ile 150 sayfa arası"
    const aralik = /(\d{2,4})\s*(?:-|–|ile|ila)\s*(\d{2,4})\s*sayfa/iu.exec(cumle);
    if (aralik) {
      const alt = gecerliSayfa(aralik[1]);
      const ust = gecerliSayfa(aralik[2]);
      if (alt !== null && ust !== null && alt < ust) {
        enAz ??= alt;
        enFazla ??= ust;
        continue;
      }
    }

    // "en az 50 sayfa", "asgari 50 sayfa"
    const altSinir = /(?:en\s+az|asgari|minimum)\s+(\d{2,4})\s*sayfa/iu.exec(cumle);
    if (altSinir) enAz ??= gecerliSayfa(altSinir[1]);

    // "en fazla/en çok/azami 150 sayfa"
    const ustSinir = /(?:en\s+(?:fazla|çok)|azami|maksimum)\s+(\d{2,4})\s*sayfa/iu.exec(cumle);
    if (ustSinir) enFazla ??= gecerliSayfa(ustSinir[1]);

    /*
      "sayfa sayısı 150'yi geçemez" ve "150 sayfayı aşmamalıdır" — sayı
      "sayfa" sözcüğünün iki yanında da durabiliyor, iki sıra da aranır.
    */
    const gecemezOnce = /sayfa\s*(?:sayısı)?[^.;]{0,30}?(\d{2,4})['’]?\p{L}*\s*(?:geç|aş)\p{L}*(?:mez|maz|memeli|mamalı)/iu.exec(cumle);
    const gecemezSonra = /(\d{2,4})\s*sayfa\p{L}*\s*(?:geç|aş)\p{L}*(?:mez|maz|memeli|mamalı)/iu.exec(cumle);
    const gecemez = gecemezOnce ?? gecemezSonra;
    if (gecemez) enFazla ??= gecerliSayfa(gecemez[1]);
  }

  /*
    Çelişkili sınır (alt > üst) kabul edilmez: ikisinden hangisinin yanlış
    okunduğu bilinemez, tahmin etmek yanlış uyarı üretir.
  */
  if (enAz !== null && enFazla !== null && enAz >= enFazla) return { enAz: null, enFazla: null };
  return { enAz, enFazla };
}

const AYLAR = [
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
  "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık",
];

/**
 * Sürüm etiketi; bulunamazsa null.
 *
 * Önce açık bir sürüm numarası ("Sürüm 2.1", "v3"), yoksa kapaktaki
 * ay+yıl ("Ocak 2016") kullanılır. Kılavuzlarda sürüm çoğu zaman
 * numarayla değil basım tarihiyle belirtiliyor.
 *
 * Yalnızca belgenin BAŞINA bakılır: gövdede geçen tarihler örnek
 * kaynakça künyeleridir, kılavuzun sürümü değil.
 */
export function surumEtiketiCikar(metin: string): string | null {
  const kapak = metin.slice(0, 3000).replace(/\s+/g, " ");

  const surum = /(?:sürüm|versiyon|revizyon|rev\.?)\s*[:\-]?\s*(\d+(?:\.\d+)*)/iu.exec(kapak);
  if (surum) return `Sürüm ${surum[1]}`;

  // "V2", "v1.3" — başında harf olmamalı ki "TEZ V2" yakalansın, "DEV2" değil.
  const kisaSurum = /(?:^|[^\p{L}\d])v\.?\s?(\d+(?:\.\d+)*)(?![\p{L}\d])/iu.exec(kapak);
  if (kisaSurum) return `Sürüm ${kisaSurum[1]}`;

  // On iki aydan yalnızca "şubat" Türkçe harfle başlıyor ve \b tam onu
  // kaçırıyordu: Şubat'ta yayımlanmış bir kılavuzun tarihi hiç okunmuyordu.
  const ayYil = new RegExp(
    `${SOZCUK_BASI}(${AYLAR.join("|")})[,\\s]+((?:19|20)\\d{2})${SOZCUK_SONU}`,
    "iu",
  ).exec(kapak);
  if (ayYil) {
    const ay = ayYil[1].toLocaleLowerCase("tr-TR");
    return `${ay.charAt(0).toLocaleUpperCase("tr-TR")}${ay.slice(1)} ${ayYil[2]}`;
  }

  const yil = /\b((?:19|20)\d{2})\b/.exec(kapak);
  return yil ? yil[1] : null;
}

/**
 * Yürürlük tarihi (ISO yyyy-mm-dd); bulunamazsa null.
 *
 * Senato/yönetim kurulu kararı tarihi aranır: kılavuzun ne zaman geçerli
 * olduğunu söyleyen tek açık ifade budur. Örnek (Gazi kılavuzu):
 * "Üniversitemiz senatosunun 25.03.2014 tarihli toplantısında alınan …"
 */
export function yururlukTarihiCikar(metin: string): string | null {
  const kapak = metin.slice(0, 4000).replace(/\s+/g, " ");
  const desen = /(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})[^.;]{0,80}?(?:tarihli|tarihinde|yürürlü|kabul\s+edil|senato|karar)/iu;
  const tersDesen = /(?:tarihli|tarihinde|yürürlü|kabul\s+edil|senato|karar)\p{L}*[^.;]{0,80}?(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)\d{2})/iu;

  const eslesme = desen.exec(kapak) ?? tersDesen.exec(kapak);
  if (!eslesme) return null;

  const gun = Number(eslesme[1]);
  const ay = Number(eslesme[2]);
  const yil = Number(eslesme[3]);
  // Gün/ay sırası Türkçe metinde gg.aa.yyyy; geçersiz değer tahmin edilmez.
  if (gun < 1 || gun > 31 || ay < 1 || ay > 12) return null;
  return `${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}`;
}
