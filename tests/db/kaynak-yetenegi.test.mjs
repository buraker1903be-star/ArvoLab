// Asistan kaydında "kaynak" yeteneği (migration 20261103131215).
//
// Kaynakla sohbet her çalışmada ai_assistant_runs'a yazılıyor (AGENTS.md:
// "her asistan çalışması kaydedilir"); kısıt yeni değeri tanımazsa kayıt
// düşer ve yalnızca log'a gider. Kısıt yeniden kurulurken eski yetenekler
// düşmemeli, listede olmayan değer yine reddedilmeli.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";

const UYE = "00000000-0000-4000-8000-000000000c73";

let db;
before(async () => {
  db = await veritabani();
});

const calisma = (yetenek) =>
  `insert into public.ai_assistant_runs (user_id, capability, status, prompt_chars, output_chars) values ('${UYE}', '${yetenek}', 'completed', 10, 10)`;

describe("kaynak yeteneği", () => {
  test("kaynakla sohbet kaydedilebiliyor; eski yetenekler kısıttan düşmedi", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.exec(`insert into auth.users (id, email) values ('${UYE}', 'k@x.co');`);
      for (const y of ["analiz", "kaynakca", "literatur", "belge", "kanit", "makale", "uak", "kilavuz", "yazim", "kaynak"]) await db.exec(calisma(y));
      const { rows } = await db.query(`select count(*)::int as n from public.ai_assistant_runs where user_id = $1`, [UYE]);
      assert.equal(rows[0].n, 10);
    }));

  test("listede olmayan yetenek reddediliyor", () =>
    islem(db, async () => {
      await rol(db, "postgres");
      await db.exec(`insert into auth.users (id, email) values ('${UYE}', 'k@x.co');`);
      await reddedilir(db, calisma("tahmin"), [], /check constraint/);
    }));
});
