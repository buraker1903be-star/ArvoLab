// Kılavuz bildirimi atıf sistemi değişikliğini söylüyor (migration 20260924100035).
//
// Kılavuz onaylanınca resync çalışıyor ve tetikleyici çalışmanın
// citation_style'ını kılavuzunkiyle eziyor. Doğru davranış ama sonucu ağır:
// APA ile yazıp kaynakçasını denetlemiş öğrencinin çalışması bir gecede
// IEEE'ye geçiyor ve daha önce uyumlu çıkan künyeleri hata vermeye başlıyor.
// Bildirim vardı ama gövdesi yalnızca çalışmanın adıydı.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-00000000f101";
const YONETICI = "00000000-0000-4000-8000-00000000f102";
const UNI = "00000000-0000-4000-8000-00000000f201";
const KILAVUZ = "00000000-0000-4000-8000-00000000f301";
const PROJE = "00000000-0000-4000-8000-00000000f401";

const ONAY = (stil) =>
  `'{"citation_style":"${stil}","required_sections":["Giriş","Yöntem","Bulgular","Sonuç"],"extracted_rules":{"font_size_pt":12},"approved_at":"2026-09-0${stil === "ieee" ? 2 : 1}T00:00:00Z"}'::jsonb`;

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${YONETICI}', 'y@x.co');
    update public.profiles set role = 'founder' where id = '${YONETICI}';
    insert into public.universities (id, name, university_type) values ('${UNI}', 'X Üniversitesi', 'devlet');
    insert into public.academic_projects (id, owner_id, university_id, title, project_type, citation_style)
      values ('${PROJE}', '${OGRENCI}', '${UNI}', 'Tezim', 'thesis', 'apa7');
  `);
}

const bildirimler = async () => {
  await rol(db, "postgres");
  const { rows } = await db.query(
    `select kind, title, body from public.notifications where user_id = $1 order by created_at`, [OGRENCI]);
  return rows;
};

/* Kılavuzu yönetici onaylar: auth.uid() öğrenci DEĞİL, yoksa notify() kendine
   bildirim göndermeyi atlar ve test sessizce boşalırdı. */
async function kilavuzOnayla(stil) {
  await rol(db, "postgres");
  await db.query(
    `insert into public.thesis_guidelines (id, university_id, university_name, citation_style, analysis_status, approved_snapshot)
     values ('${KILAVUZ}', '${UNI}', 'X Üniversitesi', $1, 'approved', ${ONAY("apa7")})`, [stil]);
  await db.query(`update public.thesis_guidelines set approved_snapshot = ${ONAY(stil)} where id = '${KILAVUZ}'`);
  await rol(db, "authenticated", YONETICI);
  await db.query(`select public.resync_project_guidelines($1)`, [KILAVUZ]);
}

describe("kılavuz bildirimi", () => {
  test("stil değişince bildirim hangi sistemden hangisine geçildiğini yazıyor", () =>
    islem(db, async () => {
      await tohum();
      await kilavuzOnayla("ieee");
      const kilavuzBildirimi = (await bildirimler()).find((b) => b.kind === "guideline_update");
      assert.ok(kilavuzBildirimi, "kılavuz bildirimi üretilmeli");
      assert.match(kilavuzBildirimi.body, /APA 7 → IEEE/);
      assert.match(kilavuzBildirimi.body, /kaynakça denetimi/);
    }));

  test("stil değişmiyorsa gövde şişirilmiyor", () =>
    islem(db, async () => {
      await tohum();
      await kilavuzOnayla("apa7");
      const kilavuzBildirimi = (await bildirimler()).find((b) => b.kind === "guideline_update");
      assert.ok(kilavuzBildirimi);
      assert.equal(kilavuzBildirimi.body, "Tezim");
    }));

  /*
    Kılavuz pasife alınınca kurallar öğrencinin ekranından kalkıyor.
    Sessiz kalmak, zorunlu bölümlerin ve sayfa sınırının sebepsiz
    kaybolması demekti.
  */
  test("kılavuz kaldırılınca da söyleniyor", () =>
    islem(db, async () => {
      await tohum();
      await kilavuzOnayla("ieee");
      await rol(db, "postgres");
      await db.query(`update public.thesis_guidelines set is_active = false where id = '${KILAVUZ}'`);
      await rol(db, "authenticated", YONETICI);
      await db.query(`select public.resync_project_guidelines($1)`, [KILAVUZ]);
      const sonuncu = (await bildirimler()).filter((b) => b.kind === "guideline_update").at(-1);
      assert.match(sonuncu.title, /kaldırıldı/);
      assert.match(sonuncu.body, /artık uygulanmıyor/);
    }));

  /* Öğrenci kendi stilini değiştirdiğinde kendine bildirim gitmemeli. */
  test("kendi değişikliği için bildirim üretilmiyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`update public.academic_projects set citation_style = 'mla' where id = $1`, [PROJE]);
      assert.equal((await bildirimler()).length, 0);
    }));
});
