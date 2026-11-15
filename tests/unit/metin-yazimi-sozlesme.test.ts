import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  P52a2 kaynak sözleşmesi. Yazma dizisi lib/metin-yazimi.ts'te; davranışı
  gerçek Postgres + PostgREST'e karşı scripts/yerel-yigin/kayit-butunlugu.mjs
  sınıyor (CI'da değil, docker ister). Burada sunucu eylemlerinin o diziyi
  GERÇEKTEN kullandığı ve koşulsuz yazmaya dönmediği kaynak metinden okunuyor:
  eskiden zorla kayıt upsert'le, geri yükleme project_id ile koşulsuz
  yazıyordu ve yedekle yazma arasında kaydedilen metin kayboluyordu.
*/
const oku = (dosya: string) =>
  fs
    .readFileSync(path.join(process.cwd(), dosya), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const kayit = oku("app/actions/manuscript.ts");
const surum = oku("app/actions/manuscript-versions.ts");
const yazim = oku("lib/metin-yazimi.ts");

test("project_manuscripts'e yazan tek yer lib/metin-yazimi.ts (eylemler doğrudan yazmıyor)", () => {
  for (const [ad, kaynak] of [["manuscript.ts", kayit], ["manuscript-versions.ts", surum]] as const) {
    assert.doesNotMatch(kaynak, /from\("project_manuscripts"\)\s*\.(upsert|update|insert)\(/, `${ad} metne doğrudan yazıyor`);
  }
  assert.doesNotMatch(yazim, /\.upsert\(/, "koşulsuz upsert geri geldi");
});

test("zorla kayıt: yedek sonucu okunuyor, yedek yoksa yazılmıyor, yazma yedeğin damgasına koşullu", () => {
  assert.match(kayit, /const hazirlik = await zorlaKayitIcinYedekle\(/);
  assert.match(kayit, /if \(hazirlik\.tur === "yedek-alinamadi"\) \{\s*return \{/);
  assert.match(kayit, /beklenen = hazirlik\.beklenen;/);
  assert.match(kayit, /kosulluYaz\(ctx\.supabase, projectId, row, beklenen\)/);
  // Yedek sonucu okunmadan çağrılan snapshot (eski hata) zorla kayıt yolunda yok.
  assert.doesNotMatch(kayit, /if \(input\.force\) \{\s*await snapshotManuscript\(/);
});

test("sürüm geri yükleme: tek dizi (yedek → yedeğin damgasına koşullu yazma), çakışma ayrı bildiriliyor", () => {
  assert.match(surum, /await surumuGeriYukle\(ctx\.supabase, \{/);
  assert.match(surum, /case "cakisma":/);
  assert.match(yazim, /if \(yedek\.durum !== "alindi"\) return \{ tur: "yedek-alinamadi" \};/);
  assert.match(yazim, /yedek\.kaynakUpdatedAt,\s*\);/);
});

test("koşullu yazma: güncelleme her zaman updated_at'e bağlı; damga metin olarak karşılaştırılmıyor", () => {
  assert.match(yazim, /\.eq\("project_id", projectId\)\s*\.eq\("updated_at", beklenen\)/);
  assert.match(yazim, /damgaAyniMi\(simdiki\.updated_at as string, beklenen\)/);
});
