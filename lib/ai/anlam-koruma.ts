/*
  ANLAM KORUMA DENETİMİ (21.11.2026, gerçek AI kabulü bulgusu).

  Kısaltma görevi "anlamını koruyarak kısalt" diyor, ama kısaltmanın doğası
  gereği model bir şeyleri atar — ve attığı şey akademik metinde cümlenin
  GÜCÜNÜ değiştiren niteleme olabilir. Kabulde tam bu oldu: "ancak bu fark
  ikinci yılda İSTATİSTİKSEL OLARAK anlamlı değildir … bu nedenle sonuçlar
  DİKKATLE yorumlanmalıdır" cümlesi "ikinci yılda bu fark anlamlı değildir"
  diye kısaldı; sayı, atıf ve olumsuzluk korunduğu için bütün denetimlerden
  geçti ve asistan kullanıcıya "sayılar, atıf ve anlam korundu" yazdı.
  "İstatistiksel olarak anlamlı değil" ile "anlamlı değil" aynı şey değildir;
  tez savunmasında bu farkı öğrenci ödüyor.

  Bu modül cevabı DÜŞÜRMEZ. Düşürmek yanlış alarmın en pahalı biçimi
  olurdu: kısaltma zaten metin atmak demek, her atılan sözcük hata değil.
  Yaptığı tek şey, kaynakta olup çıktıda olmayan NİTELEMEYİ saymak; eylem
  (app/actions/ai-yazim.ts) bunu kullanıcıya uyarı olarak gösterir ve
  modelin "anlam korundu" iddiasını bu durumda ekrana çıkarmaz.

  İki eşleşme kipi var, çünkü iki ayrı hata sınıfı var:
    - "hepsi": her desen tek başına bir bilgi taşır (yıl, örneklem
      büyüklüğü, "istatistiksel"). Kaynakta eşleşip çıktıda eşleşmeyen her
      desen bir kayıptır.
    - "herhangi": sınıfın tamamı bir nitelik taşır ve model onu başka
      sözcükle söylemiş olabilir ("anlamlı değildir" → "anlamsızdır").
      Yalnızca sınıf çıktıdan TAMAMEN silinmişse kayıp sayılır; yoksa her
      eşanlamlı yeniden yazım yanlış alarm üretirdi.

  BU BİR ANLAM KORUMA GARANTİSİ DEĞİLDİR. Sessiz kalması kısaltmanın
  güvenli olduğunu kanıtlamaz; yalnızca aradığı KALIPLARIN düşmediğini
  söyler. Bilinen kör noktalar:
    - "herhangi" kipindeki sınıflar (olumsuzluk, belirsizlik, sınırlılık)
      SINIF düzeyinde ölçer. Kaynakta iki ayrı olumsuz iddia varsa ve
      kısaltma birini atıp ötekini tutuyorsa sınıf hâlâ "var" görünür ve
      uyarı çıkmaz. Bu bilinçli bir seçim: eşanlamlı yeniden yazımda
      ("anlamlı değildir" → "anlamsızdır") iddia başına ölçüm sürekli
      yanlış alarm verirdi ve AGENTS.md'ye göre yanlış alarm, kaçırılan
      kayıptan sinsidir — kullanıcı doğru çalışan aracı kullanmayı bırakır.
    - Bütün bir cümlenin atılması, cümle kendine özel bir kalıp
      taşımıyorsa görülmez.
    - Olumsuzluğun YERİ ölçülmez: "A değil, B" → "A, B değil" ters anlam
      verir ama her iki metinde de olumsuzluk vardır.
    - Yorum ekleme, abartma ve yön değiştirme bu modülün işi değil;
      onlar yazimDenetle ve istemin kuralları.
  Kullanıcıya gösterilen metin de bu yüzden "anlam korundu" demez,
  yalnızca NE DÜŞTÜĞÜNÜ söyler.

  Saf modül; testi tests/unit/anlam-koruma.test.ts.
*/

import type { Metin } from "@/lib/dil";

export type AnlamSinifi = "istatistik" | "olumsuzluk" | "belirsizlik" | "zaman" | "orneklem" | "sinirlilik";

export type AnlamKaybi = { sinif: AnlamSinifi; dusenler: string[] };

type Kural = { sinif: AnlamSinifi; kip: "hepsi" | "herhangi"; desenler: RegExp[] };

/*
  Desenler dar tutuldu: her biri akademik metinde cümlenin hükmünü
  değiştiren bir niteleme. "Anlamlı" tek başına yok (günlük anlamı da var),
  "istatistiksel" var. Türkçe ekler için gövde + \p{L}* kullanılır; İngilizce
  karşılıkları aynı sınıfta, çünkü belge dili İngilizce olabilir.
*/
const KURALLAR: Kural[] = [
  {
    sinif: "istatistik",
    kip: "hepsi",
    desenler: [
      /istatistik\p{L}*/iu,
      /anlamlılık/iu,
      /\bp\s*[<>=≤≥]\s*[\d.,]+/iu,
      /\bp\s+değeri/iu,
      /güven\s+aralığ\p{L}*/iu,
      /etki\s+büyüklüğ\p{L}*/iu,
      /serbestlik\s+derece\p{L}*/iu,
      /\bstatistical(?:ly)?\b/iu,
      /\bsignifican(?:t|ce)\b/iu,
      /\bconfidence\s+interval\b/iu,
      /\beffect\s+size\b/iu,
      /\bp[-\s]?value\b/iu,
    ],
  },
  {
    sinif: "olumsuzluk",
    kip: "herhangi",
    desenler: [
      /değil\p{L}*/iu,
      /\byok\p{L}*/iu,
      /\bhiçbir\b/iu,
      /\p{L}+m[ae]mış\p{L}*/iu,
      /\p{L}+m[ae]z\p{L}*/iu,
      /\p{L}+sız\p{L}*|\p{L}+siz\p{L}*|\p{L}+suz\p{L}*|\p{L}+süz\p{L}*/iu,
      /\bnot\b|\bno\b|\bnone\b|\bnever\b|\bn't\b/iu,
      /* "un\p{Ll}+" bilerek YOK: "university", "unemployment" gibi olumsuzlukla ilgisiz sözcükleri yakalar ve sınıfı yanlış yere açardı. */
      /\bfail(?:ed|s|ure)?\b|\babsen(?:t|ce)\b/iu,
    ],
  },
  {
    sinif: "belirsizlik",
    kip: "herhangi",
    desenler: [
      /\bolabil\p{L}*/iu,
      /\bgörün\p{L}*/iu,
      /muhtemel\p{L}*/iu,
      /\bhenüz\b/iu,
      /dikkatl\p{L}*/iu,
      /\bkısmen\b|\bgörece\b|\bsınırlı\p{L}*/iu,
      /\bönerilmekte\p{L}*|\böne\s+sürül\p{L}*/iu,
      /\bmay\b|\bmight\b|\bcould\b|\blikely\b|\bappears?\b|\bsuggests?\b|\btentative\p{L}*/iu,
      /\bcaution\p{L}*|\bpreliminary\b/iu,
    ],
  },
  {
    sinif: "zaman",
    kip: "hepsi",
    desenler: [
      /\b(?:1[89]|20)\d{2}\b/u,
      /\b\d+\s*(?:yıl|ay|hafta|gün)\p{L}*/iu,
      /\b\d+\s*(?:year|month|week|day)s?\b/iu,
      /\b(?:birinci|ikinci|üçüncü|dördüncü)\s+(?:yıl|dönem|ay)\p{L}*/iu,
      /\b(?:first|second|third|fourth)\s+(?:year|term|semester|month)s?\b/iu,
      /sonun\p{L}*|başın\p{L}*|arasın\p{L}*|süresince|boyunca/iu,
      /\bend\s+of\b|\bbeginning\s+of\b|\bbetween\b|\bduring\b|\bfollow[-\s]?up\b/iu,
    ],
  },
  {
    sinif: "orneklem",
    kip: "hepsi",
    desenler: [
      /*
        En az BİR RAKAM zorunlu: "[\d.,]+" cümle sonundaki noktayı da
        eşleştiriyordu ("… uygulanmıştır. Katılımcılar" → ". katılımcılar")
        ve örneklem büyüklüğü hiç geçmeyen metinleri sınıfa sokuyordu.
      */
      /\bn\s*=\s*\d[\d.,]*/iu,
      /\d[\d.,]*\s*(?:kişi|öğrenci|katılımcı|denek|hasta|gözlem|okul|kampüs|sınıf)\p{L}*/iu,
      /\d[\d.,]*\s*(?:participants?|students?|subjects?|respondents?|observations?|cases?|schools?|campuses)\b/iu,
    ],
  },
  {
    sinif: "sinirlilik",
    kip: "herhangi",
    desenler: [
      /\bancak\b|\bfakat\b|\bne\s+var\s+ki\b|\bbununla\s+birlikte\b|\bbuna\s+karşın\b/iu,
      /sınırlılı\p{L}*|genellen\p{L}*/iu,
      /\bhowever\b|\bbut\b|\bnevertheless\b|\bnonetheless\b|\balthough\b|\bthough\b/iu,
      /\blimitation\p{L}*|\bgeneraliz\p{L}*/iu,
    ],
  },
];

export const ANLAM_SINIFI_ADI: Record<AnlamSinifi, Metin> = {
  istatistik: { tr: "istatistiksel niteleme", en: "statistical qualification" },
  olumsuzluk: { tr: "olumsuzluk", en: "negation" },
  belirsizlik: { tr: "belirsizlik/ihtiyat ifadesi", en: "hedging" },
  zaman: { tr: "zaman bilgisi", en: "time information" },
  orneklem: { tr: "örneklem bilgisi", en: "sample information" },
  sinirlilik: { tr: "sınırlılık/karşıtlık ifadesi", en: "limitation or contrast" },
};

/*
  Eşleşme normalleştirilmiş metinde aranır: büyük/küçük harf ve boşluk
  farkı niteleme kaybı değildir. Türkçe küçültme ("I" → "ı") bilerek:
  "İSTATİSTİKSEL" ile "istatistiksel" aynı sözcük.
*/
const duzle = (metin: string) => metin.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

/**
 * Kaynakta olup üretilen metinde olmayan nitelemeler. Boş dizi: ölçülen
 * sınıfların hiçbirinde kayıp yok (metnin anlamının korunduğunun KANITI
 * değil, yalnızca bu denetimin bir şey bulmadığı).
 */
export function anlamKaybi(kaynak: string, uretilen: string): AnlamKaybi[] {
  const k = duzle(kaynak ?? "");
  const u = duzle(uretilen ?? "");
  if (!k || !u) return [];
  const kayiplar: AnlamKaybi[] = [];
  for (const kural of KURALLAR) {
    const kaynaktaki = kural.desenler.filter((d) => d.test(k));
    if (!kaynaktaki.length) continue;
    if (kural.kip === "herhangi") {
      /*
        Çıktıda sınıfın BÜTÜN desenleri aranır, yalnızca kaynakta eşleşenler
        değil: "anlamlı değildir" → "anlamsızdır" yeniden yazımında kaynak
        "değil" desenine, çıktı "-sız" desenine takılır. Yalnızca kaynağın
        deseniyle bakmak bunu "olumsuzluk düştü" diye raporluyordu.
      */
      if (kural.desenler.some((d) => d.test(u))) continue;
      const dusenler = [...new Set(kaynaktaki.map((d) => k.match(d)?.[0] ?? "").filter(Boolean))];
      kayiplar.push({ sinif: kural.sinif, dusenler: dusenler.slice(0, 4) });
      continue;
    }
    const dusenler = [...new Set(kaynaktaki.filter((d) => !d.test(u)).map((d) => k.match(d)?.[0] ?? "").filter(Boolean))];
    if (dusenler.length) kayiplar.push({ sinif: kural.sinif, dusenler: dusenler.slice(0, 4) });
  }
  return kayiplar;
}

/*
  "ANLAM KORUNDU" İDDİASI (21.11.2026). Model açıklamasında ("yanit")
  kaybı olmayan bir kısaltma yapmış gibi konuşabiliyor; kabulde yazdığı
  cümle "sayılar, atıf ve anlam korundu" idi. Kayıp varken bu cümle
  kullanıcıyı yanıltır, bu yüzden açıklama sunucunun metniyle DEĞİŞTİRİLİR
  (modelin ham cevabı kayda olduğu gibi girer: eğitim verisi).
  Yalnızca iddia taşıyan açıklama değiştirilir; kayıp varken sessiz kalan
  ya da kaybı kendisi söyleyen açıklama olduğu gibi kalır.
*/
const KORUNDU_IDDIASI = [
  /anlam\p{L}*\s+(?:tamamen\s+|bütünüyle\s+|aynen\s+)?korun\p{L}*/iu,
  /anlam\p{L}*\s+değiş\p{L}*(?:me|mi)\p{L}*/iu,
  /hiçbir\s+bilgi\s+(?:kayb\p{L}*|düş\p{L}*)/iu,
  /bilgi\s+kayb\p{L}*\s+(?:yok|olmad\p{L}*)/iu,
  /\bmeaning\s+(?:is\s+|was\s+)?(?:fully\s+|entirely\s+)?preserved\b/iu,
  /\bwithout\s+(?:changing|altering|losing)\s+(?:the\s+)?meaning\b/iu,
  /\bno\s+information\s+(?:was\s+)?lost\b/iu,
];

/** Model açıklaması "anlam korundu" diyor mu? */
export function korunduIddiasi(yanit: string): boolean {
  const y = duzle(yanit ?? "");
  return Boolean(y) && KORUNDU_IDDIASI.some((d) => d.test(y));
}
