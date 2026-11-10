import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { onizlemeBayraklari } from "../../lib/onizleme-takmalari";
// @ts-expect-error — düz JS modülü (scripts/onizleme), tip bildirimi yok
import { KATALOG, VARSAYILAN, beyaniCoz, eksikler, sunucuOrtami } from "../../scripts/onizleme/kabul-katalogu.mjs";

/*
  Kabul kataloğu (G1 Aşama 5): ön koşul denetimi ve tek koşturucu aynı
  tabloyu okuyor. Burada sabitlenen üç şey:
    1) her kabul betiği katalogda ve katalogdaki her ad bir betik;
    2) her betik ön koşulunu KENDİ adıyla denetliyor (kopyala-yapıştır
       sonrası başka betiğin adı kalırsa yanlış kip denetlenir);
    3) koşturucunun kip için kurduğu sunucu, o kipin ön koşulunu
       karşılayan beyanı üretiyor — yoksa her koşu BLOCKED olurdu ya da,
       daha kötüsü, yanlış sunucuda PASS verirdi.
*/
type Kip = { gerekli: Record<string, string>; arg: string[]; taze?: boolean; zincir?: string };
const katalog = KATALOG as Record<string, { kipler: Record<string, Kip> }>;
const DIZIN = "scripts/onizleme";
const betikler = readdirSync(DIZIN)
  .filter((f) => /kabul\.mjs$/.test(f))
  .map((f) => f.replace(/\.mjs$/, ""));

test("her kabul betiği katalogda, katalogdaki her ad bir betik", () => {
  assert.deepEqual([...betikler].sort(), Object.keys(katalog).sort());
});

test("her betik ön koşulunu kendi adıyla bir kez denetliyor", () => {
  for (const ad of betikler) {
    const govde = readFileSync(`${DIZIN}/${ad}.mjs`, "utf8");
    const cagrilar = govde.match(/await onkosul\("([a-z-]+)"/g) ?? [];
    assert.deepEqual(cagrilar, [`await onkosul("${ad}"`], ad);
  }
});

test("kiplerin anahtarları geçerli, argümanlarda taban adres var", () => {
  for (const [ad, { kipler }] of Object.entries(katalog)) {
    for (const [kipAdi, kip] of Object.entries(kipler)) {
      for (const anahtar of Object.keys(kip.gerekli)) assert.ok(anahtar in VARSAYILAN, `${ad}/${kipAdi}: bilinmeyen anahtar ${anahtar}`);
      assert.ok(kip.arg.includes("{taban}"), `${ad}/${kipAdi}: {taban} yok`);
    }
  }
});

test("koşturucunun kurduğu sunucu kipin ön koşulunu karşılıyor (ortam → beyan → denetim)", () => {
  for (const [ad, { kipler }] of Object.entries(katalog)) {
    for (const [kipAdi, kip] of Object.entries(kipler)) {
      const beyan = beyaniCoz(onizlemeBayraklari(sunucuOrtami(kip)));
      assert.deepEqual(eksikler(kip, beyan), [], `${ad}/${kipAdi}`);
    }
  }
});

test("yanlış sunucu yakalanır: yazma kipi kapalı, senaryo farklı, oturum açık", () => {
  const kayit = katalog["kayit-kabul"].kipler;
  const yazsiz = beyaniCoz(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1" }));
  assert.deepEqual(eksikler(kayit.varsayilan, yazsiz), [{ anahtar: "yaz", beklenen: "1", bulunan: "0" }]);
  const uyumsuzSunucu = beyaniCoz(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1", ONIZLEME_YAZ: "1", ONIZLEME_SENARYO: "uyumsuz" }));
  assert.equal(eksikler(kayit.varsayilan, uyumsuzSunucu)[0]?.anahtar, "senaryo");
  assert.deepEqual(eksikler(kayit.uyumsuz, uyumsuzSunucu), []);
  const oturumlu = beyaniCoz(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1" }));
  assert.equal(eksikler(katalog["dogrulama-kabul"].kipler.varsayilan, oturumlu)[0]?.anahtar, "oturum");
});

test("yazılmayan yaz/ai serbest; değişmiş örnek veri (boş hesap, rol) serbest değil", () => {
  const odak = katalog["odak-kabul"].kipler.varsayilan;
  assert.deepEqual(eksikler(odak, beyaniCoz(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1", ONIZLEME_YAZ: "1", ONIZLEME_AI: "1" }))), []);
  assert.equal(eksikler(odak, beyaniCoz(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1", ONIZLEME_BOS: "1" })))[0]?.anahtar, "bos");
  assert.equal(eksikler(odak, beyaniCoz(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1", ONIZLEME_ROL: "controller" })))[0]?.anahtar, "rol");
});

test("beyan yoksa (önizleme dışı sunucu) hiçbir kip karşılanmaz", () => {
  for (const { kipler } of Object.values(katalog)) {
    for (const kip of Object.values(kipler)) assert.ok(eksikler(kip, beyaniCoz(null)).length > 0);
  }
});

test("zincir kipleri yakalama dosyasını paylaşıyor", () => {
  const yetki = katalog["ai-yetki-kabul"].kipler;
  for (const kip of Object.values(yetki)) {
    assert.equal(kip.zincir, "ai-yetki");
    assert.ok(kip.arg.includes("{yakalama}"));
  }
  assert.equal(Object.keys(yetki)[0], "yabanci", "yakalayan kip zincirin başında olmalı");
});
