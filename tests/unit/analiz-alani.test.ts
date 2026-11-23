import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  ANALİZ ÇALIŞMA ALANI (22.11.2026, onaylı "A" tasarımı).

  Bu dosya ekranı değil, ekranın SÖZLEŞMELERİNİ sabitliyor: hesaplama
  dalları yerinde mi, yöntem listesi iki yerde birden çizilmiyor mu,
  dosya desteği metinde yazılanla aynı mı, asistan sayı üretmiyor mu.
  Bunlar gözle bakılınca doğru görünüp sessizce bozulabilen şeyler.
*/
const oku = (yol: string) => readFileSync(yol, "utf8");
const analizci = oku("app/dashboard/analysis/data-analyzer.tsx");
const gezgin = oku("app/dashboard/analysis/analiz-gezgini.tsx");
const yardim = oku("app/dashboard/analysis/analiz-yardimi.tsx");
const secici = oku("app/dashboard/analysis/analiz-secici.tsx");
const sayfa = oku("app/dashboard/analysis/page.tsx");
const stil = oku("app/styles/analiz-alani.css");

describe("yöntem seçimi tek yerde", () => {
  test("gezgin DataAnalyzer'ın çocuğu: analiz türü state'i yerinde kalıyor", () => {
    /* Tür yukarı taşınsa, türe bağlı düzeltmeler bir effect'e düşerdi. */
    assert.match(analizci, /calismaAlani\?: \{/);
    assert.match(analizci, /gezgin: \(p: \{ secili: AnalysisType; sec: \(tur: AnalysisType\) => void; veriYuklu: boolean \}\)/);
    assert.match(secici, /gezgin: \(\{ secili, sec, veriYuklu \}\) => <AnalizGezgini/);
  });

  test("iç yöntem kartları çalışma alanı kipinde çizilmiyor (iki liste olmaz)", () => {
    assert.match(analizci, /\{pencere && !calismaAlani \? \(/);
  });

  test("seçim düzeltmeleri tek fonksiyonda; kart da gezgin de onu çağırıyor", () => {
    assert.match(analizci, /const analiziSec = useCallback\(/);
    assert.match(analizci, /onClick=\{\(\) => analiziSec\(k\.tur\)\}/);
    /* Eski kopya kalmadı: iki ayrı düzeltme listesi sürüklenmemeli. */
    assert.equal(analizci.match(/ikiDegerliSutunlar\.map\(\(x\) => x\.ad\)/g)?.length, 1);
  });
});

describe("hesaplama davranışı korunuyor", () => {
  test("25 analiz dalı da yerinde", () => {
    const turler = [
      "descriptives", "ttest", "anova", "correlation", "chisquare", "reliability", "pairedttest",
      "mannwhitney", "kruskalwallis", "spearman", "regression", "ikiyonluanova", "wilcoxon",
      "friedman", "tekorneklem", "tekrarlianova", "ancova", "kismikorelasyon", "mcnemar",
      "lojistik", "faktor", "karmaanova", "aracilik", "duzenleyicilik", "dfa",
    ];
    for (const tur of turler) {
      assert.ok(analizci.includes(`analysisType === "${tur}"`), `${tur} dalı yok`);
    }
  });

  test("değişken alanları analize göre çiziliyor (tek bir ANOVA formu değil)", () => {
    /* Her birinin kendi alanı var: aynı formu bütün analizlere uygulamak
       seçilmeyen değişkenle hesap yapılmasına yol açıyordu. */
    assert.match(analizci, /analysisType === "tekorneklem" &&/);
    assert.match(analizci, /analysisType === "dfa"/);
    assert.match(analizci, /analysisType === "aracilik"/);
  });

  test("asistan sayı üretmiyor: sonuç kutusu ve asistan kartı ayrı", () => {
    assert.match(analizci, /className="analiz-sonuc"/);
    assert.match(analizci, /className="asistan-kart mt-md"/);
    assert.match(analizci, /yetenek="analiz"/);
    /* Asistanın çıktısı AsistanSonuc'tan geçiyor: bulgu listesi dışında biçim okunmuyor. */
    assert.match(analizci, /<AsistanSonuc/);
  });
});

/*
  DEĞİŞKEN SEÇİMİ TEK KURALDAN (23.11.2026). Analiz değişimi ve dosya
  yükleme eskiden AYRI kurallar uyguluyordu: handleFile seçili analiz ne
  olursa olsun varA'yı ilk sayısal sütuna atıyor, lojistik/McNemar
  seçiliyken ekranda görünen sütun ile state ayrışıyordu.
*/
describe("değişken seçimi iki yolda da aynı doğrulamadan geçiyor", () => {
  test("kural lib/analiz-secim.ts'te, bileşen yalnızca uyguluyor", () => {
    assert.match(analizci, /from "@\/lib\/analiz-secim"/);
    assert.match(analizci, /const secimiUygula = useCallback\(/);
    assert.match(analizci, /secimiDuzelt\(tur, mevcut, kaynak\)/);
  });

  test("analiz değişimi ortak uygulayıcıyı çağırıyor", () => {
    assert.match(analizci, /secimiUygula\(tur, \{ varA, varB, groupVar, groupVar2, varY \}, havuzlar\)/);
  });

  test("dosya yükleme de aynı uygulayıcıyı TAZE sütunlarla çağırıyor", () => {
    /* dataset state'i o anda henüz güncellenmediği için havuzlar az önce
       okunan sütunlardan kuruluyor. */
    assert.match(analizci, /const yeniHavuzlar = havuzlariKur\(\{ sayisal: numericColumns, kategorik: categoricalColumns \}, json\)/);
    assert.match(analizci, /secimiUygula\(analysisType, baslangic, yeniHavuzlar\)/);
    /* Eski koşulsuz atamalar kalmadı. */
    assert.ok(!/setVarA\(numericColumns\[0\]/.test(analizci), "handleFile artık koşulsuz atama yapmıyor");
    assert.ok(!/setVarB\(numericColumns\[1\]/.test(analizci));
  });

  test("düzeltme sonucu KOŞULSUZ state'e yazılıyor", () => {
    /*
      Eskiden her alan `mevcut` ile karşılaştırılıp yalnızca farklıysa
      yazılıyordu. Dosya yüklerken `mevcut` state değil geçici bir nesne
      olduğu için değer "değişmemiş" sayılıyor, setState çağrılmıyor ve
      state boş kalıyordu: kutu "grup" gösterirken hesap "grup
      değişkeninde 0 farklı değer bulundu" diyordu.
    */
    for (const setter of ["setVarA", "setVarB", "setGroupVar", "setGroupVar2", "setVarY"]) {
      assert.match(analizci, new RegExp(`\\n      ${setter}\\(secim\\.\\w+\\);`), `${setter} koşulsuz çağrılmalı`);
    }
    assert.ok(!/if \(secim\.\w+ !== mevcut\.\w+\)/.test(analizci), "fark karşılaştırmasıyla atlama kalmadı");
  });

  test("tek alan değişimi de ortak kuraldan geçiyor (bağımlı alan doğrulanır)", () => {
    assert.match(analizci, /const degiskenSec = useCallback\(/);
    assert.match(analizci, /secimiUygula\(analysisType, \{ varA, varB, groupVar, groupVar2, varY, \[alan\]: deger \}, havuzlar\)/);
    /* McNemar/lojistik kutuları ham setter yerine ortak yolu kullanıyor. */
    assert.match(analizci, /onChange=\{\(e\) => degiskenSec\("varA", e\.target\.value\)\}/);
    assert.match(analizci, /onChange=\{\(e\) => degiskenSec\("varB", e\.target\.value\)\}/);
  });

  test("zorunlu alana uygun sütun yoksa 'Analizi Çalıştır' çizilmiyor", () => {
    assert.match(analizci, /\{eksikAlanlar\.length \? \(/);
    assert.match(analizci, /className="analiz-eksik-alan"/);
    assert.match(analizci, /bu veriyle çalıştırılamıyor/);
  });

  test("boş havuzda select'in value'su ile görünen seçenek aynı kalıyor", () => {
    /* Her seçim kutusunun boş havuz için açık bir value="" seçeneği var. */
    assert.match(analizci, /İki kategorili sütun yok/);
    assert.match(analizci, /Uygun ikinci sütun yok/);
    assert.match(analizci, /Grup sütunu yok/);
    assert.match(analizci, /Kategorik sütun yok/);
    assert.match(analizci, /Sayısal sütun yok/);
  });

  test("McNemar'ın ikinci kutusu birinciyle aynı sütunu sunmuyor", () => {
    assert.match(analizci, /ikiDegerliSutunlar\.filter\(\(c\) => c\.ad !== varA\)/);
  });
});

/*
  TEKRARLI ÖLÇÜMLER SONRASI İKİLİ KARŞILAŞTIRMALAR (23.11.2026).
  Hesap bağımsız referanslara karşı sınanıyor
  (tests/unit/stats-tekrarli-ikili.test.ts); burada arayüzün o hesaba
  NE VERDİĞİ ve sonucu NASIL yazdığı sabitleniyor.
*/
describe("ikili karşılaştırmaların arayüz sözleşmesi", () => {
  test("satır eşleşmesi korunuyor: fonksiyona eşleşmiş sütunlar veriliyor", () => {
    /* eslesenSutunlar, bütün ölçümleri dolu satırları hizasını bozmadan
       veriyor; doğrudan ham sütun geçirmek çiftleri kaydırırdı. */
    assert.match(analizci, /const veri = eslesenSutunlar\(\.\.\.olcumler\);/);
    assert.match(analizci, /tekrarliIkiliKarsilastirmalar\(veri\.sutunlar, olcumler\)/);
  });

  test("eksik veri politikası sessiz değil: düşen satır sayısı yazılıyor", () => {
    assert.match(analizci, /\{elemeNotu\(veri, dil\) \? <p className="muted text-sm">\{elemeNotu\(veri, dil\)\}<\/p> : null\}/);
  });

  test("çoklu karşılaştırma düzeltmesinin ADI tabloda yazılı", () => {
    assert.match(analizci, /İkili karşılaştırmalar \(eşleştirilmiş t, Bonferroni düzeltmesi\)/);
    assert.match(analizci, /Pairwise comparisons \(paired t, Bonferroni correction\)/);
  });

  test("hesaplanamayan çift 'anlamlı değil' diye yazılmıyor", () => {
    /* engel null değilse p basılmıyor, sebebi yazılıyor. */
    assert.match(analizci, /\{c\.engel === null \? \(/);
    assert.match(analizci, /fark bütün katılımcılarda aynı \(varyans sıfır\)/);
    assert.match(analizci, /en az iki eşleşen gözlem gerekir/);
  });

  test("Mauchly denetlenemediyse 'varsayım sağlanıyor' yazılmıyor", () => {
    assert.match(analizci, /const kuresellikBozuk = r\.k > 2 && r\.kuresellikDenetlendi && isSignificant\(r\.mauchlyP\);/);
    assert.match(analizci, /\{r\.kuresellikDenetlendi \? \(/);
    assert.match(analizci, /Mauchly testi hesaplanamadı/);
    assert.match(analizci, /no verdict about sphericity is possible/);
    /* Denetlenemeyen durumda temkinli taraf: Greenhouse-Geisser. */
    assert.match(analizci, /const onerilen = kuresellikBelirsiz \? "gg"/);
  });

  test("KARMA ANOVA: küresellik kararı kuresellikDenetlendi'ye bağlı", () => {
    assert.match(analizci, /const kuresellikBozuk = olcumler\.length > 2 && r\.kuresellikDenetlendi && isSignificant\(r\.mauchlyP\);/);
    assert.match(analizci, /const kuresellikBelirsiz = olcumler\.length > 2 && !r\.kuresellikDenetlendi;/);
    /* Denetlenemediyse temkinli taraf: Greenhouse-Geisser. */
    assert.match(analizci, /const duzeltme = kuresellikBelirsiz \? "gg"/);
    assert.match(analizci, /\{r\.kuresellikDenetlendi \? \(\s*<>/);
  });

  test("KARMA ANOVA: GG düzeltmesi de üretilemezse açıkça bildiriliyor", () => {
    assert.match(analizci, /const epsGecerli = Number\.isFinite\(hamEps\) && hamEps > 0;/);
    assert.match(analizci, /const duzeltmeUygulanamadi = duzeltme !== null && !epsGecerli;/);
    assert.match(analizci, /Greenhouse-Geisser düzeltmesi de üretilemedi/);
    assert.match(analizci, /could not be produced either/);
  });

  test("sonlu olmayan p'den anlamlı/anlamsız hükmü üretilmiyor", () => {
    /* Üç değerli hüküm (lib/apa-format.ts pHukmu) ikili koşulla yazılamaz. */
    assert.match(analizci, /const etkilesimHukmu = pHukmu\(raporP\(r\.etkilesim\)\);/);
    assert.match(analizci, /p hesaplanamadı; etkileşim hakkında hüküm verilemez/);
    /* Basit etkiler de aynı hükümden geçiyor. */
    assert.equal(analizci.match(/const hukum = pHukmu\(b\.p\);/g)?.length, 2);
    assert.match(analizci, /p hesaplanamadı; hüküm verilemez/);
  });

  /*
    Buradaki eşleşmeler yalnızca SÖZLEŞMEYİ sabitler: hesabın kendisi
    tests/unit/karma-grup-ici-zaman.test.ts'te bağımsız referansa
    (pingouin) karşı, gerçek arayüzde ise analiz-alani-kabul.mjs
    S14f–S14h'de sınanıyor.
  */
  test("grup içi zaman etkisinde küresellik ayrı denetleniyor", () => {
    assert.match(analizci, /const ggGerekli = cokOlcum && \(!ta\.kuresellikDenetlendi \|\| isSignificant\(ta\.mauchlyP\)\);/);
    assert.match(analizci, /const ggVar = Number\.isFinite\(ta\.ggEpsilon\) && ta\.ggEpsilon > 0 && Number\.isFinite\(ta\.ggP\);/);
    assert.match(analizci, /bu grupta küresellik denetlenemedi; Greenhouse-Geisser düzeltmesi uygulandı/);
    assert.match(analizci, /bu grupta küresellik sağlanmıyor; Greenhouse-Geisser düzeltmesi uygulandı/);
  });

  /*
    SERBESTLİK DERECELERİ DE DÜZELTİLİR (23.11.2026). Eskiden F satırı
    düzeltilmemiş sd ile yazılıp yanına GG'li p konuyordu; iki sayı
    aynı testten gelmiyordu. Aile içi Bonferroni de korunmalı.
  */
  test("GG uygulanınca sd düzeltiliyor ve Bonferroni korunuyor", () => {
    assert.match(analizci, /df1: ggUygulandi \? ta\.df1 \* ta\.ggEpsilon : ta\.df1,/);
    assert.match(analizci, /df2: ggUygulandi \? ta\.df2 \* ta\.ggEpsilon : ta\.df2,/);
    assert.match(analizci, /p: Number\.isFinite\(hamP\) \? Math\.min\(1, hamP \* groupLevels\.length\) : NaN,/);
    /* Düzeltilmemiş sd tam sayı kalır; ondalıklı yazım düzeltmeyi gösterir. */
    assert.match(analizci, /const sd = \(v: number\) => \(b\.dfDuzeltildi \? yazSayi\(v, 2\) : String\(v\)\);/);
    assert.match(analizci, /düzeltilmiş p ve serbestlik dereceleri hesaplanamadı; hüküm verilemez/);
    /* Üretilemeyen düzeltme "uygulandı" diye yazılmamalı. */
    assert.match(analizci, /bu grupta küresellik denetlenemedi ve Greenhouse-Geisser düzeltmesi de üretilemedi/);
  });

  /*
    HESAPLANAMAYAN ETKİLEŞİMDE ANA ETKİ YÖNLENDİRMESİ YOK. "Etkileşim
    anlamlı olmadığı için…" paragrafı YALNIZCA "anlamsiz" dalında
    çizilmeli; eskiden hesaplanamayan durumda da çıkıyor ve üstteki
    "hüküm verilemez" satırıyla çelişiyordu.
  */
  test("çelişkili ana etki paragrafı yalnızca gerçekten anlamsızken", () => {
    assert.match(analizci, /\) : etkilesimHukmu === "anlamsiz" \? \(/);
    assert.match(analizci, /Etkileşim anlamlı olmadığı için \$\{groupVar\}/);
    assert.match(analizci, /varsayarak yorumlamayın/);
    /* Yönlendirme cümlesi tek yerde: ikinci bir kopya sessizce geri gelmesin. */
    assert.equal(analizci.match(/Etkileşim anlamlı olmadığı için/g)?.length, 1);
  });

  test("ikili karşılaştırmalar yalnızca ANOVA anlamlıyken çiziliyor", () => {
    assert.match(analizci, /const ikili = sig \? tekrarliIkiliKarsilastirmalar\(/);
  });
});

describe("güvenilirlik: α ve ω", () => {
  /*
    İKİ KATSAYI AYNI SATIRLARDAN (23.11.2026). α ve ω ayrı eleme
    yapsaydı tablodaki iki sayı farklı örneklemlere ait olurdu.
    Hesabın kendisi bağımsız referansa karşı
    tests/unit/stats-omega.test.ts'te; gerçek arayüz
    scripts/yerel-yigin/analiz-alani-kabul.mjs S16'da.
  */
  test("α ve ω aynı eşleşmiş sütunlardan hesaplanıyor", () => {
    assert.match(analizci, /const r = cronbachAlpha\(veri\.sutunlar\);/);
    assert.match(analizci, /const omega = mcdonaldOmega\(veri\.sutunlar, reliabilityItems\);/);
    /* Eleme notu ve N aynı `veri` nesnesinden. */
    assert.match(analizci, /Güvenilirlik: \$\{r\.k\} madde, N = \$\{r\.n\}/);
    assert.match(analizci, /elemeNotu\(veri, dil\)/);
  });

  test("model, kestirim ve puanlama ekranda yazılı", () => {
    assert.match(analizci, /tek faktörlü doğrulayıcı faktör analizi/);
    assert.match(analizci, /en çok olabilirlik/);
    assert.match(analizci, /HAM madde toplam puanı/);
    assert.match(analizci, /one-factor confirmatory factor analysis/);
    assert.match(analizci, /RAW item total score/);
  });

  /* Model kurulabiliyor olmak uyduğu anlamına gelmez; ekran bunu söylemeli. */
  test("tek faktörlü model tek boyutluluğun kanıtı diye sunulmuyor", () => {
    assert.match(analizci, /TEK BOYUTLU olduğunun kanıtı değildir/);
    assert.match(analizci, /NOT evidence that the scale is unidimensional/);
  });

  test("ω üretilemediğinde sayı değil sebep yazılıyor", () => {
    assert.match(analizci, /omega\.engel === null \? yazSayi\(omega\.omega, 3\) : HESAPLANAMADI/);
    assert.match(analizci, /t\(OMEGA_ENGEL_METNI\[omega\.engel\]\)/);
  });

  test("ters madde çevrilmiyor, bildiriliyor", () => {
    assert.match(analizci, /KENDİLİĞİNDEN ÇEVİRMEZ/);
    assert.match(analizci, /does NOT reverse items automatically/);
    const omega = oku("lib/stats-omega.ts");
    /* Mutlak değer alınsaydı kullanıcının yapmadığı dönüşüm yapılmış olurdu. */
    assert.doesNotMatch(omega, /Math\.abs\(s\.yuk\)|Math\.abs\(y\.b\)/);
    assert.match(omega, /tersYuklenen/);
  });

  /* İki madde alfayı düşürmemeli: kapı yalnızca ω'da. */
  test("iki maddede güvenilirlik akışı durmuyor", () => {
    assert.match(analizci, /if \(reliabilityItems\.length < 2\) \{/);
    assert.match(oku("lib/stats-omega.ts"), /export const OMEGA_EN_AZ_MADDE = 3;/);
  });
});

describe("gerekli veri kartı: güvenilirlikten bütün analizlere", () => {
  /*
    Kart dosya SEÇİLMEDEN önce görünür. Öğrenciler ölçek güvenilirliği
    için sık sık tek bir toplam puan sütunu yüklüyor; o dosyayla hiçbir
    şey hesaplanamıyor ve hata ancak yüklemeden sonra görülüyordu.
    23.11.2026'da kart güvenilirliğe özel bir blok olmaktan çıkıp
    AYRI bir bileşene (veri-rehberi-karti.tsx) ve tek bir içerik
    kaynağına (lib/analiz-veri-rehberi.ts) taşındı; bütün analizlerde
    çiziliyor. Metin sınavları o kaynağa bakar.
  */
  const kart = oku("app/dashboard/analysis/veri-rehberi-karti.tsx");
  const rehber = oku("lib/analiz-veri-rehberi.ts");

  test("kart her analizde, veri yüklenmeden önce açık çiziliyor", () => {
    assert.match(analizci, /\{!dataset && !loading \? <VeriRehberiKarti tur=\{analysisType\}/);
    assert.match(kart, /className="analiz-veri-karti"/);
    assert.match(stil, /\.analiz-veri-karti \{/);
  });

  /* Veri geldikten sonra ilk ekran kalabalıklaşmasın: özet içinde. */
  test("veri yüklendikten sonra 'Veri gereksinimlerini gör' özetinde kalıyor", () => {
    assert.match(analizci, /\{dataset \? <VeriRehberiKarti tur=\{analysisType\} secenek=\{rehberSecenekleri\} katlanir/);
    assert.match(kart, /tr: "Veri gereksinimlerini gör", en: "See the data requirements"/);
    assert.match(stil, /\.analiz-veri-karti-katli > summary \{/);
  });

  test("güvenilirliğin dört cümlesi iki dilde ve sade", () => {
    for (const [tr, en] of [
      ["Her satır bir katılımcı, her sütun bir anket maddesi.", "Each row is one participant, each column is one questionnaire item."],
      ["Hücrelere verilen yanıtları yazın.", "Write the given answers in the cells."],
      ["Yalnızca toplam puan yeterli değildir.", "A total score on its own is not enough."],
      ["Katılımcı sütunu isteğe bağlıdır ve analize seçilmez.", "A participant column is optional and is not selected for the analysis."],
    ]) {
      assert.ok(rehber.includes(tr), tr);
      assert.ok(rehber.includes(en), en);
    }
  });

  /* Üç madde ω'yı GARANTİ ETMEZ: model kestirilemeyebilir. */
  test("en az madde sayıları yazılı, ω garanti edilmiyor", () => {
    assert.match(rehber, /Cronbach α için en az 2 madde, McDonald ω için en az 3 madde gerekir/);
    assert.match(rehber, /GARANTİ ETMEZ/);
    assert.match(rehber, /at least 2 items and McDonald's ω at least 3/);
    assert.match(rehber, /does NOT guarantee that ω can be computed/);
  });

  test("örnek tablo ve boş şablon aynı kartta, aynı tanımdan", () => {
    assert.match(kart, /tr: "Örnek tabloyu gör", en: "See an example table"/);
    assert.match(kart, /tr: "Boş şablonu indir", en: "Download the blank template"/);
    assert.match(kart, /onClick=\{sablonuIndir\}/);
    assert.match(kart, /rehberSablonCsv\(rehber, dil\)/);
    /* Başlıklar ve örnek satırlar TEK kaynaktan: ayrışamazlar. */
    assert.match(kart, /rehberBasliklari\(rehber, dil\)/);
    assert.match(kart, /rehberOrnekSatirlari\(rehber, dil\)/);
  });

  /* Kartın "sık yapılan hata" notu KALICI bir açıklama: canlı durum
     uyarılarıyla aynı seçiciye girmemeli. Eskiden `.alert[data-tone="warning"]`
     kullanıyordu; veri yüklendikten sonra kart formun üstünde durduğu için
     "sonuç eskidi" uyarısını arayan her okuyucu (test de kullanıcı da)
     önce bu kalıcı notu buluyordu. */
  test("yaygın hata notu canlı uyarı seçicisine girmiyor", () => {
    assert.doesNotMatch(kart, /className="alert[^"]*" data-tone="warning"/);
    assert.match(kart, /className="analiz-veri-karti-hata mt-sm" role="note"/);
    assert.match(stil, /\.analiz-veri-karti-hata \{/);
  });

  /* Dosya istemeyen Güç ve Örneklem'de rehber yok; yönteme özgü form
     girdileri "Hangi bilgiler gerekli?" kartında anlatılıyor. */
  test("güç panelinin kartı yönteme özgü girdileri anlatıyor", () => {
    const guc = oku("app/dashboard/analysis/guc-paneli.tsx");
    assert.match(guc, /tr: "Dağılım oranı", en: "Allocation ratio"/);
    assert.match(guc, /yontem === "tekYonluAnova" \? \(\s*<li>/);
    assert.match(guc, /yontem === "regresyon" \? \(\s*<li>/);
    assert.match(guc, /tr: "Beklenen kayıp oranı", en: "Expected dropout rate"/);
  });
});

describe("güç ve örneklem: kaydırma ve yerleşim", () => {
  /*
    GÜÇ KARTI KIRPILIYORDU. Tek ekran kilidi (.dashboard-content-shell:
    height 100dvh + overflow hidden) sayfayı kaydırmıyor; çalışma alanı
    sekmesinde sağdaki kart kendi içinde kayıyor. Güç kartı
    `.analiz-alan`ın içinde değil, sekme panelinin doğrudan çocuğu
    olduğu için ona hiçbir kural kayma vermiyordu: 1440x900'de 1201 px
    gövde 623 px'e kırpılıyor, zincirdeki tek overflow `hidden` olduğu
    için tekerlek hiçbir şeyi oynatmıyordu.
  */
  const guc = oku("app/dashboard/analysis/guc-paneli.tsx");

  test("güç sekmesinin kartı kendi içinde kayıyor", () => {
    assert.match(stil, /#analiz-panel-guc > \.analiz-guc \{[^}]*overflow-y: auto/);
    /* Kilit yalnızca 1101 px üstünde ve 640 px'ten uzun pencerelerde. */
    assert.match(stil, /@media \(min-width: 1101px\) and \(min-height: 640px\) \{\s*#analiz-panel-guc/);
  });

  /* Alanlar seçimlerin HEMEN ALTINDA: uzun kart artık altta. */
  test("girdiler 'Hangi bilgiler gerekli?' kartından ÖNCE çiziliyor", () => {
    const girdiler = guc.indexOf('className="analiz-guc-girdiler"');
    const kart = guc.indexOf('className="analiz-veri-karti"');
    const yontem = guc.indexOf('className="analiz-guc-yontem"');
    assert.ok(yontem > 0 && girdiler > yontem, "girdiler yöntem seçiminden sonra");
    assert.ok(kart > girdiler, "kart girdilerden sonra");
  });

  test("yöntem listesi masaüstünde iki sütuna iniyor", () => {
    assert.match(stil, /@media \(min-width: 900px\) \{\s*\.analiz-guc-yontem \{ grid-template-columns: repeat\(auto-fit/);
  });

  /* Üç kavramın kısa hâli alanının altında, uzunu açılır bölümde. */
  test("kısa ipuçları alanların içinde, ayrıntı açılır bölümde", () => {
    assert.match(guc, /Cohen eşikleri küçük/);
    assert.match(guc, /yanlış alarm\. Yaygın değer 0,05/);
    assert.match(guc, /YAKALAMA olasılığınız\. Yaygın değer 0,80/);
    assert.match(guc, /<details className="analiz-guc-ayrinti">/);
    assert.match(stil, /\.analiz-guc-ayrinti > summary \{/);
  });
});

describe("eskiyen sonuç ve veri değişimi", () => {
  test("tazelik denetimi çalıştırılan seçimle ekrandaki seçimi karşılaştırıyor", () => {
    assert.match(analizci, /tazelikDenetle\(calisanAnaliz, \{ tur: analysisType, secim: guncelSecim \}\)/);
    assert.match(analizci, /setCalisanAnaliz\(\{ secim: guncelSecim, tur: analysisType, baslik \}\)/);
  });

  test("eskimiş sonuç siliniyor değil, işaretleniyor", () => {
    assert.match(analizci, /\{tazelikUyarisi \? \(/);
    assert.match(analizci, /data-eskidi=\{tazelik\.eskidi \? "1" : undefined\}/);
    assert.match(stil, /\.results-divider\[data-eskidi\]/);
  });

  test("veri değiştirmek kaydedilmemiş sonuç varken onay istiyor", () => {
    assert.match(analizci, /const kayip = Boolean\(result\) && !kaydedildi;/);
    assert.match(analizci, /window\.confirm\(/);
    assert.match(analizci, /Veriyi değiştirirseniz ekrandaki sonuç ve değişken seçimleriniz silinir/);
  });

  /*
    İŞARETİN ANLAMI AYRIK (22.11.2026). ✓ hesabın bittiğini söyler.
    "Kontroller" adımı HİÇBİR KOŞULDA ✓ almaz: ArvoLab varsayım
    değerlerini yazar, "geçti" hükmü vermez. İlk sürümde analiz
    çalışınca üç adım da yeşil onay alıyor ve varsayımlar geçmiş gibi
    okunuyordu.
  */
  test("başarı işareti denetim yapılmadan verilmiyor", () => {
    const adimlar = oku("app/dashboard/analysis/analiz-adimlari.tsx");
    assert.match(adimlar, /const tazeSonuc = sonucVar && !eskidi;/);
    /* Kontroller adımı: "okunacak", "tamam" değil. */
    assert.match(adimlar, /durum: tazeSonuc \? "okunacak" : "bekliyor"/);
    /* Sonuç adımı ✓ alır ve ✓'in anlamı yazılı. */
    assert.match(adimlar, /durum: tazeSonuc \? "tamam" : "bekliyor"/);
    assert.match(adimlar, /Hesap tamamlandı/);
    assert.match(adimlar, /“geçti” hükmü vermez/);
    assert.match(adimlar, /does not rule them “passed”/);
    /* ✓ ikonu yalnızca "tamam" durumunda çiziliyor. */
    assert.match(adimlar, /adim\.durum === "tamam" \? <Check/);
  });

  test("eskimiş sonuç kaydedilemiyor, kopyalanamıyor, sıraya konamıyor", () => {
    /* Uyarıyı okumak yetmiyordu: düğme açık kaldığı sürece basılıyordu. */
    assert.match(analizci, /onClick=\{sonucuKopyala\} disabled=\{tazelik\.eskidi\}/);
    assert.equal(analizci.match(/disabled=\{kaydediliyor \|\| tazelik\.eskidi\}/g)?.length, 2);
    assert.match(analizci, /Kaydetme, kopyalama ve teze ekleme, sonuç güncel seçimle hesaplanana kadar kapalı/);
  });
});

describe("dosya desteği metinle aynı", () => {
  test("kabul edilen uzantılar ile yazılan uzantılar örtüşüyor", () => {
    const m = analizci.match(/accept="([^"]+)"/);
    assert.ok(m, "dosya girdisi bulunamadı");
    const kabul = m[1].split(",").map((x) => x.trim());
    assert.deepEqual(kabul, [".xlsx", ".xls", ".csv", ".tsv", ".txt"]);
    /* Ekrandaki metin de AYNI beşini sayıyor: eskiden yalnızca
       "Excel ya da CSV" yazıyordu ve .tsv/.txt desteği görünmüyordu. */
    assert.match(analizci, /\.xlsx, \.xls, \.csv, \.tsv, \.txt/);
    /* .sav kabul edilmiyor ve bu AÇIKÇA yazılı (sessiz yokluk değil). */
    assert.ok(!kabul.includes(".sav"));
    assert.match(analizci, /SPSS'in \.sav dosyası okunmaz/);
    assert.match(analizci, /SPSS \.sav files are not read/);
  });

  test("SPSS girişi yalnızca ÇIKTIDAN YAPIŞTIRILAN değerleri biçimlendirdiğini söylüyor", () => {
    assert.match(sayfa, /SPSS \/ Diğer program çıktısı/);
    assert.match(sayfa, /SPSS \/ other program output/);
    /* ArvoLab SPSS'i çalıştırmıyor ve .sav okumuyor: ikisi de açıkça yazılı. */
    assert.match(sayfa, /SPSS'i çalıştırmaz/);
    assert.match(sayfa, /\.sav gibi program dosyaları okunmaz/);
    assert.match(sayfa, /does not run SPSS/);
    assert.match(sayfa, /program files such as \.sav are not read/);
  });

  test("hesabın tarayıcıda yapıldığı yazısı duruyor", () => {
    assert.match(analizci, /Hesap tarayıcınızda yapılır, dosyanız sunucuya gitmez/);
  });
});

describe("gezgin ve yardım", () => {
  test("kategoriler ve arama tek kaynaktan", () => {
    assert.match(gezgin, /from "@\/lib\/analiz-kategorileri"/);
    assert.match(gezgin, /kategorileriSuz\(terim\)/);
  });

  test("veri yüklenmeden liste gezilebilir, hesap başlamaz", () => {
    assert.match(gezgin, /Listeyi şimdi gezebilirsiniz/);
    /* "Analizi Çalıştır" yalnızca dataset varken çiziliyor (dataset && bloğunun içinde). */
    const run = analizci.indexOf("Analizi Çalıştır");
    const datasetBlok = analizci.indexOf("{dataset && (");
    assert.ok(datasetBlok > 0 && run > datasetBlok, "çalıştır düğmesi veri bloğunun içinde olmalı");
  });

  test("sonuç yok durumu tasarlanmış", () => {
    assert.match(gezgin, /className="analiz-gezgin-bos"/);
    assert.match(gezgin, /Aramayı temizle/);
  });

  test("yardım hesap yapmıyor, veri okumuyor, ücretli çağrı yapmıyor", () => {
    assert.ok(!/fetch\(|useTransition|server|action/i.test(yardim), "yardım paneli sunucuya gitmemeli");
    assert.match(yardim, /analizOnerisi\(yanitlar\)/);
    assert.match(yardim, /veriniz okunmaz ve hiçbir analiz çalıştırılmaz/);
  });

  test("analizi açmak kullanıcının eylemi", () => {
    assert.match(yardim, /Bu analizi aç/);
    assert.match(yardim, /onClick=\{\(\) => analiziAc\(aday\.tur\)\}/);
  });

  test("gezgin seçili satırı renkten başka bir işaretle de bildiriyor", () => {
    assert.match(gezgin, /aria-current=\{tur === secili \? "true" : undefined\}/);
    assert.match(stil, /\.analiz-gezgin-oge\[aria-current\]/);
  });
});

describe("sekmeler ve kayıt", () => {
  test("sekme açmak hiçbir şey kaydetmiyor", () => {
    /* Üçüncü sekme "guc" 23.11.2026'da eklendi: veri dosyası istemeyen güç çözümlemesi. */
    assert.match(secici, /const \[sekme, setSekme\] = useState<"alan" \| "guc" \| "kayitli">\("alan"\);/);
    /* Sekme düğmesi yalnızca görünümü değiştiriyor. */
    assert.match(secici, /onClick=\{\(\) => setSekme\(s\.anahtar\)\}/);
  });

  /*
    GÜÇ BÖLÜMÜ AYRI AKIŞ. Örneklem kararı veri TOPLANMADAN önce
    verilir; dosya yükleme akışının içine konsaydı kullanıcıdan
    olmayan bir dosya istenmiş olurdu.
  */
  test("güç ve örneklem ayrı sekmede, veri dosyası istemiyor", () => {
    assert.match(secici, /tr: "Güç ve örneklem", en: "Power and sample size"/);
    assert.match(secici, /hidden=\{sekme !== "guc"\}/);
    assert.match(secici, /<GucPaneli \/>/);
    const panel = oku("app/dashboard/analysis/guc-paneli.tsx");
    assert.doesNotMatch(panel, /dropzone|handleFile|dataset/);
  });

  test("kayıtlı analizler doğru çalışmanın analizleri", () => {
    assert.match(sayfa, /calismaAnalizleri\(calisma\.id\)/);
    assert.match(sayfa, /key=\{calisma\.id\}/);
  });

  test("ham veri olmadan hesabın sürdürülemeyeceği yazılı", () => {
    assert.match(secici, /Kaydedilen yalnızca sonuç metnidir; veri dosyanız sunucuya gitmez/);
  });

  test("iki panel de bağlı kalıyor: sekme değişimi çalışma alanını sıfırlamıyor", () => {
    assert.match(secici, /hidden=\{sekme !== "alan"\}/);
    assert.match(secici, /hidden=\{sekme !== "kayitli"\}/);
  });
});

describe("stil kapsamı", () => {
  test("yalnızca Analiz Merkezi'nin sınıflarına dokunuyor", () => {
    const css = stil.replace(/\/\*[\s\S]*?\*\//g, "");
    const seciciler = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean);
    assert.ok(seciciler.length > 30);
    for (const s of seciciler) {
      for (const p of s.split(",")) {
        assert.match(
          p,
          /\.analiz|\.veri-incele|\.dropzone|\.gb-tek-ekran|\.dashboard-content-shell|\.results-divider|\.project-form-card|\.project-form-grid|\.project-form-actions|\.file-info-bar|\.sutun-secimi|html\[lang/,
          `kapsam dışı seçici: ${p.trim()}`,
        );
      }
    }
  });

  test("ham renk yok, en küçük yazı 12px", () => {
    const css = stil.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 12);
  });

  test("sayfa başına genişlik yaması yok: genişlik ortak kaptan", () => {
    /* @media sorguları ve minmax() hariç: ilki kırılım, ikincisi sütun payı. */
    const kurallar = stil.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/g, "{");
    const bildirimler = [...kurallar.matchAll(/(^|[;{\s])max-width:\s*([^;}]+)/g)]
      .map((m) => m[2].trim())
      /* ch birimi SATIR UZUNLUĞU sınırıdır (okunabilirlik), sayfa genişliği değil. */
      .filter((v) => !v.endsWith("ch"));
    assert.deepEqual(bildirimler, [], "genişlik ortak kaptan (.dashboard-page) gelmeli");
  });

  /*
    YARDIM ÇALIŞMA ALANINI DARALTMIYOR. İlk sürümde panel açılınca
    sol sütun 260'tan 420 px'e genişliyor, sağdaki çalışma alanı aynı
    oranda daralıyordu: yardım isteyen kullanıcı yapılandırmasını
    kaybediyordu.
  */
  test("yardım açıkken sütun genişliği değişmiyor", () => {
    assert.doesNotMatch(stil, /\.analiz-alan:has\(\.analiz-yardim\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*4/);
    assert.match(stil, /--analiz-gezgin-genislik/);
  });

  /*
    ARDIŞIK SONUÇ TABLOLARI (23.11.2026). Karma ANOVA'da hücre
    ortalamaları ve ANOVA tablosu alt alta çiziliyor; iki kaydırma
    kutusunun kenarlıkları yapışıkken tek bir tablo gibi okunuyordu.
    Boşluk ölçekten alınıyor (--s-4 = 16px): ham piksel yazılsaydı
    ölçek değiştiğinde burası geride kalırdı.
  */
  test("ardışık sonuç tablolarının arası boşluk ölçeğinden geliyor", () => {
    assert.match(stil, /\.analiz-sonuc \.analiz-tablo-aralik \{ margin-top: var\(--s-4\); \}/);
    assert.match(oku("app/styles/tokens.css"), /--s-4: 16px;/);
    /* Boşluk tablonun değil DIŞ kapsayıcının üstünde. */
    assert.match(analizci, /className="table-scroll analiz-tablo-aralik"/);
    /* Yalnızca ikinci tabloda: ilk tablo sonuç kartının başında boşluk almamalı. */
    assert.equal(analizci.match(/table-scroll analiz-tablo-aralik/g)?.length, 1);
  });

  /*
    GENİŞ TABLO SAYFAYI KAYDIRMASIN (23.11.2026). .analiz-sonuc bir
    grid; içindeki sarmalayıcının min-width'i "auto" olduğu için geniş
    bir tablo onu max-content'e büyütüyordu. Sonuç: tablo kendi
    kaydırma kutusuna sığıyor (hiç kaymıyor), taşma SAYFAYA çıkıyor —
    telefonda bütün ekran yana kayıyordu. Gerçek ölçüm
    analiz-alani-kabul.mjs S15b'de (12 ölçümlü karma desen).
  */
  test("sonuç kartının grid çocukları sütuna sığıyor", () => {
    assert.match(stil, /\.analiz-sonuc > \* \{ min-width: 0; \}/);
  });

  test("telefonda ayrı iç kenar çubuğu yok: tek sütun", () => {
    assert.match(stil, /@media \(max-width: 1100px\)/);
    assert.match(stil, /\.analiz-alan \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
});
