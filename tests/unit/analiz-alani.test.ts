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

  test("ikili karşılaştırmalar yalnızca ANOVA anlamlıyken çiziliyor", () => {
    assert.match(analizci, /const ikili = sig \? tekrarliIkiliKarsilastirmalar\(/);
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
    assert.match(secici, /const \[sekme, setSekme\] = useState<"alan" \| "kayitli">\("alan"\);/);
    /* Sekme düğmesi yalnızca görünümü değiştiriyor. */
    assert.match(secici, /onClick=\{\(\) => setSekme\(s\.anahtar\)\}/);
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

  test("telefonda ayrı iç kenar çubuğu yok: tek sütun", () => {
    assert.match(stil, /@media \(max-width: 1100px\)/);
    assert.match(stil, /\.analiz-alan \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
});
