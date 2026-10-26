// Ana sayfa grafiğinin sayımı (migration 20261026073148): yalnızca
// çağıranın KENDİ hareketi, gün ve tür başına, Türkiye saatiyle.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";

const OGRENCI = "00000000-0000-4000-8000-000000000201";
const KONTROLOR = "00000000-0000-4000-8000-000000000202";
const KURUM = "00000000-0000-4000-8000-0000000002a1";
const PROJE = "00000000-0000-4000-8000-0000000002b1";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum');
    insert into auth.users (id, email) values ('${OGRENCI}', 'o@x.co'), ('${KONTROLOR}', 'k@x.co');
    update public.profiles set organization_id = '${KURUM}' where id in ('${OGRENCI}', '${KONTROLOR}');
    update public.profiles set role = 'controller' where id = '${KONTROLOR}';
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
      values ('${PROJE}', '${OGRENCI}', '${KURUM}', 'Tez', 'thesis');
    insert into public.literature_sources (owner_id, title, created_at) values
      ('${OGRENCI}', 'Bugün eklenen', now()),
      ('${OGRENCI}', 'Bugün eklenen 2', now()),
      ('${OGRENCI}', 'Pencere dışı', now() - interval '90 days');
    insert into public.ai_assistant_runs (user_id, capability, status) values
      ('${OGRENCI}', 'analiz', 'completed'), ('${OGRENCI}', 'analiz', 'failed');
    -- Dün gece 01:30 Türkiye saati = önceki gün 22:30 UTC: Türkiye'deki DÜNE düşmeli.
    insert into public.literature_sources (owner_id, title, created_at) values ('${OGRENCI}', 'Gece',
      ((now() at time zone 'Europe/Istanbul')::date - 1 + time '01:30') at time zone 'Europe/Istanbul');
  `);
}

test("yalnızca kendi hareketi, tamamlanan asistan çalışması ve pencere içi", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await db.query(`select tur, sum(adet)::int as adet from public.calisma_hareketlerim(14) group by tur order by tur`);
    const sayilar = Object.fromEntries(rows.map((r) => [r.tur, r.adet]));
    assert.equal(sayilar.asistan, 1);
    assert.ok(sayilar.kaynak >= 2);

    // Kontrolör öğrencinin kayıtlarını RLS ile görebiliyor ama grafiği kendi hareketi.
    await rol(db, "authenticated", KONTROLOR);
    const kontrolor = await db.query(`select * from public.calisma_hareketlerim(14)`);
    assert.equal(kontrolor.rows.length, 0);
  }));

test("gün sınırı Türkiye saatiyle", () =>
  islem(db, async () => {
    await tohum();
    await rol(db, "authenticated", OGRENCI);
    const { rows } = await db.query(`
      select gun = (now() at time zone 'Europe/Istanbul')::date - 1 as dun,
             gun = (now() at time zone 'Europe/Istanbul')::date - 2 as onceki
        from public.calisma_hareketlerim(14) where tur = 'kaynak'`);
    assert.ok(rows.some((r) => r.dun), "gece kaydı Türkiye'deki düne düşmeli");
    assert.ok(!rows.some((r) => r.onceki), "UTC gününe (iki gün önce) düşmemeli");
  }));
