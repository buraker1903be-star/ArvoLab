/*
  Asistanın uydurma sayı üretmediğini kodla doğrular. Saf modül; testi
  tests/unit/ai-sayi-denetimi.test.ts.

  Dil modelleri akıcı ama uydurur: istemediğiniz yerde "p = .03" ya da
  "%68'i" gibi olmayan bir değer yazabilir. Akademik bir metinde uydurma
  sayı, yanlış cümleden daha ağır bir hatadır. Bu yüzden asistanın çıktısında
  geçen her sayı, kullanıcının verdiği girdide de geçmek zorunda; geçmiyorsa
  cevap kullanıcıya gösterilmez.

  Serbest bırakılan değerler ve BEDELİ aşağıda (SERBEST): yalnızca eşikler
  ve madde numaraları değil, "95" ile "100" de listede. Bu bilinçli bir
  denge ve bedeli var — aşağıda tek tek yazılı.
*/

import type { Dil } from "@/lib/dil";

/*
  APA'da "F(2,57)" İKİ serbestlik derecesidir, "2,57" ondalığı değil. Türkçe
  ondalık ayırıcısı virgül olduğu için ayrıştırıcı bunu 2.57 diye okuyordu:
  girdide "F(2, 57)" boşluklu yazıldığından 2 ve 57 çıkıyor, asistan aynı
  şeyi boşluksuz yazınca uydurma sayı sanılıp cevabın tamamı atılıyordu
  (canlıda 20.09.2026). Yalnızca test adından hemen sonra gelen parantez
  içinde uygulanır; "(p = 0,021)" gibi gerçek ondalıklara dokunmaz.
*/
const SERBESTLIK_DERECESI = /([FtχΧ]\s*²?\s*\(\s*\d+)\s*,\s*(?=\d)/g;

/*
  Standart ve sürüm adları sayısal iddia değildir: "APA 7" kuralın adıdır.
  Canlıda (20.09.2026) doğru çalışan bir denetim yalnızca bu yüzden tümden
  atıldı.
*/
const STANDART_ADI = /\b(APA|MLA|IEEE|Vancouver|Chicago|Tip|Tür)\s*\d+/gi;

/** Metindeki sayısal değerler; "χ²(1, N = 120) = 6.14" → 1, 120, 6.14 */
export function sayilar(metin: string): string[] {
  /*
    İki rakamın arasındaki tire eksi işareti değil, aralıktır: "45-72" iki
    sayıdır (45 ve 72), "-72" değil. Kaynakçada sayfa aralıkları böyle
    yazılıyor ve APA kısa çizgi yerine kısa tire (–) tercih ediyor; ikisini
    ayrı okusaydık, asistan aralığı "45–72" diye yazdığında girdideki
    "45-72" ile eşleşmiyor, doğru cevap uydurma sanılıp atılıyordu.
  */
  const duz = metin.replace(/[\u2010-\u2015]/g, "-").replace(SERBESTLIK_DERECESI, "$1; ");
  // ".05" gibi baştaki sıfırı yazılmayan değerler de yakalanır (APA'da yaygın).
  return [...duz.matchAll(/-?(?:\d+(?:[.,]\d+)?|[.,]\d+)/g)].map((eslesme) => {
    const ham = eslesme[0];
    const oncekiRakam = eslesme.index > 0 && /\d/.test(duz[eslesme.index - 1]);
    return normalize(ham.startsWith("-") && oncekiRakam ? ham.slice(1) : ham);
  });
}

/** "0,05" ve ".05" aynı sayıdır; baştaki sıfır ve virgül farkı silinir. */
function normalize(ham: string): string {
  const eksi = ham.startsWith("-");
  const sayi = ham.replace("-", "").replace(",", ".");
  const kisa = sayi.includes(".") ? sayi.replace(/^0+(?=\.)/, "").replace(/0+$/, "").replace(/\.$/, "") : sayi.replace(/^0+(?=\d)/, "");
  return (eksi ? "-" : "") + (kisa === "" ? "0" : kisa);
}

/*
  Girdide aranmayan değerler ve her birinin gerekçesi:

    .05 .01 .001  anlamlılık eşikleri. Her istatistik yorumunda geçer ve
                  kullanıcının çıktısında yazılı olmak zorunda değil.
    0 1 2 3 4 5   madde numarası ("1. …"), grup/koşul sayısı, tek haneli
                  sıra sayıları. -1 ise korelasyon alt sınırı.
    95            "%95 güven aralığı". Kullanıcı yalnızca "t(28) = 2.45,
                  p = .021" yapıştırdığında girdide 95 GEÇMEZ; serbest
                  olmasaydı standart bir güven aralığı cümlesi cevabın
                  tamamını düşürürdü.
    100           yüzde tabanı ("katılımcıların %100'ü", "100 üzerinden").

  BEDELİ açıkça: bu değerlerle kurulmuş bir UYDURMA kaçar. "Katılımcıların
  %95'i kadındır" ya da "100 katılımcıyla yapıldı" cümlesi, girdide 95/100
  geçmese bile denetimden geçer. Daraltmanın yolu bağlama bakmak olurdu
  ("%95 güven aralığı" serbest, "%95'i kadındır" değil) ama iki cümle de
  yüzde işareti taşıyor; ayırt edecek güvenilir bir desen yok ve yanlış
  alarm kaçırılan uydurmadan sinsidir (AGENTS.md) — kullanıcı doğru çalışan
  aracı kullanmayı bırakır.

    .1 .2 .3 .5   Cohen'in yerleşik eşikleri (28.10.2026): d için .2/.5/.8,
    .8 .06 .14    r için .1/.3/.5, η² için .01/.06/.14. "Etki küçük (d < .2)"
                  bir yorum ölçütüdür, veri değil; analiz asistanının istemi
                  etki büyüklüğünü yorumlamasını istiyor ve bu cümle canlıda
                  cevabın TAMAMINI düşürüyordu. Bedeli: tam olarak bu
                  değerlerle uydurulmuş bir etki büyüklüğü kaçar.

  Bu yüzden denge burada duruyor; değiştirilecekse gerekçesi bu paragrafın
  yerine yazılmalı. tests/unit/ai-sayi-denetimi.test.ts bedeli de sabitliyor.
*/
const SERBEST = new Set(["0", "1", "2", "3", "4", "5", ".05", ".01", ".001", "100", "95", "-1", ".1", ".2", ".3", ".5", ".8", ".06", ".14"]);

/*
  ORAN ↔ YÜZDE (28.10.2026). Girdide "η² = ,06" varken asistanın "varyansın
  %6'sı" yazması aynı değerin yüzde yazımı; eskiden ".06" ile "6" ayrı
  sayıldığı için cevap düşüyordu (canlıda 26.10.2026'da analiz asistanında
  "uydurulan: 6"). Yalnızca TAM dönüşüm kabul ediliyor: ".062" → "6.2",
  yuvarlanmış "6" değil — yuvarlamaya izin vermek her yakın sayıyı geçirirdi.
*/
function yuzdeKarsiliklari(degerler: string[]): string[] {
  return degerler.flatMap((d) => {
    const n = Number(d);
    if (!Number.isFinite(n) || Math.abs(n) >= 1 || n === 0) return [];
    return [normalize(String(Math.round(n * 100 * 1e6) / 1e6))];
  });
}

/**
 * Çıktıda geçip girdide geçmeyen sayılar. Boş dizi dönerse cevapta uydurma
 * sayı yoktur. `ekGirdiler` doğrulanmış kaynaklar içindir (ör. tespit edilen
 * istatistiklerin APA karşılıkları).
 */
export function uydurmaSayilar(cikti: string, girdi: string, ...ekGirdiler: string[]): string[] {
  const girdiSayilari = [...sayilar(girdi), ...ekGirdiler.flatMap(sayilar)];
  const bilinen = new Set([...girdiSayilari, ...yuzdeKarsiliklari(girdiSayilari)]);
  // Standart adları yalnızca çıktıda ayıklanır; girdide geçmesi zararsız.
  const temiz = cikti.replace(STANDART_ADI, " ");
  return [...new Set(sayilar(temiz))].filter((deger) => !bilinen.has(deger) && !SERBEST.has(deger));
}

/*
  YAZIYLA YAZILAN SAYI (25.10.2026).

  Denetim rakamı yakalıyordu, yazıyı yakalamıyordu: asistan
  "yaklaşık yirmi kişi" ya da "üç yüz katılımcı" yazdığında girdide
  böyle bir sayı olmasa bile cevap geçiyordu. Uydurma sayı akademik
  bir metinde yanlış cümleden ağır bir hata ve rakamla yazılanı
  elemek, yazıyla yazılana kapıyı açık bırakmak anlamına geliyordu.

  KURAL DAR TUTULDU, çünkü bu dosyanın kendi ilkesi: yanlış alarm
  kaçırılan uydurmadan SİNSİDİR — kullanıcı doğru çalışan aracı
  kullanmayı bırakır. Daraltmanın iki ayağı var:

  1. TETİKLEYİCİ SÖZCÜK ONDAN BÜYÜK OLMALI (on, yirmi, …, yüz, bin).
     "bir" ve "iki" Türkçede sayı değil BELİRTEÇ olarak da geçiyor
     ("bir analiz", "iki yönlü test"); onları tek başına saymak
     neredeyse her cevabı reddederdi. Küçük sözcükler yalnızca
     büyük bir sözcüğe BİTİŞİKKEN okunuyor ("iki yüz" = 200).

  2. "YÜZDE" AYIKLANIYOR. "yüzde 40" içindeki "yüz" bir miktar
     değil; sözcük sınırı tek başına yetmiyor çünkü "yüzde" ayrı
     bir sözcük olarak geçiyor.

  BEDELİ açıkça: ondan küçük yazıyla uydurma ("üç katılımcı")
  hâlâ kaçıyor. Daraltmanın alternatifi, her cevabı "bir" yüzünden
  reddeden bir denetimdi.
*/
type SozcukTablosu = {
  birler: Record<string, number>;
  onlar: Record<string, number>;
  /** "yüz" / "hundred": önündeki parçayı çarpar. */
  yuz: string;
  /** Bin, milyon: toplamı kapatıp yeni parça başlatır. */
  katlar: Record<string, number>;
  /** Miktar olmayan, ayıklanan sözcük ("yüzde", "percent"). */
  ayiklanan: RegExp;
};

const TURKCE: SozcukTablosu = {
  birler: { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9 },
  onlar: { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90 },
  yuz: "yüz",
  katlar: { bin: 1000, milyon: 1_000_000 },
  ayiklanan: /\byüzde\b/g,
};

/*
  İNGİLİZCE (28.10.2026, lib/dil.ts). İngilizce arayüzdeki kullanıcıya
  bulgular İngilizce yazılıyor; Türkçe tablo "twenty participants"ı
  görmezdi. Aynı dar kural: tetikleyici ondan büyük ("ten" ve üstü,
  "hundred", "thousand"); "one" ve "two" İngilizcede de sayı olmayan
  anlamlarda geçiyor ("one of the", "the two groups").

  İki tablo AYRI tutuluyor: Türkçe "on" (10) İngilizcede edattır; İngilizce
  çıktıyı Türkçe tabloyla taramak "on the other hand"ı uydurma bir 10
  sayardı.
*/
const INGILIZCE: SozcukTablosu = {
  birler: {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  },
  onlar: { ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 },
  yuz: "hundred",
  katlar: { thousand: 1000, million: 1_000_000 },
  ayiklanan: /\bpercent\b/g,
};

const TABLOLAR: Record<Dil, SozcukTablosu> = { tr: TURKCE, en: INGILIZCE };

/** Tek başına bir miktar başlatabilen sözcükler (ondan büyük). */
const tetikleyiciMi = (t: SozcukTablosu, s: string) =>
  s in t.onlar || s === t.yuz || s in t.katlar || (s in t.birler && t.birler[s] > 10);
const sayiSozcuguMu = (t: SozcukTablosu, s: string) => s in t.birler || s in t.onlar || s === t.yuz || s in t.katlar;

/** Ardışık sayı sözcüklerinin değeri: "iki yüz otuz beş" → 235, "two hundred thirty-five" → 235 */
function dizininDegeri(t: SozcukTablosu, sozcukler: string[]): number {
  let toplam = 0;
  let parca = 0;
  for (const s of sozcukler) {
    if (s in t.birler) parca += t.birler[s];
    else if (s in t.onlar) parca += t.onlar[s];
    else if (s === t.yuz) parca = (parca || 1) * 100;
    else if (s in t.katlar) { toplam += (parca || 1) * t.katlar[s]; parca = 0; }
  }
  return toplam + parca;
}

/** Metindeki yazıyla yazılmış miktarlar (yalnızca tetikleyici içerenler). */
export function yaziylaSayilar(metin: string, dil: Dil = "tr"): { metin: string; deger: number }[] {
  const t = TABLOLAR[dil];
  /* "yüzde"/"percent" bir miktar değil; ayıklanmazsa her yüzde ifadesi 100
     sayılırdı. */
  const temiz = metin.toLocaleLowerCase(dil === "tr" ? "tr" : "en").replace(t.ayiklanan, " ");
  const sozcukler = temiz.match(/\p{L}+/gu) ?? [];

  const bulunanlar: { metin: string; deger: number }[] = [];
  let i = 0;
  while (i < sozcukler.length) {
    if (!sayiSozcuguMu(t, sozcukler[i])) { i += 1; continue; }
    let son = i;
    while (son + 1 < sozcukler.length && sayiSozcuguMu(t, sozcukler[son + 1])) son += 1;
    const dizi = sozcukler.slice(i, son + 1);
    /* Tek başına "bir"/"iki" ("one"/"two") gibi küçük sözcükler sayılmıyor:
       belirteç olarak da geçiyorlar. */
    if (dizi.some((s) => tetikleyiciMi(t, s))) {
      bulunanlar.push({ metin: dizi.join(" "), deger: dizininDegeri(t, dizi) });
    }
    i = son + 1;
  }
  return bulunanlar;
}

/**
 * Çıktıda yazıyla geçip girdide HİÇ geçmeyen miktarlar.
 *
 * Girdide ister rakamla ("20") ister aynı yazımla ("yirmi") geçsin,
 * uydurma sayılmıyor: kullanıcı sayıyı nasıl yazdıysa öyle arıyoruz.
 */
export function uydurmaYaziylaSayilar(cikti: string, girdi: string, ...ekGirdiler: string[]): string[] {
  return uydurmaYaziylaSayilarDilde("tr", cikti, girdi, ...ekGirdiler);
}

/**
 * Aynı denetim, çıktının diline göre. Girdi her iki dilde de okunur:
 * kullanıcının metni Türkçe, bulgu İngilizce olabilir — girdide "yirmi"
 * yazıyorsa çıktıdaki "twenty" uydurma değil.
 */
export function uydurmaYaziylaSayilarDilde(dil: Dil, cikti: string, girdi: string, ...ekGirdiler: string[]): string[] {
  const tumGirdi = [girdi, ...ekGirdiler].join(" ");
  const girdiRakamlari = new Set([girdi, ...ekGirdiler].flatMap(sayilar));
  const girdiYazilari = new Set([...yaziylaSayilar(tumGirdi, "tr"), ...yaziylaSayilar(tumGirdi, "en")].map((x) => x.deger));

  const bulunanlar = yaziylaSayilar(cikti, dil).filter(
    (x) => !girdiYazilari.has(x.deger) && !girdiRakamlari.has(String(x.deger)),
  );
  return [...new Set(bulunanlar.map((x) => x.metin))];
}

/*
  YAPISAL TÜRETİLMİŞ SAYILAR (28.10.2026) — YALNIZCA ANALİZ YETENEĞİNDE.

  Asistan girdideki yapıyı sayınca girdide yazılı olmayan bir sayı
  çıkıyor ve cevabın tamamı düşüyordu: dört grubun Tukey çıktısında
  "6 ikili karşılaştırma", n = 50'lik korelasyonda "r(48)". İkisi de
  uydurma değil, girdinin aritmetik sonucu; istemin kendisi çoklu
  karşılaştırmaya bakmasını istiyor.

  Kabul edilen türetmeler SABİT ve dar: her tam sayı v için v − 1 ve v − 2
  (serbestlik derecesi: t ve grup sayısında v − 1, r'de n − 2) ve v ≤ 30
  ise ikili karşılaştırma sayısı — k grup için k(k−1)/2, girdide yalnızca
  sd = k − 1 geçiyorsa (F(3, 46)) (v+1)v/2.

  BEDELİ açıkça: girdideki bir sayının bir ya da iki eksiği olan UYDURMA bir
  tam sayı (n = 50 iken "49 katılımcı") kaçar. Ondalıklar (p, etki
  büyüklüğü, ortalama) bu kümeye hiç girmiyor. Kaynakça ve makale
  yeteneklerinde KULLANILMAZ: orada "2020 − 1" uydurma bir yıl olurdu.
*/
export function yapisalTuretilmis(girdiler: string[]): string[] {
  const sonuc = new Set<string>();
  for (const deger of girdiler.flatMap(sayilar)) {
    const v = Number(deger);
    if (!Number.isInteger(v) || v < 2 || v > 100_000) continue;
    sonuc.add(String(v - 1));
    sonuc.add(String(v - 2));
    if (v <= 30) {
      sonuc.add(String((v * (v - 1)) / 2));
      sonuc.add(String(((v + 1) * v) / 2));
    }
  }
  return [...sonuc];
}
