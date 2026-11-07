// G1 — hesap ön-ele geçirmeye karşı kimlik sabitleme (migration 20261106184046).
//
// Değişmez: e-posta sahipliği kanıtlanmadan önce konmuş hiçbir şifre ve
// hiçbir kurum bağı, kanıttan sonra geçerli olamaz. Onay anı GoTrue'da
// auth.users.email_confirmed_at NULL → dolu güncellemesi; burada aynı
// güncelleme elle yapılarak tetikleyiciler sınanıyor. Gerçek GoTrue ile
// uçtan uca sınama Test projesinde (rapor: G1 düzeltme raporu).
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const KURUM = "00000000-0000-4000-8000-0000000000c1";
const KURBAN = "00000000-0000-4000-8000-0000000000e1";
const ONAYLI = "00000000-0000-4000-8000-0000000000e2";
const DAVETLI = "00000000-0000-4000-8000-0000000000e3";
const SALDIRGAN_SIFRESI = "$2a$10$saldirganinbcryptozetiburadaduruyor00000000000000000000";

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function onaysizHesap(id, eposta, ad = "Saldırgan Adı") {
  await rol(db, "postgres");
  await db.query(
    `insert into auth.users (id, email, email_confirmed_at, encrypted_password, raw_user_meta_data)
     values ($1, $2, null, $3, jsonb_build_object('full_name', $4::text))`,
    [id, eposta, SALDIRGAN_SIFRESI, ad],
  );
}

async function kurumVeUye(eposta, ad = null) {
  await rol(db, "postgres");
  await db.query(`insert into public.organizations (id, name) values ($1, 'AkademikMerkez') on conflict do nothing`, [KURUM]);
  await db.query(`insert into public.arvoos_members (email, organization_id, full_name) values ($1, $2, $3)`, [eposta, KURUM, ad]);
}

const onayla = (id) => db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [id]);

describe("G1: onay anında önceki şifre geçersiz", () => {
  test("onaysız hesapta konmuş şifre onayla silinir", () =>
    islem(db, async () => {
      await onaysizHesap(KURBAN, "kurban@ornek.com");
      await onayla(KURBAN);
      const u = await tek(`select encrypted_password, email_confirmed_at from auth.users where id = $1`, [KURBAN]);
      assert.equal(u.encrypted_password, null);
      assert.ok(u.email_confirmed_at);
    }));

  test("onaylı hesabın şifresine dokunulmaz (sıfırlama, e-posta değişimi, yeniden onay)", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.query(
        `insert into auth.users (id, email, email_confirmed_at, encrypted_password) values ($1, 'onayli@ornek.com', now() - interval '1 day', 'mesru-ozet')`,
        [ONAYLI],
      );
      // Onaylı hesapta onay damgası yenilenebilir (e-posta değişimi): şifre kalmalı.
      await db.query(`update auth.users set email_confirmed_at = now(), email = 'yeni@ornek.com' where id = $1`, [ONAYLI]);
      await db.query(`update auth.users set encrypted_password = 'yeni-mesru-ozet' where id = $1`, [ONAYLI]);
      const u = await tek(`select encrypted_password from auth.users where id = $1`, [ONAYLI]);
      assert.equal(u.encrypted_password, "yeni-mesru-ozet");
    }));

  test("onaydan SONRA belirlenen şifre kalır (kayıt ve davet akışı)", () =>
    islem(db, async () => {
      await onaysizHesap(DAVETLI, "davetli@ornek.com");
      await onayla(DAVETLI);
      await db.query(`update auth.users set encrypted_password = 'sahibin-ozeti' where id = $1`, [DAVETLI]);
      const u = await tek(`select encrypted_password from auth.users where id = $1`, [DAVETLI]);
      assert.equal(u.encrypted_password, "sahibin-ozeti");
    }));

  test("ilgisiz güncelleme onaysız hesabın şifresini silmez (tetikleyici yalnızca onay anında)", () =>
    islem(db, async () => {
      await onaysizHesap(KURBAN, "kurban@ornek.com");
      await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"x"}' where id = $1`, [KURBAN]);
      const u = await tek(`select encrypted_password from auth.users where id = $1`, [KURBAN]);
      assert.equal(u.encrypted_password, SALDIRGAN_SIFRESI);
    }));
});

describe("G1: kurum bağı yalnızca onaylı hesaba", () => {
  test("listedeki adresle açılan ONAYSIZ hesap kuruma bağlanmaz", () =>
    islem(db, async () => {
      await kurumVeUye("kurban@akademikmerkez.com");
      await onaysizHesap(KURBAN, "kurban@akademikmerkez.com");
      const p = await tek(`select organization_id from public.profiles where id = $1`, [KURBAN]);
      assert.equal(p.organization_id, null);
    }));

  test("onay anında kuruma bağlanır", () =>
    islem(db, async () => {
      await kurumVeUye("kurban@akademikmerkez.com");
      await onaysizHesap(KURBAN, "kurban@akademikmerkez.com");
      await onayla(KURBAN);
      const p = await tek(`select organization_id from public.profiles where id = $1`, [KURBAN]);
      assert.equal(p.organization_id, KURUM);
    }));

  test("ArvoOS'un onaylı açtığı hesap INSERT anında bağlanmaya devam eder", () =>
    islem(db, async () => {
      await kurumVeUye("uye@akademikmerkez.com");
      await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'uye@akademikmerkez.com', now())`, [ONAYLI]);
      const p = await tek(`select organization_id from public.profiles where id = $1`, [ONAYLI]);
      assert.equal(p.organization_id, KURUM);
    }));

  test("onaysız hesap kendi çağrısıyla da bağlanamaz (arvoos_uyeligini_bagla içeriden denetler)", () =>
    islem(db, async () => {
      await kurumVeUye("kurban@akademikmerkez.com");
      await onaysizHesap(KURBAN, "kurban@akademikmerkez.com");
      await db.query(`select public.arvoos_uyeligini_bagla($1, 'kurban@akademikmerkez.com')`, [KURBAN]);
      const p = await tek(`select organization_id from public.profiles where id = $1`, [KURBAN]);
      assert.equal(p.organization_id, null);
    }));
});

describe("G1: onay anında profil adı", () => {
  test("ArvoOS'un bildiği ad, onaysız dönemde yazılan adın yerine geçer", () =>
    islem(db, async () => {
      await kurumVeUye("kurban@akademikmerkez.com", "Gerçek Kişi");
      await onaysizHesap(KURBAN, "kurban@akademikmerkez.com", "Saldırganın Seçtiği Ad");
      await onayla(KURBAN);
      const p = await tek(`select full_name from public.profiles where id = $1`, [KURBAN]);
      assert.equal(p.full_name, "Gerçek Kişi");
    }));

  test("ArvoOS adı yoksa doğrulanan isteğin adı (son meta veri) yazılır", () =>
    islem(db, async () => {
      await onaysizHesap(KURBAN, "kurban@ornek.com", "Saldırganın Seçtiği Ad");
      // Sahibin kaydı meta veriyi yeniliyor (GoTrue generateLink signup).
      await db.query(`update auth.users set raw_user_meta_data = '{"full_name":"Asıl Sahip"}' where id = $1`, [KURBAN]);
      await onayla(KURBAN);
      const p = await tek(`select full_name from public.profiles where id = $1`, [KURBAN]);
      assert.equal(p.full_name, "Asıl Sahip");
    }));
});

describe("G1: yetki yüzeyi", () => {
  test("yeni fonksiyonlar istemciye kapalı", () =>
    islem(db, async () => {
      for (const ad of ["eposta_onayinda_sifreyi_temizle", "eposta_onayinda_profili_kur", "arvoos_uyeligini_bagla"]) {
        const r = await tek(
          `select bool_or(has_function_privilege('anon', p.oid, 'execute')) as anon,
                  bool_or(has_function_privilege('authenticated', p.oid, 'execute')) as auth
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = $1`,
          [ad],
        );
        assert.equal(r.anon, false, `${ad} anon`);
        assert.equal(r.auth, false, `${ad} authenticated`);
      }
    }));
});

describe("G1: ilk_sifre_gerekli (20261107120542)", () => {
  test("şifresiz ve ArvoOS üyesi değilse evet; üyeyse ya da şifresi varsa hayır; anon çağıramaz", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.query(`insert into public.organizations (id, name) values ($1, 'K') on conflict do nothing`, [KURUM]);
      await db.query(`insert into public.arvoos_members (email, organization_id) values ('uye@x.co', $1)`, [KURUM]);
      await db.query(
        `insert into auth.users (id, email, encrypted_password) values ($1, 'a@x.co', 'ozet'), ($2, 'b@x.co', null), ($3, 'uye@x.co', null)`,
        [ONAYLI, KURBAN, DAVETLI],
      );
      const sor = async (id) => { await rol(db, "authenticated", id); return (await tek(`select public.ilk_sifre_gerekli() as v`)).v; };
      assert.equal(await sor(ONAYLI), false);
      assert.equal(await sor(KURBAN), true);
      assert.equal(await sor(DAVETLI), false);
      await rol(db, "postgres");
      assert.equal((await tek(`select has_function_privilege('anon', 'public.ilk_sifre_gerekli()', 'execute') as v`)).v, false);
      assert.equal((await tek(`select count(*)::int as n from pg_proc where proname = 'sifre_durumum'`)).n, 0);
    }));
});
