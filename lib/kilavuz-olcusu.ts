/*
  Kılavuzdaki bir ölçü hangi cümleye aitse onun kuralıdır.

  Canlıda Adıyaman kılavuzundan GÖVDE yazı boyutu "14 punto" çıktı ve
  onaylandı. Kılavuzun cümlesi şu:

    "Ana bölüm başlıkları (GİRİŞ, GENEL BİLGİLER, KAYNAKLAR vb. gibi)
     14 punto, alt bölüm başlıkları ve metin kısmı 12 punto büyüklüğünde"

  Tarayıcı ilk eşleşmeyi alıyordu, yani BAŞLIK kuralını gövdenin kuralı
  sandı. Gövde 12 punto. Aynı açık satır aralığında da var: "İçindekiler
  listesi 12 punto ve 1,5 satır aralığıyla" cümlesi gövdeden söz etmiyor.

  Kenar boşluğundaki "üst 29,7 cm" ile aynı sınıf hata — sayı doğru
  okunuyor, yanlış cümleden alınıyor. Aradaki fark, oranın aralık
  denetimiyle kapanabilmesi: 29,7 cm tek başına saçmaydı. 14 punto tek
  başına gayet makul; onu eleyen tek şey cümlenin KİMDEN söz ettiği.

  Bu yüzden eşleşmenin ÖNÜNDEKİ metne bakılır. Cümle başlıktan, dipnottan,
  tablodan ya da kapaktan söz ediyorsa o ölçü gövdenin değildir ve atlanır;
  hiçbir eşleşme kalmazsa kural hiç yazılmaz. Yanlış punto öğrencinin
  belgesine doğrudan iner, eksik punto yalnızca yöneticiye sorulur.
*/

/** Eşleşmenin önünde bakılacak en uzun metin; cümle başı daha yakınsa oradan başlar. */
const PENCERE = 160;

/*
  Güçlü cümle sonu: noktayı BÜYÜK harf izlemeli. Türkçe kılavuz metni
  kısaltma kaynıyor ("vb.", "MS Office vb.) ", "Ör."); yalnızca noktaya
  bakmak cümleyi tam da işaretin geçtiği yerde kesiyordu.
*/
const CUMLE_SONU = /[.;:!?]\s+(?=[A-ZÇĞİÖŞÜ])/gu;

/*
  İşaretler sadeleştirilmiş metinde aranır, bu yüzden hepsi küçük harf ve
  NOKTASIZ "i" ile yazılır ("başlik", "kisaltma"). Sebebi Türkçe'ye özgü
  iki eşleşme tuzağı: JavaScript'in `i` bayrağı "İ" ile "i"yi, "I" ile
  "ı"yı EŞLEŞTİRMEZ (ikisi de ASCII/ASCII-dışı sınırını geçiyor). Kılavuz
  metinlerinde başlıklar çoğunlukla büyük harfle yazıldığı için
  "İÇİNDEKİLER" ve "BAŞLIK" işaretleri hiç görülmüyordu.
*/
const sadelestir = (metin: string) => metin.toLocaleLowerCase("tr-TR").replaceAll("ı", "i");

/** Cümle gövde metninden söz ediyor. */
const GOVDE = /metin kismi|metin kisimlari|metin içeri|ana metin|tüm metin|tüm yazi|tez metni|tezin tamami|gövde metni|gövde|düz metin|normal metin/gu;

/*
  Gövde dışı işareti iptal eden olumsuzlama.

  Canlıda Ankara Yıldırım Beyazıt kılavuzunun gövde kuralı şu cümlede:
  "Kapak sayfaları HARİÇ tüm yazılarda harf boyutu 12 punto olmalıdır."
  "kapak" işaretine bakıp elemek, cümlenin tam tersini söylemesine rağmen
  doğru kuralı attırıyordu; ardından kapak sayfasının 14 puntosu gövdenin
  kuralı olarak yazılıyordu.
*/
const OLUMSUZ = /hariç|haricinde|dişinda|dişindaki|dişindakiler|olmayan/gu;

/*
  Cümle gövdeden BAŞKA bir şeyden söz ediyor. Geniş tutuldu: bu listeye
  yanlışlıkla giren bir cümle ölçüyü kaybettirir (yönetici elle girer),
  girmeyen bir cümle ise yanlış ölçüyü öğrencinin belgesine yazar.
*/
const GOVDE_DISI = /başlik|dipnot|kapak|özet|abstract|içindekiler|tablo|çizelge|şekil|resim|grafik|alinti|kaynak|sayfa numara|jüri|beyan|teşekkür|simge|kisaltma|\bek(?:ler|i|te)?\b/gu;

/** Desenin metindeki bütün eşleşme konumları. */
function konumlar(metin: string, desen: RegExp): number[] {
  const arayici = new RegExp(desen.source, desen.flags);
  const bulunan: number[] = [];
  let eslesme: RegExpExecArray | null;
  while ((eslesme = arayici.exec(metin)) !== null) {
    bulunan.push(eslesme.index);
    if (eslesme.index === arayici.lastIndex) arayici.lastIndex += 1;
  }
  return bulunan;
}

/** Son eşleşmenin konumu, yoksa -1. */
const sonKonum = (metin: string, desen: RegExp): number => konumlar(metin, desen).at(-1) ?? -1;

/**
 * Cümleyi gövde dışına çıkaran son işaretin konumu; yoksa -1.
 * Ardından olumsuzlama gelen işaret sayılmaz ("kapak sayfaları hariç …").
 */
function disiKonum(onceki: string): number {
  const gecerliler = konumlar(onceki, GOVDE_DISI).filter(
    (konum) => sonKonum(onceki.slice(konum), OLUMSUZ) < 0,
  );
  return gecerliler.at(-1) ?? -1;
}

/** Eşleşmenin önündeki metin: en çok PENCERE kadar, cümle başı daha yakınsa oradan. */
function onCumle(compact: string, konum: number): string {
  const pencere = compact.slice(Math.max(0, konum - PENCERE), konum);
  const kesme = sonKonum(pencere, CUMLE_SONU);
  return kesme < 0 ? pencere : pencere.slice(kesme);
}

/**
 * Gövde metninin ölçüsü: ilk eşleşme değil, gövdeden söz eden ilk MAKUL
 * eşleşme. Sayı, desenin dolu olan ilk yakalama grubundan okunur.
 *
 * `gecerli` verilirse aralık dışı değerler eşleşmeyi bitirmez, ARAMA SÜRER.
 * Kılavuzlar ölçüyü sık sık göreli anlatıyor ("Tablo/çizelgelerde yazı
 * büyüklüğü ana metinden 2 punto küçük olmalıdır"); böyle bir cümle gövdeden
 * söz ettiği için elenmiyor, ardından 2 punto geçersiz bulunup ölçü hiç
 * yazılmıyordu — oysa gerçek kural birkaç cümle ötede duruyor.
 */
export function govdeOlcusu(
  compact: string,
  desen: RegExp,
  gecerli?: (deger: number) => boolean,
): number | undefined {
  const arayici = new RegExp(desen.source, desen.flags.includes("g") ? desen.flags : `${desen.flags}g`);
  const govdeli: number[] = [];
  const isaretsiz: number[] = [];
  let eslesme: RegExpExecArray | null;
  while ((eslesme = arayici.exec(compact)) !== null) {
    if (eslesme.index === arayici.lastIndex) arayici.lastIndex += 1;
    // Seçenekli desenlerde (bkz. PARAGRAPH_INDENT_CM) sayı hangi koldaysa oradan.
    const ham = eslesme.slice(1).find((grup) => grup !== undefined);
    if (ham === undefined) continue;
    const deger = Number(ham.replace(",", "."));
    if (!Number.isFinite(deger)) continue;
    if (gecerli && !gecerli(deger)) continue;

    const onceki = sadelestir(onCumle(compact, eslesme.index));
    const govdeKonum = sonKonum(onceki, GOVDE);
    // Sıra önemli: "Tablo ve şekiller dışındaki tüm metin 12 punto" gövdenindir.
    if (disiKonum(onceki) > govdeKonum) continue;
    (govdeKonum >= 0 ? govdeli : isaretsiz).push(deger);
  }
  /*
    Gövdeden AÇIKÇA söz eden eşleşme, işaretsiz olana yeğlenir. İşaretsiz
    eşleşmeye hemen atlamak, konusu birkaç cümle önce geçen kuralları
    gövdenin kuralı sanmaya yol açıyordu: Ankara Yıldırım Beyazıt'ın kapak
    sayfası anlatımı üç cümle sürüyor ve "diğer tüm yazılar 14 punto"
    cümlesinde kapaktan söz edilmiyor.
  */
  return govdeli[0] ?? isaretsiz[0];
}
