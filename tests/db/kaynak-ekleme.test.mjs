// Kaynak ekleme: meşru akışlar, yetkisiz denemeler ve tekrar denetiminin
// kapsam sorgusu (A1, 07.11.2026). Migration YOK: mevcut şemanın davranışı.
//
// Sınanan:
//   - sahip kendi çalışmasına ve genel kütüphanesine (çalışmasız) kaynak ekler;
//   - başkası adına (owner_id başkası) ve anonim ekleme reddedilir (RLS);
//   - aboneliği biten kullanıcının eklemesi veritabanında reddedilir
//     (guard_subscription_trigger; uygulama kapısı ayrıca anlaşılır mesaj verir);
//   - tekrar denetiminin kapsam sorgusu (lib/kaynak-kapsami.ts ile AYNI süzgeç:
//     owner_id + project_id ya da project_id is null) yalnızca kullanıcının
//     KENDİ kaynaklarını döndürür: aynı kurumun Kontrolörü RLS ile öğrencinin
//     kaynaklarını okuyabiliyor, ama kendi tekrar denetimine karışmamalılar (K6);
//   - BİLİNEN ve BİLEREK açık: veritabanı aynı DOI'nin ikinci kez eklenmesini
//     henüz ENGELLEMİYOR. A1 kuralı uygulama katmanında (lib/kaynak-ekleme.ts);
//     veritabanı denetimi mimari dosyadaki M3/M4 ile gelecek. O gün bu senaryo
//     tersine döner ve bu satır güncellenir.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-0000000000a1";
const YABANCI = "00000000-0000-4000-8000-0000000000a2";
const KONTROLOR = "00000000-0000-4000-8000-0000000000a3";
const KURUM = "00000000-0000-4000-8000-0000000000a9";
const PROJE = "00000000-0000-4000-8000-0000000000a5";
const DOI = "https://doi.org/10.1002/jae.616";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum');
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${YABANCI}', 'y@x.co'), ('${KONTROLOR}', 'k@x.co');
    update public.profiles set organization_id = '${KURUM}' where id = '${OGRENCI}';
    update public.profiles set role = 'controller', organization_id = '${KURUM}' where id = '${KONTROLOR}';
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
      values ('${PROJE}', '${OGRENCI}', '${KURUM}', 'Öğrencinin tezi', 'thesis');
  `);
}

/* Sunucu işlemlerinin yazdığı satırın biçimi (owner_id, project_id, title, doi_or_url, status). */
const ekle = (sahip, proje, baslik, doi = null) =>
  db.query(
    `insert into public.literature_sources (owner_id, project_id, title, doi_or_url, status) values ($1, $2, $3, $4, 'to_review') returning id`,
    [sahip, proje, baslik, doi],
  );

/* lib/kaynak-kapsami.ts kapsamdakiKaynaklar ile aynı süzgeç. */
const kapsam = (sahip, proje) =>
  proje
    ? db.query(`select id, title, year, doi_or_url from public.literature_sources where owner_id = $1 and project_id = $2`, [sahip, proje])
    : db.query(`select id, title, year, doi_or_url from public.literature_sources where owner_id = $1 and project_id is null`, [sahip]);

describe("kaynak ekleme", () => {
  test("sahip kendi çalışmasına ve genel kütüphanesine ekler", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      assert.equal((await ekle(OGRENCI, PROJE, "Çalışmadaki kaynak", DOI)).rows.length, 1);
      assert.equal((await ekle(OGRENCI, null, "Genel kütüphanedeki kaynak", DOI)).rows.length, 1);
      // Aynı DOI başka kapsamda (çalışma ↔ genel kütüphane) meşru: K2 + K6.
      assert.equal((await kapsam(OGRENCI, PROJE)).rows.length, 1);
      assert.equal((await kapsam(OGRENCI, null)).rows.length, 1);
    }));

  test("başkası adına ekleme reddedilir (RLS)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      await reddedilir(db, `insert into public.literature_sources (owner_id, project_id, title) values ($1, $2, 'Kaçak')`, [OGRENCI, PROJE], /row-level security/);
      await reddedilir(db, `insert into public.literature_sources (owner_id, title) values ($1, 'Kaçak')`, [OGRENCI], /row-level security/);
    }));

  test("anonim ekleme reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "anon");
      await reddedilir(db, `insert into public.literature_sources (owner_id, title) values ($1, 'Kaçak')`, [OGRENCI], /permission denied|row-level security/);
    }));

  test("aboneliği biten kullanıcının eklemesi veritabanında reddedilir", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await db.query(`insert into public.individual_subscriptions (user_id, status, current_period_end) values ($1, 'canceled', now() - interval '1 day')`, [YABANCI]);
      await rol(db, "authenticated", YABANCI);
      await reddedilir(db, `insert into public.literature_sources (owner_id, title, doi_or_url) values ($1, 'Kapı kapalı', $2)`, [YABANCI, DOI], /Aboneliğiniz sona erdi/);
    }));

  test("tekrar kapsamı yalnızca kullanıcının kendi kaynakları: Kontrolör öğrencinin kaynaklarını okusa da kapsamına girmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await ekle(OGRENCI, PROJE, "Öğrencinin kaynağı", DOI);
      await ekle(OGRENCI, null, "Öğrencinin genel kaynağı", DOI);

      await rol(db, "authenticated", KONTROLOR);
      // RLS: aynı kurumun Kontrolörü öğrencinin kaynaklarını görür (gözetim).
      assert.equal((await db.query(`select id from public.literature_sources where owner_id = $1`, [OGRENCI])).rows.length, 2);
      // Kapsam sorgusu kendi sahipliğiyle süzer: Kontrolörün genel kütüphanesi boş.
      assert.equal((await kapsam(KONTROLOR, null)).rows.length, 0);
      // Kontrolör aynı DOI'yi kendi genel kütüphanesine ekleyebilir (farklı kullanıcı bağımsız, K6).
      assert.equal((await ekle(KONTROLOR, null, "Kontrolörün kaynağı", DOI)).rows.length, 1);
      assert.equal((await kapsam(KONTROLOR, null)).rows.length, 1);

      await rol(db, "authenticated", YABANCI);
      // Başka kurumdan kullanıcı öğrencinin kaynaklarını hiç görmez.
      assert.equal((await db.query(`select id from public.literature_sources where owner_id = $1`, [OGRENCI])).rows.length, 0);
    }));

  test("BİLİNEN: veritabanı aynı DOI'yi henüz engellemiyor (kural uygulamada; M3/M4 ile gelecek)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await ekle(OGRENCI, PROJE, "Birinci", DOI);
      assert.equal((await ekle(OGRENCI, PROJE, "İkinci", "10.1002/JAE.616")).rows.length, 1);
      assert.equal((await kapsam(OGRENCI, PROJE)).rows.length, 2);
    }));
});
