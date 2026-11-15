import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  EDİTÖR BİLEŞENİNİN KAYIT SÖZLEŞMESİ (P52a1). Bileşen React'e bağlı
  (tests/unit kuralı): kararlar lib/otomatik-kayit.ts'te sınanıyor, burada
  bileşenin o kararları GERÇEKTEN kullandığı kaynak metinden okunuyor.
  Davranış gerçek tarayıcıda: scripts/onizleme/hayalet-kayit-kabul.mjs ve
  scripts/onizleme/otomatik-kayit-kabul.mjs.
*/
const kaynak = fs
  .readFileSync(path.join(process.cwd(), "app/dashboard/editor/[id]/write/manuscript-editor.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

const blok = (bas: string, son: string) => {
  const i = kaynak.indexOf(bas);
  assert.ok(i >= 0, `bulunamadı: ${bas}`);
  return kaynak.slice(i, kaynak.indexOf(son, i + bas.length));
};
const saveNow = blok("const saveNow = useCallback(", "const markDirty = useCallback(");

test("sabit 10 sn'lik yeniden deneme kalmadı; bağlantı hatası geri çekilmeyle", () => {
  assert.doesNotMatch(kaynak, /RETRY_DELAY_MS|scheduleSave\(10000\)/);
  assert.match(saveNow, /if \(sonra\.sonraki === "geri-cekilme"\) scheduleSave\(tekrarGecikmesi\(sonra\.ardisikBaglantiHatasi\)\)/);
  assert.match(kaynak, /scheduleSave\(sonrakiKayitGecikmesi\(payloadBytesRef\.current, ardisikHataRef\.current\)\)/);
});

test("aynı anda tek kayıt: saveNow tek uçuşlu kuyruktan geçiyor, karar sıra gelince veriliyor", () => {
  assert.match(saveNow, /return kayitKuyruguRef\.current\.calistir\(async \(\) => \{/);
  assert.match(saveNow, /const karar = kayitKarari\(\{/);
  assert.match(saveNow, /if \(karar === "gerek-yok"\) return true;/);
  assert.doesNotMatch(kaynak, /inFlightRef/);
  // Kuyruktan önce istek atan bir yol yok.
  assert.ok(saveNow.indexOf("calistir(") < saveNow.indexOf("saveManuscript("));
});

test("sonuç kararla işleniyor; kilidi yalnızca başarı açar, kalıcı hata kurar", () => {
  assert.match(saveNow, /kayitSonucuKarari\(sonuc, \{/);
  assert.match(saveNow, /if \(sonuc\.tur === "cevap" && sonuc\.cevap\.success\) blockedRef\.current = false;\s*else if \(sonra\.engelle\) blockedRef\.current = true;/);
  // Çakışmada zorla kayıt yok: force yalnızca çağırandan gelir.
  assert.match(saveNow, /force,\s*progress,/);
  assert.doesNotMatch(saveNow, /force: true/);
});

test("başarısız kayıtta taslak yazılıyor (içerik kaybolmaz)", () => {
  const hataYolu = saveNow.slice(saveNow.indexOf("return true;\n        }\n\n        persistDraft();"));
  assert.ok(hataYolu.length > 0, "başarısızlık yolunda persistDraft yok");
});

test("taslak sekmenin kendi anahtarına yazılıyor; başarı yalnızca kendi taslağını siliyor", () => {
  assert.match(kaynak, /writeDraft\(sekmeAnahtari\(\), \{/);
  assert.match(saveNow, /kendiTaslaginiSil\(projectId, kullaniciId, sekmeAnahtari\(\)\)/);
  assert.doesNotMatch(saveNow, /butunTaslaklariSil/);
  // Bütün taslakları silen tek yol sürüm geri yükleme (sunucudaki metin baştan değişti).
  const butun = [...kaynak.matchAll(/butunTaslaklariSil\(projectId, kullaniciId\)/g)].length;
  assert.equal(butun, 1);
  assert.match(blok("const handleRestored = () => {", "};"), /butunTaslaklariSil\(projectId, kullaniciId\)/);
});

test("'Vazgeç' yalnızca önerilen taslağı siliyor; 'Geri yükle' onu kayıttan sonra siliyor", () => {
  const vazgec = blok("const discardDraft = useCallback(", "}, []);");
  assert.match(vazgec, /anahtarlariSil\(\[teklifAnahtariRef\.current\]\)/);
  assert.match(blok("const restoreDraft = useCallback(", "const discardDraft"), /geriYuklenenTaslakRef\.current = teklifAnahtariRef\.current;/);
  assert.match(saveNow, /anahtarlariSil\(\[geriYuklenenTaslakRef\.current\]\)/);
});

test("taslak teklifi yanıtlanmadan başarılı kayıt da taslağı silmiyor (eski kural korunuyor)", () => {
  assert.match(saveNow, /\} else if \(!draftOfferRef\.current\) \{\s*kendiTaslaginiSil/);
});

test("açılışta en yeni taslak önerilip anahtarı tutuluyor; aynı içerikli taslak siliniyor", () => {
  assert.match(kaynak, /const bulunan = readDraft\(projectId, kullaniciId\);/);
  assert.match(kaynak, /teklifAnahtariRef\.current = bulunan\.anahtar;/);
  assert.match(kaynak, /anahtarlariSil\(\[bulunan\.anahtar\]\)/);
});
