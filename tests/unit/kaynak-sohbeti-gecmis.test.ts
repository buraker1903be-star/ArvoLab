import assert from "node:assert/strict";
import test from "node:test";
import { kaynakCevabiCozumle, kaynakCevabiDenetle, kaynakIstemi, KAYNAK_ISTEMI, type KaynakMesaji, type Sayfa } from "@/lib/ai/kaynak-sohbeti";
import { sistemAlani, sohbetTurlari } from "@/lib/ai/saglayici";

/*
  SOHBET GEÇMİŞİ VE KANIT (21.11.2026, gerçek AI kabulünün FAIL'inden).

  Kabulde aday 9e705ef'e sentetik bir test PDF'i yüklendi ve iki soru arka
  arkaya soruldu. Birincinin (örneklem + veri toplama tarihi) cevabı PDF'te
  vardı, ikincininki (etik kurul onay numarası) YOKTU. Model ikinci soruyu
  birincinin cevabını baştan tekrarlayarak yanıtladı, "bulundu": true dedi
  ve birinci turun alıntılarını ikinci cevabın altına astı: öğrenci, olmadığı
  söylenen bilginin dayanağı varmış gibi "PDF s. 2" düğmesi gördü.
  Aynı soru TEMİZ sohbette sorulduğunda model doğru davrandı
  ("bulundu": false, alıntı yok) — yani kusur "cevabı yok" yolunda değil,
  geçmişin yeni soruya sızmasındaydı.

  Aşağıdaki ham cevaplar o koşudan KAYITLI gerçek yanıtlardır; sağlayıcıya
  yeniden gidilmez.
*/

const SAYFALAR: Sayfa[] = [
  { num: 1, text: "Peer mentoring and first-year retention\nA. Kaya and M. Lee\nIntroduction. This synthetic report describes a peer mentoring programme." },
  {
    num: 2,
    text:
      "Method\nThe sample consisted of 412 first-year students from three campuses.\n" +
      "Data were collected between March and May 2023 using an online questionnaire.\n" +
      "Participants volunteered and could withdraw at any time.",
  },
  { num: 3, text: "Results\nRetention was 87 percent in the mentoring group and 74 percent in the comparison group." },
];
const KUNYE = "Kaya, A., & Lee, M. (2024). Peer mentoring and first-year retention: a synthetic test report. Synthetic Test Journal.";

const SORU_CEVAPLI = "Örneklemde kaç öğrenci vardı ve veriler ne zaman toplandı?";
const SORU_CEVAPSIZ = "Bu çalışmanın etik kurul onay numarası nedir?";

/* Kabul koşusunun 4. denemesi: cevabı PDF'te olan soru, temiz sohbette. */
const KAYIT_CEVAPLI = JSON.stringify({
  bulundu: true,
  cevap: "Örneklem, üç kampüsten 412 birinci sınıf öğrencisinden oluşmuştur. Veriler, Mart ve Mayıs 2023 arasında çevrimiçi bir anket kullanılarak toplanmıştır.",
  alintilar: [
    { sayfa: 2, metin: "The sample consisted of 412 first-year students from three campuses." },
    { sayfa: 2, metin: "Data were collected between March and May 2023 using an online questionnaire." },
  ],
});

/* Kabul koşusunun 5b denemesi: aynı cevapsız soru, TEMİZ sohbette (doğru davranış). */
const KAYIT_CEVAPSIZ_TEMIZ = JSON.stringify({
  bulundu: false,
  cevap: "Okunan sayfalarda çalışmanın etik kurul onay numarasına dair herhangi bir bilgi yer almamaktadır.",
  alintilar: [],
});

/*
  Kabul koşusunun 5. denemesi: aynı soru, 4'ün ardından AYNI sohbette.
  Bu cevap "bulundu": true dediği için alıntı denetimi onu düşürmez
  (alıntılar gerçekten sayfa 2'de); düzeltme bu cevabın ÜRETİLMESİNİ
  engelliyor — istem kuralı 9 ve geçmişin asistan turu olarak gitmesi.
  Kayıt burada, düzeltmenin hangi katmanda olduğu belgelensin diye duruyor.
*/
const KAYIT_CEVAPSIZ_KIRLI = JSON.stringify({
  bulundu: true,
  cevap:
    "Örneklem, üç kampüsten 412 birinci sınıf öğrencisinden oluşmuştur; veriler Mart ve Mayıs 2023 arasında çevrimiçi bir anket kullanılarak toplanmıştır. " +
    "Etik kurul onay numarasına gelince, okunan sayfalarda böyle bir bilgi yer almamaktadır.",
  alintilar: [
    { sayfa: 2, metin: "The sample consisted of 412 first-year students from three campuses." },
    { sayfa: 2, metin: "Data were collected between March and May 2023 using an online questionnaire." },
  ],
});

const coz = (ham: string) => {
  const cevap = kaynakCevabiCozumle(ham);
  assert.ok(cevap, "kayıtlı yanıt çözümlenemedi");
  return cevap;
};

test("kabul FAIL'i: cevaplı sorudan sonra cevapsız soru — geçmiş SİSTEM istemine değil asistan turuna gider", () => {
  const gecmis: KaynakMesaji[] = [
    { rol: "kullanici", metin: SORU_CEVAPLI },
    { rol: "asistan", metin: coz(KAYIT_CEVAPLI).cevap },
  ];
  const { mesajlar } = kaynakIstemi({ kunye: KUNYE, sayfalar: SAYFALAR, soru: SORU_CEVAPSIZ, gecmis, dil: "tr" });

  /*
    Kök neden buydu: Anthropic gövdesinde system alanı sistem mesajlarının
    birleşimi (sistemAlani). Önceki cevap "sistem" rolüyle gidince kaynak
    metninin arkasına talimat gibi yapışıyor, messages dizisinde de arka
    arkaya iki kullanıcı turu kalıyordu.
  */
  const sistem = sistemAlani(mesajlar);
  assert.ok(!sistem.includes("412 birinci sınıf"), "önceki cevap hâlâ sistem istemine giriyor");
  assert.ok(!sistem.includes("ÖNCEKİ CEVABIN"), "önceki cevap sistem istemine etiketle gömülmüş");

  const turlar = sohbetTurlari(mesajlar);
  assert.deepEqual(
    turlar.map((m) => m.rol),
    ["kullanici", "asistan", "kullanici"],
    "geçmiş gerçek sohbet turu olarak gitmiyor",
  );
  assert.equal(turlar.at(-1)?.metin, SORU_CEVAPSIZ, "son tur güncel soru olmalı");
  assert.equal(turlar.filter((m) => m.rol === "kullanici").at(-1)?.metin, SORU_CEVAPSIZ);
});

test("düzeltmenin SINIRI yazılı: kirlenmiş cevap 'bulundu: true' dediği için sunucu denetimine takılmaz", () => {
  /*
    Dürüstlük testi. Kabulde düşen cevap şu: önceki cevabı tekrarlıyor,
    "bulundu": true diyor ve alıntıları gerçekten sayfa 2'de. Sunucunun
    alıntı/sayı/künye denetimleri bunu yakalayamaz ve YAKALAMAMALI: alıntı
    birebir, sayı kaynakta, atıf kaynağın kendisi. Bu cevabın üretilmesini
    önleyen şey istem kuralı 9 ile geçmişin asistan turuna taşınmasıdır;
    sunucu tarafında bir ağ yok. Test bunu sabitliyor ki ileride biri
    "demek ki sunucu da yakalıyor" diye varsaymasın.
  */
  const sonuc = kaynakCevabiDenetle(coz(KAYIT_CEVAPSIZ_KIRLI), SAYFALAR, SORU_CEVAPSIZ, KUNYE);
  assert.equal(sonuc.gecti, true);
  assert.equal(sonuc.gecti && sonuc.cevap.alintilar.length, 2);
});

test("istem, güncel soruyu ve kanıtını ayırmayı KURAL olarak söyler", () => {
  assert.match(KAYNAK_ISTEMI, /YALNIZCA SON SORUYU cevapla/);
  assert.match(KAYNAK_ISTEMI, /"alintilar" listesini BOŞ bırak/);
  const { mesajlar } = kaynakIstemi({
    kunye: KUNYE,
    sayfalar: SAYFALAR,
    soru: SORU_CEVAPSIZ,
    gecmis: [
      { rol: "kullanici", metin: SORU_CEVAPLI },
      { rol: "asistan", metin: "Örneklem 412 öğrencidir." },
    ],
    dil: "tr",
  });
  assert.match(sistemAlani(mesajlar), /BAĞLAMDIR/);
  // Geçmiş yokken bağlam uyarısı da yok: boş sohbette anlamsız bir cümle istemi şişirmesin.
  assert.ok(!sistemAlani(kaynakIstemi({ kunye: KUNYE, sayfalar: SAYFALAR, soru: SORU_CEVAPSIZ, gecmis: [], dil: "tr" }).mesajlar).includes("BAĞLAMDIR"));
});

test("kayıtlı gerçek yanıt: temiz sohbetteki 'bulunamadı' cevabı alıntısız geçer", () => {
  const sonuc = kaynakCevabiDenetle(coz(KAYIT_CEVAPSIZ_TEMIZ), SAYFALAR, SORU_CEVAPSIZ, KUNYE);
  assert.equal(sonuc.gecti, true);
  assert.equal(sonuc.gecti && sonuc.cevap.bulundu, false);
  assert.deepEqual(sonuc.gecti && sonuc.cevap.alintilar, []);
});

test("'bulunamadı' cevabı önceki turun alıntılarını kanıt diye taşıyamaz: liste boşaltılır", () => {
  /*
    Kabulde görülen kanıt taşımasının "bulundu": false biçimi. Alıntılar
    kaynakta BİREBİR geçiyor (uydurma değil), ama sorulan şeyin dayanağı
    değiller; cevap düşürülmez, kanıt listesi boşaltılır.
  */
  const cevap = {
    bulundu: false,
    cevap: "Okunan sayfalarda etik kurul onay numarası yok.",
    alintilar: [
      { sayfa: 2, metin: "The sample consisted of 412 first-year students from three campuses." },
      { sayfa: 2, metin: "Data were collected between March and May 2023 using an online questionnaire." },
    ],
  };
  const sonuc = kaynakCevabiDenetle(cevap, SAYFALAR, SORU_CEVAPSIZ, KUNYE);
  assert.equal(sonuc.gecti, true);
  assert.deepEqual(sonuc.gecti && sonuc.cevap.alintilar, []);
  assert.equal(sonuc.gecti && sonuc.cevap.cevap, cevap.cevap, "cevap metni korunmalı: düşürme değil, kanıtı boşaltma");
});

test("koruma gevşemedi: 'bulunamadı' cevabındaki UYDURMA alıntı yine cevabın tamamını düşürür", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Okunan sayfalarda yok.", alintilar: [{ sayfa: 2, metin: "The ethics approval number is 2023/41 from the board." }] },
    SAYFALAR,
    SORU_CEVAPSIZ,
    KUNYE,
  );
  assert.equal(sonuc.gecti, false);
  assert.equal(sonuc.gecti === false && sonuc.neden, "alinti");
});

test("TERS SIRA: cevapsız sorudan sonra cevaplı soru — ikinci cevap kendi kanıtını taşır", () => {
  const gecmis: KaynakMesaji[] = [
    { rol: "kullanici", metin: SORU_CEVAPSIZ },
    { rol: "asistan", metin: coz(KAYIT_CEVAPSIZ_TEMIZ).cevap },
  ];
  const { mesajlar } = kaynakIstemi({ kunye: KUNYE, sayfalar: SAYFALAR, soru: SORU_CEVAPLI, gecmis, dil: "tr" });
  assert.deepEqual(
    sohbetTurlari(mesajlar).map((m) => m.rol),
    ["kullanici", "asistan", "kullanici"],
  );
  assert.equal(sohbetTurlari(mesajlar).at(-1)?.metin, SORU_CEVAPLI);

  // Önceki tur "bulunamadı" diye kapanmış olsa bile yeni cevabın kanıtı gösterilir.
  const sonuc = kaynakCevabiDenetle(coz(KAYIT_CEVAPLI), SAYFALAR, SORU_CEVAPLI, KUNYE);
  assert.equal(sonuc.gecti, true);
  assert.equal(sonuc.gecti && sonuc.cevap.bulundu, true);
  assert.equal(sonuc.gecti && sonuc.cevap.alintilar.length, 2);
});

test("BAĞLAMA İHTİYAÇ DUYAN TAKİP SORUSU: geçmiş silinmez, göndermesi çözülebilir kalır", () => {
  /*
    Düzeltme "geçmişi at" değil: "peki ya karşılaştırma grubu?" sorusunun
    öznesi önceki turda. Geçmiş istemde duruyor, yalnızca doğru rolde ve
    bağlam olduğu söylenerek.
  */
  const gecmis: KaynakMesaji[] = [
    { rol: "kullanici", metin: "Mentorluk grubunda devam oranı neydi?" },
    { rol: "asistan", metin: "Mentorluk grubunda devam oranı yüzde 87'dir." },
  ];
  const takip = "Peki ya karşılaştırma grubu?";
  const { mesajlar, kayitBaglami } = kaynakIstemi({ kunye: KUNYE, sayfalar: SAYFALAR, soru: takip, gecmis, dil: "tr" });
  const turlar = sohbetTurlari(mesajlar);
  assert.equal(turlar.length, 3, "geçmiş silinmemeli");
  assert.equal(turlar[0].metin, "Mentorluk grubunda devam oranı neydi?");
  assert.match(turlar[1].metin, /yüzde 87/);
  assert.equal(turlar.at(-1)?.metin, takip);
  assert.match(kayitBaglami, /SORU: Peki ya karşılaştırma grubu\?/);

  // Takip sorusunun cevabı kendi alıntısıyla geçer: bağlam korunuyor, kanıt karışmıyor.
  const sonuc = kaynakCevabiDenetle(
    {
      bulundu: true,
      cevap: "Karşılaştırma grubunda devam oranı yüzde 74'tür.",
      alintilar: [{ sayfa: 3, metin: "Retention was 87 percent in the mentoring group and 74 percent in the comparison group." }],
    },
    SAYFALAR,
    takip,
    KUNYE,
  );
  assert.equal(sonuc.gecti, true);
  assert.deepEqual(sonuc.gecti && sonuc.cevap.alintilar.map((a) => a.sayfa), [3]);
});

test("geçmiş pencereye göre kırpılınca asistan turuyla BAŞLAMAZ (sağlayıcı ilk turu kullanıcıdan bekler)", () => {
  const uzun: KaynakMesaji[] = Array.from({ length: 5 }, (_, i) => [
    { rol: "kullanici" as const, metin: `soru ${i}` },
    { rol: "asistan" as const, metin: `cevap ${i}` },
  ]).flat();
  const { mesajlar } = kaynakIstemi({ kunye: KUNYE, sayfalar: SAYFALAR, soru: SORU_CEVAPLI, gecmis: uzun, dil: "tr" });
  assert.equal(sohbetTurlari(mesajlar)[0].rol, "kullanici");
  // slice(-6) tek başına asistanla başlayan bir dizi üretebiliyor; transport bunu kesiyor.
  assert.equal(sohbetTurlari([{ rol: "asistan", metin: "a" }, { rol: "kullanici", metin: "s" }])[0].rol, "kullanici");
});
