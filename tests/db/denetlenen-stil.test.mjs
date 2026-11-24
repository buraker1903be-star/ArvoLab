// Chicago'nun ikinci türü ve "denetlenen stil" (migration 20261123190819).
//
// İki şeyi sabitler:
//   1) Katalogdaki HER stil veritabanına yazılabiliyor. Katalog ile kısıt
//      ayrışırsa seçicide görünen stil kaydedilemez ve kullanıcı anlaşılmaz
//      bir hata alır (chicago-notlar eklenirken tam bu risk vardı).
//   2) citation_checks denetimin stilini KENDİ satırında tutuyor. Eskiden
//      tutmuyordu ve kayıtlı sonuç çalışmanın O ANKİ stiliyle etiketleniyordu:
//      stilini sonradan değiştiren kullanıcı, hiç verilmemiş bir hükmü
//      kendi denetiminde okuyordu.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

/* Katalogla aynı liste; lib/atif/stiller.ts'teki STILLER'in anahtarları. */
const KATALOG = ["apa7", "harvard", "chicago", "chicago-notlar", "ieee", "vancouver", "mla", "dipnot"];

const OGRENCI = "00000000-0000-4000-8000-0000000000d1";
const UNI = "00000000-0000-4000-8000-0000000000d2";
const PROJE = "00000000-0000-4000-8000-0000000000d3";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${OGRENCI}', 'd@x.co');
    insert into public.universities (id, name, university_type) values ('${UNI}', 'D University', 'devlet');
    insert into public.academic_projects (id, owner_id, university_id, title, project_type, citation_style)
      values ('${PROJE}', '${OGRENCI}', '${UNI}', 'Tezim', 'thesis', 'apa7');
  `);
}

describe("katalogdaki her stil kaydedilebiliyor", () => {
  test("çalışma ve kılavuz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      for (const stil of KATALOG) {
        await db.query(`update public.academic_projects set citation_style = $2 where id = $1`, [PROJE, stil]);
      }
      await rol(db, "postgres");
      for (const stil of KATALOG) {
        await db.query(
          `insert into public.thesis_guidelines (university_id, university_name, citation_style) values ($1, 'D', $2)`,
          [UNI, stil],
        );
      }
    }));

  test("katalogda olmayan değer yine reddediliyor", () =>
    islem(db, async () => {
      await tohum();
      for (const deger of ["chicago-notes", "chicago notlar", "oxford", "CHICAGO-NOTLAR"]) {
        await reddedilir(db, `update public.academic_projects set citation_style = $2 where id = $1`, [PROJE, deger], /check constraint/);
      }
    }));

  test("bildirim etiketi iki Chicago türünü ayırıyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      const { rows } = await db.query(
        `select public.citation_style_label('chicago') as yt, public.citation_style_label('chicago-notlar') as nk`,
      );
      assert.equal(rows[0].yt, "Chicago (Yazar–Tarih)");
      assert.equal(rows[0].nk, "Chicago (Notlar–Kaynakça)");
    }));
});

describe("denetlenen stil kaydın kendisinde", () => {
  test("öğrenci denetimini stiliyle kaydedebiliyor ve geri okuyabiliyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(
        `insert into public.citation_checks (project_id, raw_reference_list, citation_style, created_by)
         values ($1, '1. Yılmaz A. Başlık. Dergi. 2020;1(1):1-5.', 'vancouver', $2)`,
        [PROJE, OGRENCI],
      );
      /* Çalışmanın stili SONRADAN değişiyor: denetimin stili değişmemeli. */
      await db.query(`update public.academic_projects set citation_style = 'apa7' where id = $1`, [PROJE]);
      const { rows } = await db.query(`select citation_style from public.citation_checks where project_id = $1`, [PROJE]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].citation_style, "vancouver", "denetimin stili çalışmanın yeni stiline kaymamalı");
    }));

  test("eski kayıtta stil NULL kalabilir (uydurulmaz)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(
        `insert into public.citation_checks (project_id, raw_reference_list, created_by) values ($1, 'Yılmaz, A. (2020). Başlık.', $2)`,
        [PROJE, OGRENCI],
      );
      const { rows } = await db.query(`select citation_style from public.citation_checks where project_id = $1`, [PROJE]);
      assert.equal(rows[0].citation_style, null);
    }));
});
