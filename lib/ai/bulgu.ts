/*
  Asistanın her yeteneğinin ortak çıktısı: bulgu listesi.

  Yetenekler yalnızca sistem istemiyle ve topladıkları bağlamla ayrışır;
  yanıtın biçimi, çözümlenmesi ve uydurma sayı denetimi hepsinde aynıdır.
  Bu dosya o ortak kısmı tutar — ikinci yetenek yazılırken analiz denetiminin
  çözümleyicisi kopyalanacaktı, kopya da ilk düzeltmede ayrışırdı.

  Saf modül; testi tests/unit/ai-analiz-yorumu.test.ts.
*/

import { uydurmaSayilar, uydurmaYaziylaSayilarDilde, yapisalTuretilmis } from "./sayi-denetimi";
import type { Dil } from "@/lib/dil";
import { SOZCUK_BASI } from "@/lib/sozcuk-siniri";

export type BulguTuru = "uyari" | "oneri" | "bilgi";
export type Bulgu = { tur: BulguTuru; baslik: string; aciklama: string };

const EN_FAZLA_BULGU = 12;

/** Her yeteneğin sistem isteminin sonuna eklenen ortak yanıt sözleşmesi. */
export const YANIT_BICIMI = `YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"bulgular":[{"tur":"uyari","baslik":"kısa başlık","aciklama":"tek paragraf açıklama"}]}
- "tur": ciddi bir hata/eksik için "uyari", iyileştirme için "oneri", yalnızca dikkat çekmek için "bilgi".
- "baslik": en fazla 60 karakter.
- "aciklama": en fazla 400 karakter, Türkçe, hazır cümle içermez.
- En fazla 8 bulgu. Denetlenecek bir şey bulamazsan boş dizi döndür.`;

/*
  ÇIKTI DİLİ (28.10.2026, lib/dil.ts). İstemler Türkçe kalıyor (AGENTS.md);
  İngilizce arayüzdeki kullanıcı için yalnızca bulguların DİLİ değişiyor.
  Talimat ayrı bir sistem mesajı: istemin kendisine dokunmadan eklenip
  çıkarılabiliyor ve YANIT_BICIMI'ndeki "Türkçe" sözünün önüne geçiyor.
  JSON alan adları ve "tur" değerleri değişmez — çözümleyici onları okuyor.
*/
export const INGILIZCE_CIKTI = `ÇIKTI DİLİ: Kullanıcı İngilizce arayüz kullanıyor. "baslik" ve "aciklama" alanlarını (ve varsa öteki serbest metin alanlarını) akademik İNGİLİZCE yaz; yukarıda "Türkçe" yazan yer bu talimatla değişti. JSON alan adlarını ve "tur" değerlerini ("uyari", "oneri", "bilgi") DEĞİŞTİRME. Öteki bütün kurallar aynen geçerli: hazır cümle yok, verilmeyen sayı yok, kaynak künyesi yok.`;

/** Sistem mesajlarına, kullanıcının diline göre çıktı dili talimatı ekler. */
export function cikisDiliMesaji(dil: Dil | undefined): { rol: "sistem"; metin: string }[] {
  return dil === "en" ? [{ rol: "sistem", metin: INGILIZCE_CIKTI }] : [];
}

/*
  Kaydedilen bağlam dile göre ayrışsın (28.10.2026). Önceki cevap
  önbelleği (lib/ai/gecmis.ts, oncekiCevap) bağlamın metniyle eşleşiyor;
  dil bağlamda olmadığı için Türkçe sorulmuş bir analiz İngilizce arayüzde
  aynı Türkçe cevabı geri getiriyordu. İşaret yalnızca KAYDEDİLEN ve
  doğrulamada kullanılan metne ekleniyor, modele gönderilene değil; içinde
  rakam olmadığı için sayı denetimini etkilemiyor.
*/
export function dilliKaynak(metin: string, dil: Dil | undefined): string {
  return dil === "en" ? `${metin}\n\n[çıktı dili: İngilizce]` : metin;
}

/*
  Yanıttaki JSON'u okur. İki gerçek sorunu çözüyor:

  1. Model JSON'u kod çitiyle ya da açıklama cümlesiyle sarabiliyor; sıkı bir
     JSON.parse tek fazladan kelimede bütün cevabı çöpe atıyordu.
  2. Yanıt jeton sınırında KESİLEBİLİYOR. Canlıda (20.09.2026) claude-sonnet-5
     üç bulgunun ikisini eksiksiz yazdı, üçüncüsünün ortasında kesildi; JSON
     kapanmadığı için üçü birden atıldı ve kullanıcı "denetlenebilir bir yapı
     bulamadı" gördü. Tamamlanmış bulguları atmanın anlamı yok: son tam
     nesneye kadar kırpılıp dizi kapatılıyor.
*/
export function jsonOku(ham: string): unknown {
  const bas = ham.indexOf("{");
  const son = ham.lastIndexOf("}");
  if (bas === -1 || son <= bas) return null;

  const golge = ham.slice(bas, son + 1);
  try {
    return JSON.parse(golge);
  } catch {
    // Kesik yanıt: golge son TAM nesnede bitiyor, geriye diziyi ve kök
    // nesneyi kapatmak kalıyor.
    for (const kapanis of ["]}", "}]}"]) {
      try {
        return JSON.parse(golge + kapanis);
      } catch {
        continue;
      }
    }
    return null;
  }
}

function kirp(deger: unknown, sinir: number) {
  return String(deger ?? "").replace(/\s+/g, " ").trim().slice(0, sinir);
}

/**
 * Model bilerek BOŞ liste mi döndürdü ({"bulgular": []})? İstemler "sorun
 * yoksa boş liste" diyor. Eskiden boş liste okunamayan yanıtla aynı dala
 * düşüyordu: temiz bir çıktı yapıştıran öğrenci "denetlenebilir bir yapı
 * bulamadı" hatası görüyor, kayıt da "rejected/bos" olarak eğitim verisine
 * yanlış etiketle giriyordu.
 */
export function bosListeMi(ham: string): boolean {
  const liste = (jsonOku(ham) as { bulgular?: unknown } | null)?.bulgular;
  return Array.isArray(liste) && liste.length === 0;
}

/** Modelin yanıtını bulgulara çevirir (kesik yanıt dahil, bkz. jsonOku). */
export function bulgulariCozumle(ham: string): Bulgu[] {
  const liste = (jsonOku(ham) as { bulgular?: unknown } | null)?.bulgular;
  if (!Array.isArray(liste)) return [];

  return liste
    .map((satir) => {
      const row = (satir ?? {}) as Record<string, unknown>;
      const tur = String(row.tur ?? "");
      return {
        tur: (tur === "uyari" || tur === "oneri" ? tur : "bilgi") as BulguTuru,
        baslik: kirp(row.baslik, 60),
        aciklama: kirp(row.aciklama, 400),
      };
    })
    .filter((bulgu) => bulgu.baslik && bulgu.aciklama)
    .slice(0, EN_FAZLA_BULGU);
}

/*
  Künye izi: modelin ürettiği metinde kaynak künyesi (Yazar, A. (2020))
  geçiyor mu? Asistanın en zararlı hatası uydurma kaynak önermektir; istemde
  yasak ama kodda da bakılır (AGENTS.md: "Asistan kaynak önermez").

  Burada duruyor çünkü artık iki yetenek kullanıyor: literatür taraması
  (bulgu listesi üzerinde) ve belge geri bildirimi (düz metin üzerinde).
  Regex tek yerde kalsın; kopyası ilk düzeltmede ayrışırdı.
*/
/*
  Sözcük başı \b ile aranıyordu ve JavaScript'te \b ASCII tabanlıdır: "Ş"
  sözcük karakteri sayılmadığı için ÖNÜNDE sınır oluşmuyor — ne satır
  başında ne boşluktan sonra. Sonuç, Türkçe bir üründe en pahalı türden
  sessiz açıktı: Şahin, Özdemir, Çelik, Ünal, İnce gibi Türkiye'nin en
  yaygın soyadlarıyla uydurulmuş künyeler denetimden hiç geçmiyordu.
  Yılmaz ve Demir yakalanıyordu, Şahin yakalanmıyordu.

  Harf kümesi artık Unicode özelliğiyle (\p{Lu}, \p{Ll}) tanımlı; elle
  sayılan bir alfabe hep eksik kalır. Sınır da \b yerine "önünde harf
  yok" olarak yazıldı.
*/
/*
  Yalnızca "Soyad, A. (2020)" biçimi aranıyordu (TEK baş harf, harfsiz
  yıl). En yaygın künye ve atıf biçimleri denetimden geçiyordu (29.10.2026):
  "Deci, E. L. (1985)", "Smith, J. (2020a)", "McDonald, R. (2018)",
  "Smith et al. (2020)", "Bandura (1977)", "(Yılmaz & Demir, 2020)" ve
  çıplak DOI. Literatür yeteneğinde sayı denetimi bilerek yok; bu biçimlerle
  uydurulmuş bir kaynak doğrudan öğrenciye ulaşıyordu.

  Soyadı küçük harfle BİTMEK zorunda: "TÜİK (2022)", "COVID (2020)",
  "APA (2020)" gibi kısaltmalar künye sayılmasın (yanlış alarm, kaçırılan
  uydurmadan sinsidir). Yıl parantezi hemen kapanmalı: "(2019 verisi)"
  künye değildir.
*/
const SOYAD = "\\p{Lu}[\\p{L}'’-]*\\p{Ll}";
const COK_YAZAR = "(?:et al\\.|vd\\.|ve ark\\.|ve diğerleri)";
const YIL = "\\d{4}[a-z]?";
const KUNYE_BICIMLERI = [
  // Kaynakça satırı: Deci, E. L. (1985)
  `${SOYAD},\\s*(?:\\p{Lu}\\.\\s*-?\\s*){1,3}\\(${YIL}\\)`,
  // Metin içi anlatı: Bandura (1977), Smith et al. (2020), Yılmaz ve Demir (2020)
  `${SOYAD}(?:\\s*(?:&|ve|and)\\s*${SOYAD})?(?:\\s+${COK_YAZAR})?\\s*\\(${YIL}\\)`,
  // Parantez içi: (Yılmaz, 2020), (Smith et al., 2020), (Yılmaz & Demir, 2020)
  `\\(${SOYAD}(?:\\s*(?:&|ve|and)\\s*${SOYAD})?(?:\\s+${COK_YAZAR})?,\\s*${YIL}`,
  // DOI
  `10\\.\\d{4,9}/[^\\s"<>]+`,
];
const KUNYE = new RegExp(`${SOZCUK_BASI}(?:${KUNYE_BICIMLERI.join("|")})`, "u");

export function kunyeIziMetinde(metin: string): boolean {
  return KUNYE.test(metin);
}

/*
  Girdide ZATEN geçen künye uydurma değildir. Kanıt değerlendirmesinde
  incelenen kaynak metni kendi atıflarını taşıyor ("… (Yılmaz, A. (2020))")
  ve asistanın bulgusunda o atfa değinmesi meşru; düz kunyeIziMetinde
  bunu da reddederdi. Burada yalnızca bağlamda GEÇMEYEN künye yakalanır.
  Literatür ve belge yetenekleri bilerek düz denetimi kullanıyor: onlara
  verilen bağlamda alıntılanacak bir kaynak metni yok.
*/
const KUNYE_HEPSI = new RegExp(KUNYE.source, "gu");

export function baglamDisiKunye(metin: string, kaynak: string): string[] {
  return [...metin.matchAll(KUNYE_HEPSI)].map((m) => m[0]).filter((kunye) => !kaynak.includes(kunye));
}

export type Dogrulama = { gecti: true } | { gecti: false; uydurulan: string[] };

export type DogrulamaSecenegi = {
  /** Doğrulanmış ek kaynaklar (ör. tespit edilen istatistiklerin APA karşılığı). */
  ekKaynaklar?: string[];
  /**
   * Yapısal türetmeler (sd, ikili karşılaştırma sayısı) kabul edilsin mi.
   * YALNIZCA analiz yeteneğinde; gerekçe ve bedeli sayi-denetimi.ts'te.
   */
  yapisalTuretme?: boolean;
  /** Çıktının dili: yazıyla sayılar bu dilin sözcükleriyle aranır (sayi-denetimi.ts). */
  dil?: Dil;
};

/**
 * Bulgularda gönderilen bağlamda geçmeyen sayı var mı? Varsa cevap
 * gösterilmez: hangi sayının uydurulduğunu kullanıcı ayıklayamaz, bir
 * kısmı doğru olan bir listeye güvenmek en tehlikelisidir.
 *
 * NEREDE UYGULANIR: denetim sayısal bir VERİ değeri taşıyorsa — analizde
 * p değeri ve etki büyüklüğü, kaynakçada yıl, cilt, sayfa. Literatür
 * tavsiyesinde böyle bir değer yoktur; oradaki sayılar "COVID-19",
 * "2000'ler", "son 15-20 yıl" gibi alan bilgisidir ve canlıda (20.09.2026)
 * kusursuz iki tarama stratejisini üst üste düşürdü. Oraya muafiyet
 * eklemek yerine denetim hiç uygulanmıyor; literatürün asıl riski uydurma
 * KAYNAK ve onu kunyeIzi yakalıyor.
 */
export function bulgulariDogrula(bulgular: Bulgu[], kaynak: string, secenek: DogrulamaSecenegi = {}): Dogrulama {
  const cikti = bulgular.map((b) => `${b.baslik} ${b.aciklama}`).join("\n");
  /*
    İKİ YAZIM DA DENETLENİYOR (25.10.2026). Denetim yalnızca RAKAMI
    yakalıyordu: asistan "yaklaşık yirmi kişi" ya da "üç yüz
    katılımcı" yazdığında girdide böyle bir sayı olmasa bile cevap
    geçiyordu. Rakamla yazılanı elemek, yazıyla yazılana kapıyı
    açık bırakmak anlamına geliyordu.

    Yazı denetimi DAR: tetikleyici sözcük ondan büyük olmalı, çünkü
    "bir" ve "iki" Türkçede belirteç olarak da geçiyor (gerekçe
    sayi-denetimi.ts'te). Bedeli orada açıkça yazılı.
  */
  const ek = secenek.ekKaynaklar ?? [];
  const turetilmis = secenek.yapisalTuretme ? [yapisalTuretilmis([kaynak, ...ek]).join(" ")] : [];
  const uydurulan = [
    ...uydurmaSayilar(cikti, kaynak, ...ek, ...turetilmis),
    ...uydurmaYaziylaSayilarDilde(secenek.dil ?? "tr", cikti, kaynak, ...ek, ...turetilmis),
  ];
  return uydurulan.length ? { gecti: false, uydurulan } : { gecti: true };
}
