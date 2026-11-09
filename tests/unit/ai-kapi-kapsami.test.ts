import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

/*
  lib/ai/erisim.ts İÇE ALINMIYOR: Supabase sunucu istemcisine, o da
  next/headers'a zincirleniyor ve tests/unit bilerek Next'e dokunmuyor
  (AGENTS.md). Bu yüzden anahtar da kaynak metninden okunuyor — kaba ama
  aranan şey bir davranış değil, bir dizgenin biçimi.
*/

/*
  "Yeni yetenek lib/ai/erisim.ts kapısından geçer" (AGENTS.md).

  Bu değişmezi hiçbir şey denetlemiyordu. Dört yeteneğin dördü de doğru
  bağlanmıştı ama BEŞİNCİSİ yazılırken kapıyı, saatlik hakkı ya da kaydı
  atlamak tek satır unutmakla oluyor ve hiçbir hata vermiyor: yetenek
  çalışır, yalnızca ücretsiz ve kayıtsız çalışır.

  Denetim kaynak dosyalara bakıyor. Kaba bir yöntem ama burada doğru olanı:
  yetenekler Supabase ve model çağırıyor, yani çalıştırılarak sınanamıyor;
  aranan şey de bir davranış değil, bir çağrının VARLIĞI.
*/
const YETENEK_DOSYALARI = readdirSync("app/actions").filter((ad) => /^ai-.*\.ts$/.test(ad));

/*
  Hangi dosya bir YETENEK giriş noktası?

  Ölçüt model çağrısının ADI değil — yeni bir yetenek yeni bir yardımcı
  kullanıp öyle bir listeden kaçardı. Ölçüt yetenek KİMLİĞİ: veritabanı
  capability değerini dörtle sınırlıyor (20260924100005) ve her yetenek
  kendi kimliğini koda yazmak zorunda. Beşinci ve altıncı yetenek (kanıt
  uyumu ve makale bölüm denetimi, migration 20261026065320) da yazıyor.

  Okuma yapan dosyalar (ai-gecmis, ai-kayitlar, ai-puan) kimlik yazmıyor ve
  kapıdan geçmiyor — doğru: kayıtlı cevabı göstermek hak yakmamalı.
*/
/* "yazim" ve "kaynak" C2-6'da eklendi: ikisi de model çağırıyor ama denetimin dışında kalmıştı. */
const YETENEK_KIMLIKLERI = ["analiz", "kaynakca", "literatur", "belge", "kanit", "makale", "yazim", "kaynak"];
const yetenekKimligi = (kaynak: string) =>
  YETENEK_KIMLIKLERI.find((kimlik) => new RegExp(`yetenek:\\s*"${kimlik}"`).test(kaynak));

/*
  C2-6 (V4.3): denetçinin KENDİSİ de sınanır. Eskiden liste yazım asistanı
  ("yazim") ve kaynakla sohbeti ("kaynak") içermiyordu: iki dosyanın
  kapı, hak ya da kayıt çağrısı silinse test yeşil kalırdı. Denetçi bir
  işlev; gerçek dosyada eksik yok, çağrısı silinmiş kopyada eksik bulunur
  (kör kalan denetim denetlediği hatadan farksızdır).
*/
const ZORUNLU_CAGRILAR: [RegExp, string][] = [
  [/asistanKapisi\(/, "kapı"],
  [/asistanHakkiVar\(/, "hak"],
  [/asistanKaydet\(/, "kayıt"],
];
const eksikCagrilar = (kaynak: string) => (yetenekKimligi(kaynak) ? ZORUNLU_CAGRILAR.filter(([k]) => !k.test(kaynak)).map(([, ad]) => ad) : null);

test("C2-6 yazım asistanı ve kaynakla sohbet kapı denetiminin içinde; silinen çağrı yakalanır", () => {
  for (const [dosya, kimlik] of [["app/actions/ai-yazim.ts", "yazim"], ["app/actions/ai-kaynak-sohbeti.ts", "kaynak"]] as const) {
    const kaynak = readFileSync(dosya, "utf8");
    assert.equal(yetenekKimligi(kaynak), kimlik, `${dosya}: yetenek denetimin dışında`);
    assert.deepEqual(eksikCagrilar(kaynak), [], `${dosya}: gerçek dosyada eksik çağrı`);
    for (const [kalip, ad] of ZORUNLU_CAGRILAR) {
      const silinmis = kaynak.replace(new RegExp(kalip.source, "g"), "kaldirildi(");
      assert.deepEqual(eksikCagrilar(silinmis), [ad], `${dosya}: ${ad} çağrısı silinince denetim yakalamadı`);
    }
  }
});

test("asistan kapısının kapsamı", async (t) => {
  const dosyalar = YETENEK_DOSYALARI.map((ad) => ({ ad, kaynak: readFileSync(`app/actions/${ad}`, "utf8") }));

  await t.test("yetenek dosyaları bulundu", () => {
    // Dizin adı değişirse test sessizce boşalmasın.
    assert.ok(dosyalar.length >= YETENEK_KIMLIKLERI.length, `ai-*.ts bulunamadı: ${dosyalar.length}`);
  });

  await t.test("her yetenek kapıdan, haktan ve kayıttan geçiyor", () => {
    const yetenekli = dosyalar.filter((d) => yetenekKimligi(d.kaynak));
    // Hepsi bulunmalı: biri kaybolursa denetim sessizce daralır.
    assert.deepEqual(
      yetenekli.map((d) => yetenekKimligi(d.kaynak)).sort(),
      [...YETENEK_KIMLIKLERI].sort(),
      `bulunan yetenekler: ${yetenekli.map((d) => d.ad)}`,
    );

    for (const { ad, kaynak } of yetenekli) {
      // Dil argümanı alabilir (lib/dil.ts): asistanKapisi(dil).
      assert.match(kaynak, /asistanKapisi\(/, `${ad}: abonelik/kurulum kapısı yok`);
      assert.match(kaynak, /asistanHakkiVar\(/, `${ad}: saatlik hak sayacı yok`);
      assert.match(kaynak, /asistanKaydet\(/, `${ad}: çalışma kaydı yok`);
    }
  });

  await t.test("hiçbir yetenek kendi sayacını kurmuyor", () => {
    /*
      Sayaç KULLANICI başına: maliyeti yeteneğin adı değil model çağrısının
      kendisi üretiyor. Yetenek kendi rate_limit_hit'ini çağırırsa aynı
      kullanıcı her yetenekten ayrı hak kazanır ve toplamda sınırın katını
      harcar.
    */
    for (const { ad, kaynak } of dosyalar) {
      assert.doesNotMatch(kaynak, /rate_limit_hit/, `${ad}: kendi sayacını kuruyor`);
    }
  });

  await t.test("saatlik hak anahtarı yalnızca kullanıcıyı taşıyor", () => {
    /*
      Sayaç KULLANICI başına: maliyeti yeteneğin adı değil model çağrısının
      kendisi üretiyor. Anahtara yetenek adı eklemek tek satır ve hiçbir
      hata vermez — yalnızca aynı kullanıcı her yetenekten ayrı hak kazanır
      ve toplamda sınırın katını harcar.
    */
    const erisim = readFileSync("lib/ai/erisim.ts", "utf8");
    const anahtar = erisim.match(/p_key:\s*(.+),/)?.[1] ?? "";
    assert.ok(anahtar.includes("${kullaniciId}"), `anahtar kullanıcıyı taşımıyor: ${anahtar}`);
    for (const yetenek of [...YETENEK_KIMLIKLERI, "yetenek"]) {
      assert.ok(!anahtar.includes(yetenek), `anahtarda yetenek ayrımı var: ${anahtar}`);
    }
    // Sınır tek yerde tanımlı olmalı; elle yazılmış bir sayı ayrışır.
    assert.match(erisim, /p_limit:\s*SAATLIK_HAK/);
  });
});
