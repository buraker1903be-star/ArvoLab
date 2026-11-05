#!/usr/bin/env node
/*
  TEST SUPABASE PROJESİ — ŞEMA KURULUMU (Güvenli Test Ortamı, Aşama 1).
  BU BETİK HENÜZ ÇALIŞTIRILMADI; çalıştırma kararı ve ortamı sizde.

  Ne yapar (sırayla, ilk hatada durur):
    1. Hedef denetimi: SUPABASE_DB_URL TEST projesini göstermeli
       (scripts/supabase-hedef.mjs, --tur sema-kurulumu). Üretimde hiçbir
       koşulda çalışmaz; bilinmeyen projede de çalışmaz.
    2. Geri kalanı scripts/test-ortami/kurulum.mjs → kur():
       boş veritabanı denetimi (academic_projects varsa durur), schema.sql,
       `project-files` kovası (20260924100000 ondan ÖNCE var olmalı),
       migration geçmişi tablosu, migration'lar ad sırasıyla — HER BİRİ
       geçmiş kaydıyla AYNI işlemde (sonraki `db:push:test` hiçbirini
       yeniden uygulamaya kalkmaz), ortam işareti
       (public.arvolab_test_ortami(), yalnızca servis rolüne açık),
       isteğe bağlı tohumlar (--tohumlar), son olarak geçmiş tutarlılık
       denetimi ve özet.
    Aynı çekirdek tests/db/test-ortami-kurulum.test.mjs'de izole bir
    veritabanında sınanır.

  Gerekenler: psql (PostgreSQL istemcisi), Node 22+.
  Ortam: SUPABASE_DB_URL (TEST projesinin bağlantı adresi; parola içerir —
  yalnızca kendi terminalinizde, dosyaya yazmayın), ARVOLAB_TEST_SUPABASE_REF,
  ARVOLAB_URETIM_SUPABASE_REF.

  Kullanım:  node scripts/test-ortami/kur.mjs [--tohumlar]
*/
import { spawnSync } from "node:child_process";
import path from "node:path";
import { SABIT_URETIM_SUPABASE_REF, uretimProjesiniGosteriyor } from "../../lib/supabase/ortam-guvenligi.ts";
import { hedefDenetimi } from "../supabase-hedef.mjs";
import { kur, OZET_SQL } from "./kurulum.mjs";

const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../supabase");

function durdur(mesaj) {
  console.error(`✗ ${mesaj}`);
  process.exit(1);
}

/*
  Denetimler, veritabanına dokunan her şeyden ÖNCE. İlki ortam
  değişkenlerine hiç bakmaz: bağlantı adresi kodda sabit üretim kimliğini
  içeriyorsa kurulum durur. Eskiden tek denetim değişkenlere dayanıyordu ve
  test/üretim kimlikleri yer değiştirince üretim "test" sayılıyordu; o gün
  zararı yalnızca kur()'un dolu veritabanı denetimi önlüyordu.
*/
if (uretimProjesiniGosteriyor(process.env.SUPABASE_DB_URL)) {
  durdur(`Kurulum durduruldu: SUPABASE_DB_URL üretim projesini (${SABIT_URETIM_SUPABASE_REF}) gösteriyor. Şema kurulumu üretimde hiçbir koşulda çalışmaz.`);
}
const denetim = hedefDenetimi(["--tur", "sema-kurulumu"], process.env);
if (denetim.tur !== "izin") durdur(`Kurulum durduruldu: ${denetim.mesaj}`);
console.log(`✓ Hedef test projesi: ${denetim.ref}`);

const psql = (argumanlar) => {
  const s = spawnSync("psql", [process.env.SUPABASE_DB_URL, "-v", "ON_ERROR_STOP=1", "-X", "-q", ...argumanlar], { encoding: "utf8" });
  if (s.error) durdur(`psql çalıştırılamadı: ${s.error.message}`);
  if (s.status !== 0) durdur(`psql hata verdi:\n${s.stderr.slice(0, 4000)}`);
  return s.stdout.trim();
};

/* psql, -1 ile birden çok -f/-c verildiğinde HEPSİNİ tek işlemde çalıştırır: migration ve geçmiş kaydı birlikte. */
const vt = {
  sorgu: async (sql) => psql(["-t", "-A", "-c", sql]).split("\n").filter(Boolean),
  dosya: async (yol, ekSql) => void psql(["-1", "-f", yol, ...(ekSql ? ["-c", ekSql] : [])]),
  sql: async (metin, tekIslem = false) => void psql([...(tekIslem ? ["-1"] : []), "-c", metin]),
};

try {
  const sonuc = await kur(vt, { kok: KOK, tohumlar: process.argv.includes("--tohumlar") });
  const ozet = psql(["-t", "-A", "-F", " | ", "-c", OZET_SQL]);
  console.log(`✓ Kurulum tamam. ${sonuc.migrationSayisi} migration uygulandı ve geçmişe yazıldı.`);
  console.log(`  tablo | politika | fonksiyon | kova | geçmiş = ${ozet}`);
  console.log("  Sıradaki adım: node scripts/test-ortami/sentetik-veri.mjs (docs/test-ortami.md).");
} catch (hata) {
  durdur(hata instanceof Error ? hata.message : String(hata));
}
