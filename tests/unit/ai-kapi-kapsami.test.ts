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
  kendi kimliğini koda yazmak zorunda. Bir beşinci yetenek de yazacak.

  Okuma yapan dosyalar (ai-gecmis, ai-kayitlar, ai-puan) kimlik yazmıyor ve
  kapıdan geçmiyor — doğru: kayıtlı cevabı göstermek hak yakmamalı.
*/
const YETENEK_KIMLIKLERI = ["analiz", "kaynakca", "literatur", "belge"];
const yetenekKimligi = (kaynak: string) =>
  YETENEK_KIMLIKLERI.find((kimlik) => new RegExp(`yetenek:\\s*"${kimlik}"`).test(kaynak));

test("asistan kapısının kapsamı", async (t) => {
  const dosyalar = YETENEK_DOSYALARI.map((ad) => ({ ad, kaynak: readFileSync(`app/actions/${ad}`, "utf8") }));

  await t.test("yetenek dosyaları bulundu", () => {
    // Dizin adı değişirse test sessizce boşalmasın.
    assert.ok(dosyalar.length >= 4, `ai-*.ts bulunamadı: ${dosyalar.length}`);
  });

  await t.test("her yetenek kapıdan, haktan ve kayıttan geçiyor", () => {
    const yetenekli = dosyalar.filter((d) => yetenekKimligi(d.kaynak));
    // Dördü de bulunmalı: biri kaybolursa denetim sessizce daralır.
    assert.deepEqual(
      yetenekli.map((d) => yetenekKimligi(d.kaynak)).sort(),
      [...YETENEK_KIMLIKLERI].sort(),
      `bulunan yetenekler: ${yetenekli.map((d) => d.ad)}`,
    );

    for (const { ad, kaynak } of yetenekli) {
      assert.match(kaynak, /asistanKapisi\(\)/, `${ad}: abonelik/kurulum kapısı yok`);
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
    for (const yetenek of ["analiz", "kaynakca", "literatur", "belge", "yetenek"]) {
      assert.ok(!anahtar.includes(yetenek), `anahtarda yetenek ayrımı var: ${anahtar}`);
    }
    // Sınır tek yerde tanımlı olmalı; elle yazılmış bir sayı ayrışır.
    assert.match(erisim, /p_limit:\s*SAATLIK_HAK/);
  });
});
