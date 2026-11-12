// Üretim uzlaştırması (migration 20261112065413) ve geri dönüş betiği
// (docs/uretim-duzeltmeleri/uretim-uzlastirma-geri-donus.sql).
//
// Bu dosya uzlaştırmanın MANTIĞINI CI'da sabitler: veritabanı önce
// Production'ın 12.11.2026'daki hâline indirilir (eksik sütunlar, bağlı
// olmayan koruma tetikleyicileri, eski handle_new_user, 'employee'
// varsayılanı), sonra migration İKİ KEZ uygulanır. Gerçek GoTrue ve
// Production'ın dar yetkileriyle prova scripts/uretim-provasi'dadır (CI'da
// değil); PGlite onları göremez.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const KOK = path.resolve(import.meta.dirname, "../..");
const R1 = fs.readFileSync(path.join(KOK, "supabase/migrations/20261112065413_uretim_uzlastirma.sql"), "utf8");
const GERI = fs.readFileSync(path.join(KOK, "docs/uretim-duzeltmeleri/uretim-uzlastirma-geri-donus.sql"), "utf8");

const ESKI_PERSONEL = "00000000-0000-4000-8000-0000000000e1";
const YENI = "00000000-0000-4000-8000-0000000000e2";
const YONETICI = "00000000-0000-4000-8000-0000000000e3";
const UZMAN = "00000000-0000-4000-8000-0000000000e4";

/*
  Production'ın uzlaştırma öncesi hâli (katalogdan, 12.11.2026). handle_new_user
  gövdesi Production'daki eski sürüm: kvkk_onay_at yazmıyor.
*/
const URETIM_HALI = `
  drop trigger if exists guard_support_request_update_trigger on public.app_support_requests;
  drop trigger if exists guard_consultancy_request_update_trigger on public.consultancy_requests;
  drop index if exists public.individual_subscriptions_hatirlatma_idx;
  alter table public.individual_subscriptions drop column if exists deneme_hatirlatildi_at;
  alter table public.profiles drop column if exists kvkk_onay_at;
  alter table public.profiles alter column role set default 'employee';
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name')
    on conflict (id) do nothing;
    begin
      perform public.arvoos_uyeligini_bagla(new.id, new.email);
    exception when others then
      raise warning '[arvoos] üyelik bağlanamadı: %', sqlerrm;
    end;
    return new;
  end;
  $$;
`;

const sutunVar = async (db, tablo, sutun) =>
  (await db.query(`select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = $2`, [tablo, sutun])).rows.length === 1;
const varsayilanRol = async (db) =>
  (await db.query(`select column_default as d from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'`)).rows[0].d;
const tetikleyiciSayisi = async (db) =>
  Number((await db.query(`select count(*)::int as n from pg_trigger where not tgisinternal and tgname in ('guard_support_request_update_trigger', 'guard_consultancy_request_update_trigger')`)).rows[0].n);

describe("üretim uzlaştırması (R1)", () => {
  let db;
  let ikinciKosuHatasi = null;
  before(async () => {
    db = await veritabani();
    await rol(db, "postgres");
    await db.exec(URETIM_HALI);
    // Uzlaştırmadan ÖNCE açılmış hesap: Production'daki gibi 'employee' olarak açılır.
    await db.exec(`insert into auth.users (id, email) values ('${ESKI_PERSONEL}', 'eski@example.com')`);
    await db.exec(R1);
    try {
      await db.exec(R1);
    } catch (hata) {
      ikinciKosuHatasi = hata;
    }
  });

  test("iki kez uygulanabiliyor (idempotent)", () => {
    assert.equal(ikinciKosuHatasi, null);
  });

  test("eksik sütunlar, varsayılan rol ve koruma tetikleyicileri yerinde", async () => {
    assert.equal(await sutunVar(db, "profiles", "kvkk_onay_at"), true);
    assert.equal(await sutunVar(db, "individual_subscriptions", "deneme_hatirlatildi_at"), true);
    assert.match(await varsayilanRol(db), /^'client'::/);
    assert.equal(await tetikleyiciSayisi(db), 2);
  });

  test("mevcut profilin rolüne dokunulmuyor", async () => {
    const { rows } = await db.query(`select role from public.profiles where id = $1`, [ESKI_PERSONEL]);
    assert.equal(rows[0].role, "employee");
  });

  test("yeni kayıt 'client' açılıyor ve KVKK onay damgası profile yazılıyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'yeni@example.com', $2)`,
        [YENI, JSON.stringify({ full_name: "Yeni Kişi", kvkk_onay_at: "2026-11-12T08:00:00.000Z" })]);
      const { rows } = await db.query(`select role, kvkk_onay_at from public.profiles where id = $1`, [YENI]);
      assert.equal(rows[0].role, "client");
      assert.ok(rows[0].kvkk_onay_at, "kvkk_onay_at boş kaldı");
    }));

  test("client kendini personel yapamıyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.exec(`insert into auth.users (id, email) values ('${YENI}', 'yeni@example.com')`);
      await rol(db, "authenticated", YENI);
      await reddedilir(db, `update public.profiles set role = 'employee' where id = $1`, [YENI], /yetkiniz yok/i);
    }));

  test("kullanıcı kendi destek talebinin durumunu değiştiremiyor; yönetici değiştirebiliyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.exec(`
        insert into auth.users (id, email) values ('${YENI}', 'yeni@example.com'), ('${YONETICI}', 'yonetici@example.com');
        update public.profiles set role = 'system_admin' where id = '${YONETICI}';
      `);
      const { rows } = await db.query(`insert into public.app_support_requests (requested_by, subject, message, category)
        values ($1, 'Konu', 'Mesaj', 'bug') returning id`, [YENI]);
      await rol(db, "authenticated", YENI);
      await reddedilir(db, `update public.app_support_requests set status = 'resolved' where id = $1`, [rows[0].id], /yalnızca Sistem Yöneticisi/i);
      await rol(db, "authenticated", YONETICI);
      const sonuc = await db.query(`update public.app_support_requests set status = 'resolved' where id = $1 returning status`, [rows[0].id]);
      assert.equal(sonuc.rows[0].status, "resolved");
    }));

  test("talep sahibi uzman talebine uzman atayamıyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.exec(`insert into auth.users (id, email) values ('${YENI}', 'yeni@example.com'), ('${UZMAN}', 'uzman@example.com')`);
      const { rows } = await db.query(`insert into public.consultancy_requests (requested_by, request_type, message, status)
        values ($1, 'methodology', 'Mesaj', 'open') returning id`, [YENI]);
      await rol(db, "authenticated", YENI);
      await reddedilir(db, `update public.consultancy_requests set assigned_expert_id = $2 where id = $1`, [rows[0].id, UZMAN], /yetkiniz yok/i);
    }));
});

describe("üretim uzlaştırması — geri dönüş betiği", () => {
  test("veri varken KVKK sütununu korur, yeniden koşulabilir, boşken sütunları kaldırır, R1 sonra yeniden uygulanır", async () => {
    const db = await veritabani();
    await rol(db, "postgres");
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'yeni@example.com', $2)`,
      [YENI, JSON.stringify({ kvkk_onay_at: "2026-11-12T08:00:00.000Z" })]);

    await db.exec(GERI);
    assert.match(await varsayilanRol(db), /^'employee'::/);
    assert.equal(await tetikleyiciSayisi(db), 0);
    assert.equal(await sutunVar(db, "profiles", "kvkk_onay_at"), true, "dolu KVKK sütunu kaldırılmamalı");
    assert.equal(await sutunVar(db, "individual_subscriptions", "deneme_hatirlatildi_at"), false);

    /*
      Eskiden ikinci koşu "column deneme_hatirlatildi_at does not exist" ile
      düşüyordu: plpgsql statik sorguyu derliyordu (P1 provası, 12.11.2026).
    */
    await db.exec(GERI);

    await db.query(`update public.profiles set kvkk_onay_at = null where id = $1`, [YENI]);
    await db.exec(GERI);
    assert.equal(await sutunVar(db, "profiles", "kvkk_onay_at"), false);

    await db.exec(R1);
    assert.equal(await sutunVar(db, "profiles", "kvkk_onay_at"), true);
    assert.match(await varsayilanRol(db), /^'client'::/);
    assert.equal(await tetikleyiciSayisi(db), 2);
  });
});
