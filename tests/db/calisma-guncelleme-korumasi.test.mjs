// Çalışmanın onay, teslim, atama, kurum ve sahiplik alanları
// (guard_academic_project_update, migration 20260913120000).
//
// 05.11.2026 incelemesi: bu tetikleyici depoda var, CANLI veritabanında
// YOK (migration geçmişi 12 satır, depo 104 dosya). Eksikliği hiçbir test
// söylemedi, çünkü tetikleyiciyi sınayan bir test yoktu. Canlıda sıradan
// bir kullanıcı KENDİ çalışmasına sahte onay yazabiliyor, durumu
// ready/delivered yapabiliyor, kurumunu ve atananını değiştirebiliyor,
// sahipliği devredebiliyordu: UPDATE politikası satırı KİMİN
// değiştireceğini sınırlıyor, HANGİ SÜTUNU değil.
//
// Bu dosya üç şeyi sabitler:
//   1) depoda kural yürürlükte (saldırılar düşer, meşru düzenleme geçer,
//      gözetim rollerinin davranışı değişmez, servis rolü muaf);
//   2) tetikleyici kaldırılınca aynı saldırılar GEÇER — test, kuralın
//      yokluğunu gerçekten görebiliyor (görmeseydi yeşil kalması bir şey
//      söylemezdi);
//   3) üretim düzeltmesi taslağı (docs/uretim-duzeltmeleri/
//      guard-academic-project-update.sql) migration'la aynı gövdeyi kurar
//      ve korumasız bir veritabanında korumayı geri getirir.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KOK = path.resolve(import.meta.dirname, "../..");
const MIGRATION = path.join(KOK, "supabase/migrations/20260913120000_phase1_role_guards.sql");
const TASLAK = path.join(KOK, "docs/uretim-duzeltmeleri/guard-academic-project-update.sql");

const U = (n) => `00000000-0000-4000-8000-0000000000${n}`;
const SAHIP_A = U("a1");
const SAHIP_B = U("a2");
const ATANAN = U("a3");
const KONTROLOR_A = U("a4");
const KONTROLOR_B = U("a5");
const YONETICI_A = U("a6");
const KURUM_A = U("b1");
const KURUM_B = U("b2");
const PROJE_A = U("c1");
const PROJE_B = U("c2");

const RED = /Onay, atama ve teslim alanlarını yalnızca Kontrolör/;
const RLS_RED = /row-level security/;

async function tohum(db) {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM_A}', 'Kurum A'), ('${KURUM_B}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${SAHIP_A}', 'sa@x.co'), ('${SAHIP_B}', 'sb@x.co'), ('${ATANAN}', 'at@x.co'),
      ('${KONTROLOR_A}', 'ka@x.co'), ('${KONTROLOR_B}', 'kb@x.co'), ('${YONETICI_A}', 'ya@x.co');
    update public.profiles set organization_id = '${KURUM_A}' where id in ('${SAHIP_A}', '${ATANAN}');
    update public.profiles set organization_id = '${KURUM_B}' where id = '${SAHIP_B}';
    update public.profiles set role = 'controller', organization_id = '${KURUM_A}' where id = '${KONTROLOR_A}';
    update public.profiles set role = 'controller', organization_id = '${KURUM_B}' where id = '${KONTROLOR_B}';
    update public.profiles set role = 'academic_manager', organization_id = '${KURUM_A}' where id = '${YONETICI_A}';
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type) values
      ('${PROJE_A}', '${SAHIP_A}', '${KURUM_A}', 'A kurumunun tezi', 'thesis'),
      ('${PROJE_B}', '${SAHIP_B}', '${KURUM_B}', 'B kurumunun tezi', 'thesis');
  `);
}

/** Kullanıcı olarak UPDATE çalıştırır, etkilenen satır sayısını döndürür. */
async function guncelle(db, kim, sql, params = []) {
  await rol(db, "authenticated", kim);
  return (await db.query(sql, params)).affectedRows;
}

/** Kuralsız bakış (sahip rolü): satırın gerçekten değişip değişmediği. */
async function satir(db, id = PROJE_A) {
  await rol(db, "postgres");
  return (await db.query(`select * from public.academic_projects where id = $1`, [id])).rows[0];
}

/* Raporda doğrulanan yetkisiz değişiklikler. Her biri sahibin KENDİ
   çalışmasında; başkasının çalışmasına zaten RLS izin vermiyor. */
const SALDIRILAR = [
  ["kendine sahte onay (onaylayan + zaman)", `update public.academic_projects set controller_approved_by = '${SAHIP_A}', controller_approved_at = now() where id = '${PROJE_A}'`],
  ["yalnızca onay zamanını yazma", `update public.academic_projects set controller_approved_at = now() where id = '${PROJE_A}'`],
  ["durumu 'ready' yapma", `update public.academic_projects set status = 'ready' where id = '${PROJE_A}'`],
  ["durumu 'delivered' yapma", `update public.academic_projects set status = 'delivered' where id = '${PROJE_A}'`],
  ["kurumu başka kuruma taşıma", `update public.academic_projects set organization_id = '${KURUM_B}' where id = '${PROJE_A}'`],
  ["kurumu boşaltma (NULL)", `update public.academic_projects set organization_id = null where id = '${PROJE_A}'`],
  ["başkasını atama", `update public.academic_projects set assignee_id = '${SAHIP_B}', assignee_name = 'B' where id = '${PROJE_A}'`],
  ["yalnızca atanan adını yazma", `update public.academic_projects set assignee_name = 'Sahte danışman' where id = '${PROJE_A}'`],
  ["sahipliği devredip kendini atanan bırakma", `update public.academic_projects set owner_id = '${SAHIP_B}', assignee_id = '${SAHIP_A}' where id = '${PROJE_A}'`],
];

let db;
before(async () => {
  db = await veritabani();
});

describe("meşru düzenlemeler (sahip)", () => {
  test("başlık, not, ilerleme, tarih, öncelik, yöntem, atıf stili, kurum bilgisi ve updated_at", () =>
    islem(db, async () => {
      await tohum(db);
      /* updateProject'in yazdığı sütunların tamamı (app/actions/projects.ts). */
      const n = await guncelle(
        db,
        SAHIP_A,
        `update public.academic_projects set title = 'Yeni başlık', notes = 'not', progress = 40, due_date = '2027-01-01',
           priority = 'high', research_method = 'mixed', citation_style = 'vancouver',
           university = 'X Üniversitesi', institute = 'Sosyal Bilimler', department = 'Eğitim', updated_at = now()
         where id = $1`,
        [PROJE_A],
      );
      assert.equal(n, 1);
      const s = await satir(db);
      assert.equal(s.title, "Yeni başlık");
      assert.equal(s.progress, 40);
    }));

  test("teslim dışı durumlar arasında geçiş serbest", () =>
    islem(db, async () => {
      await tohum(db);
      for (const durum of ["planned", "writing", "analysis", "review", "revision", "turnitin", "archived", "new"]) {
        assert.equal(await guncelle(db, SAHIP_A, `update public.academic_projects set status = $2 where id = $1`, [PROJE_A, durum]), 1, durum);
      }
    }));

  test("kontrolörün 'ready' yaptığı çalışmayı sahip 'revision'a geri alabilir (yalnızca ready/delivered'a GEÇİŞ kapalı)", () =>
    islem(db, async () => {
      await tohum(db);
      await guncelle(db, KONTROLOR_A, `update public.academic_projects set status = 'ready' where id = $1`, [PROJE_A]);
      assert.equal(await guncelle(db, SAHIP_A, `update public.academic_projects set status = 'revision' where id = $1`, [PROJE_A]), 1);
      assert.equal((await satir(db)).status, "revision");
    }));

  test("onaylı çalışmada sahip korunan alanlara dokunmadan düzenleme yapabilir", () =>
    islem(db, async () => {
      await tohum(db);
      await guncelle(db, KONTROLOR_A, `update public.academic_projects set controller_approved_by = $2, controller_approved_at = now() where id = $1`, [PROJE_A, KONTROLOR_A]);
      assert.equal(await guncelle(db, SAHIP_A, `update public.academic_projects set notes = 'onaydan sonra not' where id = $1`, [PROJE_A]), 1);
      assert.equal((await satir(db)).controller_approved_by, KONTROLOR_A);
    }));

  test("atanan kişi korunan alanlara dokunmadan düzenleme yapabilir", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "postgres");
      await db.query(`update public.academic_projects set assignee_id = $2 where id = $1`, [PROJE_A, ATANAN]);
      assert.equal(await guncelle(db, ATANAN, `update public.academic_projects set progress = 70 where id = $1`, [PROJE_A]), 1);
    }));
});

describe("yetkisiz değişiklikler reddedilir (sahip, kendi çalışması)", () => {
  for (const [ad, sql] of SALDIRILAR) {
    test(ad, () =>
      islem(db, async () => {
        await tohum(db);
        const once = await satir(db);
        await rol(db, "authenticated", SAHIP_A);
        await reddedilir(db, sql, [], RED);
        assert.deepEqual(await satir(db), once, "reddedilen istek satırı değiştirmemeli");
      }));
  }

  test("sahipliği tek başına devretme (RLS'in WITH CHECK'i de keser, tetikleyici önce çalışır)", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "authenticated", SAHIP_A);
      await reddedilir(db, `update public.academic_projects set owner_id = $2 where id = $1`, [PROJE_A, SAHIP_B], RED);
    }));

  test("atanan kişi sahipliği kendine alamaz, atamayı da kaldıramaz", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "postgres");
      await db.query(`update public.academic_projects set assignee_id = $2 where id = $1`, [PROJE_A, ATANAN]);
      await rol(db, "authenticated", ATANAN);
      await reddedilir(db, `update public.academic_projects set owner_id = $2 where id = $1`, [PROJE_A, ATANAN], RED);
      await reddedilir(db, `update public.academic_projects set assignee_id = null where id = $1`, [PROJE_A], RED);
    }));

  test("başkasının çalışmasına dokunulamaz (RLS: 0 satır, süzgeçsiz istekte de)", () =>
    islem(db, async () => {
      await tohum(db);
      assert.equal(await guncelle(db, SAHIP_A, `update public.academic_projects set title = 'EZİLDİ' where id = $1`, [PROJE_B]), 0);
      /* Süzgeçsiz istek yalnızca kendi satırına değer; kendi satırında
         korunan alan olduğu için tamamı düşer. */
      await rol(db, "authenticated", SAHIP_A);
      await reddedilir(db, `update public.academic_projects set organization_id = '${KURUM_B}'`, [], RED);
      assert.equal((await satir(db, PROJE_B)).title, "B kurumunun tezi");
    }));

  test("kurum taşınamadığı için başka kurumun kontrolörü çalışmayı göremez", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "authenticated", SAHIP_A);
      await reddedilir(db, `update public.academic_projects set organization_id = $2 where id = $1`, [PROJE_A, KURUM_B], RED);
      await rol(db, "authenticated", KONTROLOR_B);
      assert.equal((await db.query(`select id from public.academic_projects where id = $1`, [PROJE_A])).rows.length, 0);
    }));

  /* İki katman: depoda anon'un tabloda UPDATE yetkisi hiç yok (schema.sql
     yalnızca authenticated'a veriyor); yetki bir gün açılsa bile
     politikalar `to authenticated` olduğu için RLS 0 satır bırakır.
     Hangisi keserse kessin anon muafiyete ulaşamamalı. */
  test("anon isteği (auth.uid() boş) muafiyete düşmez", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "anon");
      await db.exec("savepoint anon_deneme");
      try {
        const n = (await db.query(`update public.academic_projects set controller_approved_at = now(), owner_id = $1`, [SAHIP_B])).affectedRows;
        assert.equal(n, 0);
      } catch (hata) {
        assert.match(hata.message, /permission denied/);
        await db.exec("rollback to savepoint anon_deneme");
      }
      assert.equal((await satir(db)).owner_id, SAHIP_A);
    }));
});

describe("gözetim rollerinin mevcut davranışı korunur", () => {
  test("kontrolör kendi kurumundaki çalışmayı onaylar, 'ready' yapar ve onayı geri alır (approveProject / revokeApproval)", () =>
    islem(db, async () => {
      await tohum(db);
      assert.equal(
        await guncelle(db, KONTROLOR_A, `update public.academic_projects set controller_approved_by = $2, controller_approved_at = now(), status = 'ready' where id = $1`, [PROJE_A, KONTROLOR_A]),
        1,
      );
      assert.equal(await guncelle(db, KONTROLOR_A, `update public.academic_projects set controller_approved_by = null, controller_approved_at = null where id = $1`, [PROJE_A]), 1);
      assert.equal(await guncelle(db, KONTROLOR_A, `update public.academic_projects set status = 'delivered' where id = $1`, [PROJE_A]), 1);
    }));

  test("kontrolör kendi kurumunda atama yapabilir", () =>
    islem(db, async () => {
      await tohum(db);
      assert.equal(await guncelle(db, KONTROLOR_A, `update public.academic_projects set assignee_id = $2, assignee_name = 'Atanan' where id = $1`, [PROJE_A, ATANAN]), 1);
    }));

  test("akademik yönetici onaylayabilir", () =>
    islem(db, async () => {
      await tohum(db);
      assert.equal(
        await guncelle(db, YONETICI_A, `update public.academic_projects set controller_approved_by = $2, controller_approved_at = now() where id = $1`, [PROJE_A, YONETICI_A]),
        1,
      );
    }));

  test("başka kurumun kontrolörü dokunamaz (RLS kurum sınırı, 0 satır)", () =>
    islem(db, async () => {
      await tohum(db);
      assert.equal(await guncelle(db, KONTROLOR_B, `update public.academic_projects set controller_approved_by = $2, controller_approved_at = now() where id = $1`, [PROJE_A, KONTROLOR_B]), 0);
      assert.equal((await satir(db)).controller_approved_by, null);
    }));

  test("yönetici çalışmayı kendi kurumunun dışına taşıyamaz (tetikleyici muaf tutar, WITH CHECK keser)", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "authenticated", YONETICI_A);
      await reddedilir(db, `update public.academic_projects set organization_id = $2 where id = $1`, [PROJE_A, KURUM_B], RLS_RED);
    }));
});

/*
  SERVİS ROLÜ MUAFİYETİ (auth.uid() boş → kural atlanır).

  Neden gerekli: oturumsuz çalışan sunucu yolları korunan sütunlara meşru
  olarak yazar. Bugün en somutu hesap silme: profiles satırı silinince
  academic_projects.controller_approved_by ve assignee_id yabancı anahtarı
  ON DELETE SET NULL ile boşalır (20260925110522_hesap_silme). Bu bir
  UPDATE'tir ve tetikleyiciyi çalıştırır; silme cron'u servis rolüyle
  çalıştığı için muafiyet olmasa onaylayan kontrolörün ya da atanan
  kişinin hesabı silinemezdi.

  Güvenlik etkisi: muafiyet role değil auth.uid()'nin boş olmasına
  bağlı. PostgREST'e gelen authenticated istekte JWT'nin sub alanı hep
  dolu; sub'sız istek anon'dur ve academic_projects'te anon için politika
  yok (yukarıdaki anon senaryosu). Yani muafiyete yalnızca servis anahtarı
  (createAdminClient) ya da veritabanı sahibi girer — ikisi de RLS'i
  zaten atlıyor; bu yollar yetkiyi kendisi doğrulamak zorunda
  (AGENTS.md: "RLS asıl güvenlik katmanıdır", admin istemcisi kuralı).
*/
describe("servis rolü muafiyeti", () => {
  test("servis rolü korunan alanları doğrudan yazabilir", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "service_role");
      const n = (await db.query(
        `update public.academic_projects set controller_approved_by = $2, controller_approved_at = now(), status = 'delivered', assignee_id = $3 where id = $1`,
        [PROJE_A, KONTROLOR_A, ATANAN],
      )).affectedRows;
      assert.equal(n, 1);
    }));

  test("onaylayan kontrolörün ve atanan kişinin hesabı silinince bağlar boşalır (ON DELETE SET NULL tetikleyiciden geçer)", () =>
    islem(db, async () => {
      await tohum(db);
      await rol(db, "postgres");
      await db.query(`update public.academic_projects set controller_approved_by = $2, controller_approved_at = now(), assignee_id = $3 where id = $1`, [PROJE_A, KONTROLOR_A, ATANAN]);
      await rol(db, "service_role");
      await db.query(`delete from public.profiles where id in ($1, $2)`, [KONTROLOR_A, ATANAN]);
      const s = await satir(db);
      assert.equal(s.controller_approved_by, null);
      assert.equal(s.assignee_id, null);
    }));
});

describe("tetikleyici yokken (canlıdaki durum) saldırılar geçer — test kuralın yokluğunu görebiliyor", () => {
  for (const [ad, sql] of SALDIRILAR) {
    test(ad, () =>
      islem(db, async () => {
        await tohum(db);
        await db.exec(`drop trigger guard_academic_project_update_trigger on public.academic_projects`);
        assert.equal(await guncelle(db, SAHIP_A, sql), 1);
      }));
  }
});

/** "create or replace function public.guard_academic_project_update() ... $$ <gövde> $$" → boşlukları sadeleşmiş gövde. */
function govde(sql) {
  const m = sql.match(/function public\.guard_academic_project_update\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$/);
  assert.ok(m, "fonksiyon gövdesi bulunamadı");
  return m[1].replace(/\s+/g, " ").trim();
}

describe("üretim düzeltmesi taslağı", () => {
  const taslak = fs.readFileSync(TASLAK, "utf8");

  test("fonksiyon gövdesi migration 20260913120000 ile birebir aynı", () => {
    assert.equal(govde(taslak), govde(fs.readFileSync(MIGRATION, "utf8")));
  });

  test("taslak migration geçmişine dokunmaz ve kendi işlemini açıp kapatır", () => {
    const komutlar = taslak.replace(/--.*$/gm, "");
    assert.doesNotMatch(komutlar, /schema_migrations|supabase_migrations/i);
    assert.doesNotMatch(komutlar, /\b(delete|truncate|alter\s+table|drop\s+table|drop\s+policy|create\s+policy)\b/i);
    assert.match(komutlar, /^\s*begin;/m);
    assert.match(komutlar, /^\s*commit;/m);
  });

  test("korumasız veritabanına (canlının durumu) uygulanınca korumayı geri getirir; iki kez uygulanabilir", async () => {
    /* Ayrı veritabanı: taslak kendi begin/commit'ini içeriyor, islem()'in
       dış işlemine gömülemez. */
    const ayri = await veritabani();
    await ayri.exec(`
      drop trigger guard_academic_project_update_trigger on public.academic_projects;
      drop function public.guard_academic_project_update();
    `);
    await ayri.exec(taslak);
    await ayri.exec(taslak);

    const tetikler = (await ayri.query(
      `select tgname, tgenabled from pg_trigger where tgrelid = 'public.academic_projects'::regclass and not tgisinternal order by 1`,
    )).rows;
    assert.deepEqual(tetikler.map((t) => t.tgname), [
      "guard_academic_project_insert_trigger",
      "guard_academic_project_update_trigger",
      "guard_subscription_trigger",
      "notify_project_changes_trigger",
      "sync_academic_project_guideline_trigger",
    ]);
    assert.ok(tetikler.every((t) => t.tgenabled === "O"));

    const yetki = (await ayri.query(
      `select has_function_privilege('anon', 'public.guard_academic_project_update()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.guard_academic_project_update()', 'execute') as auth`,
    )).rows[0];
    assert.deepEqual(yetki, { anon: false, auth: false });

    await islem(ayri, async () => {
      await tohum(ayri);
      for (const [ad, sql] of SALDIRILAR) {
        await rol(ayri, "authenticated", SAHIP_A);
        await reddedilir(ayri, sql, [], RED).catch((h) => assert.fail(`${ad}: ${h.message}`));
      }
      assert.equal(await guncelle(ayri, SAHIP_A, `update public.academic_projects set title = 'Meşru başlık', status = 'writing' where id = $1`, [PROJE_A]), 1);
      assert.equal(
        await guncelle(ayri, KONTROLOR_A, `update public.academic_projects set controller_approved_by = $2, controller_approved_at = now(), status = 'ready' where id = $1`, [PROJE_A, KONTROLOR_A]),
        1,
      );
    });
    await ayri.close();
  });
});
