// METNİN İYİMSER EŞZAMANLILIK KORUMASI (G1 Aşama 5, 10.11.2026).
//
// saveManuscript (app/actions/manuscript.ts) metni yalnızca veritabanındaki
// sürüm damgası editörün açtığı sürümle AYNIYSA günceller:
//   update project_manuscripts set …, updated_at = <yeni damga>
//    where project_id = ? and updated_at = <beklenen> returning updated_at
// Satır dönmezse "conflict" der ve otomatik kayıt durur. 10.11.2026'ya kadar
// bu kural yalnızca önizlemenin sahte istemcisiyle sınanıyordu; sahte istemci
// yazma kipi kapalıyken yazmayı uygulamadığı için kabul testi bir gün
// boyunca "koruma bozuk" dedi (G1 Aşama 4 raporu). Burada kural gerçek
// Postgres'te (PGlite), RLS açıkken ve authenticated rolüyle sınanıyor.
//
// Sorgu, uygulamanın PostgREST üzerinden ürettiği biçimin aynısı: yeni damga
// uygulamanın yazdığı ISO metni (new Date().toISOString(), "…Z"), beklenen
// damga PostgREST'in JSON'da DÖNDÜRDÜĞÜ metin ("…+00:00") — editör bir
// sonraki kayıtta tam olarak onu geri gönderiyor.
//
// KANITLAMADIKLARI: PGlite tek bağlantılıdır; iki yazmanın GERÇEKTEN aynı
// anda gelip satır kilidinde beklediği durum (READ COMMITTED'da kilit
// açılınca WHERE'in yeniden değerlendirilmesi) burada sınanamaz. "Yarış"
// senaryosu iki yazarın aynı sürümü okuyup sırayla yazmasıdır. PostgREST'in
// süzgeç metnini nasıl tırnakladığı ve Supabase'in gerçek sürümü de burada
// yok; o ölçüm gerçek Test ortamında yapılmalı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { islem, rol, veritabani } from "./ortam.mjs";

const SAHIP = "00000000-0000-4000-8000-0000000000d1";
const PROJE = "00000000-0000-4000-8000-0000000000d2";
const ILK = `'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"İlk metin"}]}]}'::jsonb`;
const T0 = "2026-11-10T09:00:00.000Z";

let db;
before(async () => {
  db = await veritabani();
});

const doc = (metin) => JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: metin }] }] });

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${SAHIP}', 'sahip@ornek.com');
    insert into public.academic_projects (id, owner_id, title, project_type)
      values ('${PROJE}', '${SAHIP}', 'Eşzamanlılık tezi', 'thesis');
    insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_at)
      values ('${PROJE}', ${ILK}, 'İlk metin', 2, '${T0}');
  `);
}

/** Editörün gördüğü damga: PostgREST'in JSON çıktısıyla aynı metin. */
async function surum() {
  await rol(db, "authenticated", SAHIP);
  const r = await db.query(`select to_json(updated_at) #>> '{}' as damga from public.project_manuscripts where project_id = $1`, [PROJE]);
  return r.rows[0]?.damga;
}

/** saveManuscript'in koşullu güncellemesi; dönen satır sayısı ve yeni damga. */
async function kaydet(metin, beklenen, yeniDamga) {
  await rol(db, "authenticated", SAHIP);
  const r = await db.query(
    `update public.project_manuscripts
        set content = $3::jsonb, plain_text = $4, word_count = 2, updated_by = $5, updated_at = $6
      where project_id = $1 and updated_at = $2
      returning to_json(updated_at) #>> '{}' as damga`,
    [PROJE, beklenen, doc(metin), metin, SAHIP, yeniDamga],
  );
  return { satir: r.rows.length, damga: r.rows[0]?.damga };
}

async function durum() {
  await rol(db, "postgres");
  const r = await db.query(`select plain_text, content, to_json(updated_at) #>> '{}' as damga from public.project_manuscripts where project_id = $1`, [PROJE]);
  return r.rows[0];
}

describe("metin kaydında iyimser eşzamanlılık", () => {
  test("1) geçerli sürümle koşullu güncelleme başarılı; yeni damga döner", () =>
    islem(db, async () => {
      await tohum();
      const v0 = await surum();
      const sonuc = await kaydet("A sekmesi", v0, "2026-11-10T09:01:00.123Z");
      assert.equal(sonuc.satir, 1);
      assert.notEqual(sonuc.damga, v0);
      const d = await durum();
      assert.equal(d.plain_text, "A sekmesi");
      assert.equal(d.damga, sonuc.damga);
    }));

  test("2) eski sürümle güncelleme sıfır satır değiştirir", () =>
    islem(db, async () => {
      await tohum();
      const v0 = await surum();
      assert.equal((await kaydet("A sekmesi", v0, "2026-11-10T09:01:00.000Z")).satir, 1);
      const eski = await kaydet("B sekmesi (eski sürüm)", v0, "2026-11-10T09:02:00.000Z");
      assert.equal(eski.satir, 0);
      assert.equal(eski.damga, undefined);
    }));

  test("3) çakışmada kaydedilmiş içerik korunur (sessiz üzerine yazma yok)", () =>
    islem(db, async () => {
      await tohum();
      const v0 = await surum();
      await kaydet("A sekmesinin metni", v0, "2026-11-10T09:01:00.000Z");
      const onceki = await durum();
      await kaydet("B sekmesinin metni", v0, "2026-11-10T09:02:00.000Z");
      const sonraki = await durum();
      assert.equal(sonraki.plain_text, "A sekmesinin metni");
      assert.deepEqual(sonraki.content, onceki.content);
    }));

  test("4) başarısız güncelleme sürüm damgasını değiştirmez", () =>
    islem(db, async () => {
      await tohum();
      const v0 = await surum();
      const a = await kaydet("A", v0, "2026-11-10T09:01:00.000Z");
      const onceki = await durum();
      const b = await kaydet("B", v0, "2026-11-10T09:59:59.999Z");
      assert.equal(b.satir, 0);
      const sonraki = await durum();
      assert.equal(sonraki.damga, onceki.damga);
      assert.equal(sonraki.damga, a.damga);
      // Saklanan damga başarılı yazmanınki; başarısız yazmanın damgası hiçbir yerde yok.
      assert.notEqual(sonraki.damga, b.damga);
    }));

  test("5) aynı sürümü okuyan iki yazardan yalnızca biri başarılı; ikincisi güncel sürümle yeniden deneyince geçer", () =>
    islem(db, async () => {
      await tohum();
      // İki sekme aynı anda açıldı: ikisi de v0'ı gördü.
      const vA = await surum();
      const vB = await surum();
      assert.equal(vA, vB);
      const a = await kaydet("A", vA, "2026-11-10T09:01:00.000Z");
      const b = await kaydet("B", vB, "2026-11-10T09:01:00.001Z");
      assert.deepEqual([a.satir, b.satir], [1, 0]);
      assert.equal((await durum()).plain_text, "A");
      // "Diğer sürümü aç": B güncel sürümü okuyup yazarsa geçer — koruma kalıcı bir kilit değil.
      const guncel = await surum();
      assert.equal((await kaydet("B (güncel sürüm üzerinde)", guncel, "2026-11-10T09:03:00.000Z")).satir, 1);
      assert.equal((await durum()).plain_text, "B (güncel sürüm üzerinde)");
    }));

  test("damga biçimi: uygulamanın '…Z' yazdığı değer PostgREST'in '…+00:00' metniyle eşleşir; 1 µs fark eşleşmez", () =>
    islem(db, async () => {
      await tohum();
      const v0 = await surum();
      assert.equal(v0, "2026-11-10T09:00:00+00:00");
      // Aynı an, farklı yazım: eşleşir.
      assert.equal((await kaydet("A", "2026-11-10T09:00:00.000Z", "2026-11-10T09:01:00.500Z")).satir, 1);
      const v1 = await surum();
      assert.equal(v1, "2026-11-10T09:01:00.5+00:00");
      // Bir mikrosaniye sonrası aynı sürüm sayılmaz.
      assert.equal((await kaydet("B", "2026-11-10T09:01:00.500001+00:00", "2026-11-10T09:02:00.000Z")).satir, 0);
      assert.equal((await kaydet("C", v1, "2026-11-10T09:02:00.000Z")).satir, 1);
    }));
});

/*
  Sözleşme: yukarıdaki sorgu uygulamanın sorgusunun KOPYASI. Uygulama koşulu
  bir gün düşürürse (örn. .eq("updated_at", …) silinirse) PGlite testleri
  yeşil kalır ama hiçbir şey ölçmez. Bu yüzden saveManuscript'in koşullu
  güncellemesinin biçimi de sabitleniyor.
*/
describe("uygulama aynı koşulu kullanıyor", () => {
  test("saveManuscript: update → project_id → updated_at = expectedUpdatedAt → updated_at döner", () => {
    const kaynak = readFileSync("app/actions/manuscript.ts", "utf8");
    const zincir = /\.update\(row\)\s*\.eq\("project_id", projectId\)\s*\.eq\("updated_at", input\.expectedUpdatedAt\)\s*\.select\("updated_at"\)/;
    assert.match(kaynak, zincir, "koşullu güncelleme zinciri değişmiş: bu testteki sorguyu da güncelleyin");
    // Yeni damga her kayıtta uygulama tarafından yazılıyor; yazılmasa sürüm ilerlemez ve koruma işlemez.
    assert.match(kaynak, /updated_at: new Date\(\)\.toISOString\(\)/);
    // Satır dönmezse çakışma/yetki ayrımına gidiliyor (sessiz başarı yok).
    assert.match(kaynak, /if \(!data\?\.length\) return cakismaMi\(input\.expectedUpdatedAt\);/);
  });
});

