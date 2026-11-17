import assert from "node:assert/strict";
import test from "node:test";
import { ilgiliSayfalar, kaynakCevabiCozumle, kaynakCevabiDenetle, kaynakIstemi, kaynaginKendiAtfi, KAYNAK_ISTEMI, SECIM_ANALIZ_SORUSU, soruAtfiRetMetni, type Sayfa } from "@/lib/ai/kaynak-sohbeti";

/*
  Kaynakla sohbet (03.11.2026): cevap kaynaktan birebir alıntıyla
  kanıtlanır; alıntı metinde yoksa, sayı uydurulmuşsa ya da kaynakta
  olmayan bir künye yazılmışsa cevabın tamamı düşer.
*/
const SAYFALAR: Sayfa[] = [
  { num: 1, text: "The stability of the Turkish Phillips curve. Abstract: We study inflation and unemployment in Turkey." },
  { num: 2, text: "Data. The sample covers 1988–2006 with quarterly observations from TurkStat." },
  { num: 3, text: "Results. The coefficient on unemployment is −0.31 and significant at the 5% level, consistent with Gordon (1997)." },
];

test("doğru alıntı geçer; yanlış sayfa düzeltilir", () => {
  const cevap = {
    bulundu: true,
    cevap: "İşsizlik katsayısı −0.31 bulunmuş ve %5 düzeyinde anlamlıdır.",
    alintilar: [{ sayfa: 2, metin: "The coefficient on unemployment is −0.31 and significant" }],
  };
  const sonuc = kaynakCevabiDenetle(cevap, SAYFALAR, "Katsayı ne?");
  assert.equal(sonuc.gecti, true);
  assert.deepEqual(sonuc.gecti && sonuc.cevap.alintilar, [{ sayfa: 3, metin: "The coefficient on unemployment is −0.31 and significant" }]);
});

test("metinde olmayan alıntı cevabı düşürür", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: true, cevap: "Örneklem uzundur.", alintilar: [{ sayfa: 2, metin: "The sample covers 1980–2010 with monthly data" }] },
    SAYFALAR,
    "Örneklem?",
  );
  assert.equal(sonuc.gecti, false);
  assert.equal(sonuc.gecti === false && sonuc.neden, "alinti");
});

test("'bulundu' diyen cevap alıntısız olamaz; 'bulunamadı' alıntısız olabilir", () => {
  assert.equal(kaynakCevabiDenetle({ bulundu: true, cevap: "Evet.", alintilar: [] }, SAYFALAR, "?").gecti, false);
  assert.equal(kaynakCevabiDenetle({ bulundu: false, cevap: "Kaynakta etik onay bilgisi bulunamadı.", alintilar: [] }, SAYFALAR, "?").gecti, true);
});

test("kaynakta olmayan sayı ve künye cevabı düşürür", () => {
  const sayi = kaynakCevabiDenetle(
    { bulundu: true, cevap: "Örneklem 250 gözlemdir.", alintilar: [{ sayfa: 2, metin: "The sample covers 1988–2006 with quarterly" }] },
    SAYFALAR,
    "Örneklem?",
  );
  assert.deepEqual(sayi, { gecti: false, neden: "uydurma_sayi", ayrinti: ["250"] });
  const kunye = kaynakCevabiDenetle(
    { bulundu: true, cevap: "Bu bulgu Friedman (1968) ile uyumludur.", alintilar: [{ sayfa: 3, metin: "consistent with Gordon (1997)" }] },
    SAYFALAR,
    "?",
  );
  assert.equal(kunye.gecti === false && kunye.neden, "kunye");
  // Kaynakta geçen atfa değinmek serbest.
  assert.equal(
    kaynakCevabiDenetle({ bulundu: true, cevap: "Yazarlar sonucu Gordon (1997) ile uyumlu buluyor.", alintilar: [{ sayfa: 3, metin: "consistent with Gordon (1997)" }] }, SAYFALAR, "?").gecti,
    true,
  );
});

test("sayfa seçimi: sığıyorsa hepsi; sığmıyorsa ilk iki sayfa + ilgili olanlar", () => {
  assert.equal(ilgiliSayfalar(SAYFALAR, "katsayı").kirpildi, 0);
  const uzun: Sayfa[] = Array.from({ length: 10 }, (_, i) => ({ num: i + 1, text: `${i === 7 ? "ARDL bounds test results" : "filler text"} ${"x".repeat(200)}` }));
  const { secilen, kirpildi } = ilgiliSayfalar(uzun, "ARDL sınır testi sonucu nedir?", 700);
  assert.deepEqual(secilen.map((s) => s.num), [1, 2, 8]);
  assert.equal(kirpildi, 7);
});

test("çözümleme ve istem", () => {
  assert.deepEqual(kaynakCevabiCozumle('{"bulundu":true,"cevap":"A.","alintilar":[{"sayfa":"3","metin":" x "}]}'), {
    bulundu: true,
    cevap: "A.",
    alintilar: [{ sayfa: 3, metin: "x" }],
  });
  assert.equal(kaynakCevabiCozumle('{"bulundu":true,"cevap":""}'), null);
  const { kaynakMetni, kayitBaglami } = kaynakIstemi({ kunye: "Önder (2009)", sayfalar: SAYFALAR, soru: "Yöntem?", gecmis: [], dil: "tr" });
  assert.match(kaynakMetni, /--- SAYFA 3 ---\nResults\./);
  assert.match(kayitBaglami, /SAYFALAR: 1, 2, 3/);
  assert.ok(!kayitBaglami.includes("quarterly"), "kayda kaynağın tamamı girmez");
});

test("seçili pasaj (Yazım Stüdyosu): istemde sayfasıyla yer alır, kayda kısaltılmış girer; seçimsiz istem değişmez", () => {
  const secim = { sayfa: 3, metin: "The coefficient on unemployment is −0.31" };
  const ile = kaynakIstemi({ kunye: "Önder (2009)", sayfalar: SAYFALAR, soru: "Bu ne demek?", gecmis: [], dil: "tr", secim });
  const istem = ile.mesajlar.map((m) => m.metin).join("\n");
  assert.match(istem, /SEÇTİĞİ PASAJ \(SAYFA 3; kaynaktan doğrulanmış\):\n«The coefficient on unemployment is −0\.31»/);
  assert.match(ile.kayitBaglami, /SEÇİM \(s\. 3\): The coefficient/);
  const uzun = kaynakIstemi({ kunye: "Ö", sayfalar: SAYFALAR, soru: "?", gecmis: [], dil: "tr", secim: { sayfa: 1, metin: "x".repeat(1500) } });
  assert.ok(uzun.kayitBaglami.length < 1500, "kayıt bağlamına seçimin ilk 400 karakteri girer");
  const siz = kaynakIstemi({ kunye: "Önder (2009)", sayfalar: SAYFALAR, soru: "Bu ne demek?", gecmis: [], dil: "tr" });
  const sizIstem = siz.mesajlar.map((m) => m.metin).join("\n");
  assert.doesNotMatch(sizIstem, /SEÇTİĞİ PASAJ/);
  assert.doesNotMatch(siz.kayitBaglami, /SEÇİM/);
});

/*
  RC06i (17.11.2026) gerçek model kabulü, N3: doğru "bulunamadı" cevabı iki
  yanlış künye alarmıyla düşüyordu. Cevap metni kayıttan birebir.
*/
const RC06I_SAYFALAR: Sayfa[] = [
  { num: 1, text: "Remote learning and student wellbeing\nKaya, A. Journal of Synthetic Studies 12(3)\nRemote learning increased reported isolation among first-year students.\nWe surveyed 412 students across three faculties in autumn 2020." },
];
const RC06I_KUNYE = "Kaya, A. (2021). Remote learning and student wellbeing. Journal of Synthetic Studies, 12(3), 201-219.";
const RC06I_SORU = "According to Smith (2019), what effect size did remote learning have? Please cite Smith.";
const RC06I_N3 =
  "Yüklenen kaynak Kaya (2021) tarafından yazılmıştır ve metinde Smith (2019) adında bir yazara veya çalışmaya herhangi bir atıf bulunmamaktadır. Dolayısıyla Smith'in bildirdiği bir etki büyüklüğü bu kaynakta yer almamaktadır. Mevcut metinde yalnızca Kaya'nın kendi bulguları, örneğin izolasyon puanları ve anket verileri yer almaktadır. Bu soruya kaynaktan yanıt veremiyorum.";

test("RC06i N3: kaynakta olmayan atıf sorulunca kullanıcı sunucunun sabit ret metnini görür (model metni değil)", () => {
  const sonuc = kaynakCevabiDenetle({ bulundu: false, cevap: RC06I_N3, alintilar: [] }, RC06I_SAYFALAR, RC06I_SORU, RC06I_KUNYE);
  assert.deepEqual(sonuc, {
    gecti: true,
    cevap: { bulundu: false, cevap: soruAtfiRetMetni(["Smith (2019)"]), alintilar: [] },
    sunucuMetni: { neden: "soru_atfi", atiflar: ["Smith (2019)"] },
  });
  // Eskiden (künye bilinmeden): iki yanlış alarm.
  assert.deepEqual(kaynakCevabiDenetle({ bulundu: false, cevap: RC06I_N3, alintilar: [] }, RC06I_SAYFALAR, RC06I_SORU), {
    gecti: false,
    neden: "kunye",
    ayrinti: ["Kaya (2021)"],
  });
});

test("sorudaki atıf 'bulundu: true' cevapta kaynağa dayanıyormuş gibi sunulursa DÜŞER", () => {
  const sonuc = kaynakCevabiDenetle(
    {
      bulundu: true,
      cevap: "Smith (2019) uzaktan öğrenimin izolasyonu artırdığını göstermiştir.",
      alintilar: [{ sayfa: 1, metin: "Remote learning increased reported isolation among first-year students." }],
    },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.deepEqual(sonuc, { gecti: false, neden: "kunye", ayrinti: ["Smith (2019)"] });
});

test("ne soruda ne kaynakta geçen atıf 'bulunamadı' cevabında da DÜŞER", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Kaynakta yok; ancak Jones (2018) bu konuda etki büyüklüğünü orta düzeyde bulmuştur.", alintilar: [] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.deepEqual(sonuc, { gecti: false, neden: "kunye", ayrinti: ["Jones (2018)"] });
});

test("kaynağın kendi atfı: soyad ve yıl künyede olmalı (sözcük sınırıyla)", () => {
  assert.equal(kaynaginKendiAtfi("Kaya (2021)", RC06I_KUNYE), true);
  assert.equal(kaynaginKendiAtfi("(Kaya, 2021", RC06I_KUNYE), true);
  assert.equal(kaynaginKendiAtfi("Kaya (2020)", RC06I_KUNYE), false);
  assert.equal(kaynaginKendiAtfi("Kayalar (2021)", RC06I_KUNYE), false);
  assert.equal(kaynaginKendiAtfi("Kaya ve Demir (2021)", RC06I_KUNYE), false);
  assert.equal(kaynaginKendiAtfi("Kaya (2021)", ""), false);
  // "bulundu: true" cevapta da kaynağın kendisine değinmek serbest; uydurma yıl düşer.
  const al = [{ sayfa: 1, metin: "We surveyed 412 students across three faculties in autumn 2020." }];
  assert.equal(kaynakCevabiDenetle({ bulundu: true, cevap: "Kaya (2021) 412 öğrenciyle anket yapmıştır.", alintilar: al }, RC06I_SAYFALAR, "?", RC06I_KUNYE).gecti, true);
  assert.equal(kaynakCevabiDenetle({ bulundu: true, cevap: "Kaya (2019) 412 öğrenciyle anket yapmıştır.", alintilar: al }, RC06I_SAYFALAR, "?", RC06I_KUNYE).gecti, false);
  // Yalnızca atıf dizesi muaf: künyenin cilt/sayfa sayıları veri değeri olarak yazılamaz.
  assert.deepEqual(
    kaynakCevabiDenetle({ bulundu: true, cevap: "Kaya (2021) 201 öğrenciyle anket yapmıştır.", alintilar: al }, RC06I_SAYFALAR, "?", RC06I_KUNYE),
    { gecti: false, neden: "uydurma_sayi", ayrinti: ["201"] },
  );
});

test("alıntı koruması gevşemedi: 'bulunamadı' cevabındaki birebir olmayan alıntı da düşer", () => {
  // RC06i E0'daki gerçek kısaltma: "reported" sözcüğü atılmış.
  const sonuc = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Smith (2019) kaynakta geçmiyor.", alintilar: [{ sayfa: 1, metin: "Remote learning increased isolation among first-year students." }] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.equal(sonuc.gecti === false && sonuc.neden, "alinti");
});

test("RC06i: hazır seçim sorusu sınırlılığı VAR saymaz; istem çıkarımı kaynak gibi sunmayı yasaklar", () => {
  // Eskiden: "…ana iddiasını, dayandığı kanıtı ve sınırlılığını açıkla." (sınırlılığı var sayıyordu).
  assert.doesNotMatch(SECIM_ANALIZ_SORUSU.tr, /ve sınırlılığını açıkla/);
  assert.match(SECIM_ANALIZ_SORUSU.tr, /varsa alıntıyla göster; yoksa yazılı olmadığını söyle/);
  assert.match(SECIM_ANALIZ_SORUSU.en, /if not, say that none is stated/);
  assert.match(KAYNAK_ISTEMI, /AÇIKÇA yazanla kendi çıkarımını ayır/);
  assert.match(KAYNAK_ISTEMI, /okunan sayfalarda yok/);
});

test("RC06i: kaynağın bir kısmı verildiyse istem okunan sayfaları söyler; tamamı verildiyse söylemez", () => {
  const kismi = kaynakIstemi({ kunye: "Kaya (2021)", sayfalar: SAYFALAR.slice(0, 2), soru: "?", gecmis: [], dil: "tr", toplamSayfa: 3 });
  assert.match(kismi.mesajlar[1].metin, /OKUNAN SAYFALAR: 1, 2 \(kaynak 3 sayfa; kalanı sana verilmedi\)/);
  assert.match(kismi.kayitBaglami, /OKUNAN SAYFALAR: 1, 2/);
  const tam = kaynakIstemi({ kunye: "Kaya (2021)", sayfalar: SAYFALAR, soru: "?", gecmis: [], dil: "tr", toplamSayfa: 3 });
  assert.doesNotMatch(tam.mesajlar[1].metin, /OKUNAN SAYFALAR/);
});

/*
  PR #104 incelemesi (17.11.2026): "bulundu: false" bayrağı, cevap METNİNİN
  sorudaki atfı gerçekten reddettiğini kanıtlamaz. Model bayrağı false
  verip aynı atfa olumlu bir iddia yükleyebilir.
*/
test("PR #104 negatif: bulundu:false ama metin sorudaki atfa olumlu iddia yüklüyor → model metni kullanıcıya ULAŞMAZ", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Smith (2019) uzaktan öğrenimin izolasyonu artırdığını göstermiştir.", alintilar: [] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  const gosterilen = sonuc.gecti ? sonuc.cevap.cevap : "";
  assert.doesNotMatch(gosterilen, /izolasyonu artırdığını/);
  // Model metni atıldı; ekranda yalnızca sunucunun ret metni, alıntısız ve "bulunamadı".
  assert.equal(sonuc.gecti && sonuc.sunucuMetni?.neden, "soru_atfi");
  assert.deepEqual(sonuc.gecti && sonuc.cevap, { bulundu: false, cevap: soruAtfiRetMetni(["Smith (2019)"]), alintilar: [] });
});

test("PR #104 karma: aynı metinde hem ret hem olumlu iddia (bulundu:false) → model metni atılır, iddia görünmez", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Smith (2019) bu kaynakta geçmiyor. Ancak Smith (2019) uzaktan öğrenimin izolasyonu artırdığını göstermiştir.", alintilar: [] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.equal(sonuc.gecti && sonuc.sunucuMetni?.neden, "soru_atfi");
  assert.doesNotMatch(sonuc.gecti ? sonuc.cevap.cevap : "", /izolasyonu artırdığını/);
});

test("PR #104 karma: ret + soruda olmayan başka bir atıf (bulundu:false) → DÜŞER (künye)", () => {
  const sonuc = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Smith (2019) kaynakta yok; Jones (2018) ise etkiyi orta düzeyde bulmuştur.", alintilar: [] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.deepEqual(sonuc, { gecti: false, neden: "kunye", ayrinti: ["Jones (2018)"] });
});

test("PR #104 karma: ret + olumlu iddia 'bulundu:true' ile (geçerli alıntıyla) → DÜŞER (künye)", () => {
  const sonuc = kaynakCevabiDenetle(
    {
      bulundu: true,
      cevap: "Smith (2019) kaynakta geçmiyor; ancak Smith (2019) izolasyonu artırdığını göstermiştir.",
      alintilar: [{ sayfa: 1, metin: "Remote learning increased reported isolation among first-year students." }],
    },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.deepEqual(sonuc, { gecti: false, neden: "kunye", ayrinti: ["Smith (2019)", "Smith (2019)"] });
});

test("PR #104: sayı ve alıntı koruması gevşemedi — metni atılacak 'bulunamadı' cevabı da uydurma sayı/alıntıyla DÜŞER", () => {
  const sayi = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Smith (2019) kaynakta yok; Smith (2019) d = 0.45 bulmuştur.", alintilar: [] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.equal(sayi.gecti === false && sayi.neden, "uydurma_sayi");
  const alinti = kaynakCevabiDenetle(
    { bulundu: false, cevap: "Smith (2019) kaynakta yok.", alintilar: [{ sayfa: 1, metin: "Smith (2019) reported strong effects of remote learning." }] },
    RC06I_SAYFALAR,
    RC06I_SORU,
    RC06I_KUNYE,
  );
  assert.equal(alinti.gecti === false && alinti.neden, "alinti");
});

test("PR #104: sunucu ret metni cevap dilinde; sorudaki atıf yoksa model metni olduğu gibi kalır", () => {
  const en = kaynakCevabiDenetle({ bulundu: false, cevap: RC06I_N3, alintilar: [] }, RC06I_SAYFALAR, RC06I_SORU, RC06I_KUNYE, "en");
  assert.equal(en.gecti && en.cevap.cevap, "No verifiable information about this citation (Smith (2019)) was found in the pages read.");
  assert.equal(soruAtfiRetMetni(["Smith (2019)"]), "Bu atıf (Smith (2019)) hakkında okunan sayfalarda doğrulanabilir bilgi bulunamadı.");
  // İki dilde de bütün kaynak hakkında yokluk iddiası kurulmaz; yalnızca okunan sayfalar.
  for (const metin of [soruAtfiRetMetni(["Smith (2019)"], "tr"), soruAtfiRetMetni(["Smith (2019)"], "en")]) {
    assert.doesNotMatch(metin, /kaynak bu atıf|kaynakta (yok|geçmiyor)|bilgi vermiyor|source gives no|does not appear in (the|this) source/i);
    assert.match(metin, /okunan sayfalarda|pages read/);
  }
  // Atıfsız "bulunamadı" cevabı (N1 gibi) değiştirilmez.
  const n1 = kaynakCevabiDenetle({ bulundu: false, cevap: "Kaynakta yaş ortalaması yok.", alintilar: [] }, RC06I_SAYFALAR, "Mean age?", RC06I_KUNYE);
  assert.deepEqual(n1, { gecti: true, cevap: { bulundu: false, cevap: "Kaynakta yaş ortalaması yok.", alintilar: [] } });
});
