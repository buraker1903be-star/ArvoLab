// Kaynak künyesi ve notlarının düzenlenmesi (Signature OS 4.2, Kaynaklar ayrıntı paneli).
//
// Satır, sunucu işleminin (updateLiteratureSource) kullandığı AYNI fonksiyondan
// üretiliyor (lib/kaynak-formu.ts) ve işlemin sorgusuyla aynı biçimde yazılıyor:
// update … where id = ? and owner_id = ? returning id. Sınanan:
//   - sahip bütün künye alanlarını ve notunu yazar, okur;
//   - boşaltılan alan NULL olur (eski değer kalmaz);
//   - başkasının kaynağına yazılamaz: satır dönmez, işlem "bulunamadı" der;
//   - aboneliği biten kullanıcı KENDİ kaynağını düzenleyebilir (kapı yalnızca
//     ekleme için, lib/access.ts ve migration 20260924100003);
//   - formdaki bilinmeyen tür CHECK kısıtına çarpmaz, "other" yazılır.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, rol, veritabani } from "./ortam.mjs";
import { kaynakDuzenlemeSatiri } from "../../lib/kaynak-formu.ts";

const SAHIP = "00000000-0000-4000-8000-0000000000b1";
const YABANCI = "00000000-0000-4000-8000-0000000000b2";
const KAYNAK = "00000000-0000-4000-8000-0000000000b3";

let db;
before(async () => {
  db = await veritabani();
});

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into auth.users (id, email) values ('${SAHIP}', 's@x.co'), ('${YABANCI}', 'y@x.co');
    insert into public.literature_sources (id, owner_id, title, authors, year, source_type, container_title, notes)
      values ('${KAYNAK}', '${SAHIP}', 'Eski başlık', 'Eski, A.', '2000', 'article', 'Eski Dergi', 'eski not');
  `);
}

const form = (alanlar) => (ad) => alanlar[ad] ?? "";

/* İşlemin sorgusunun aynısı: temel + yayın alanları, sahiplik süzgeci, dönen kimlikler. */
async function duzenle(kullanici, alanlar) {
  const satir = kaynakDuzenlemeSatiri(form(alanlar));
  assert.ok(!("hata" in satir), "form geçerli olmalı");
  const degerler = { ...satir.temel, ...satir.yayin };
  const sutunlar = Object.keys(degerler);
  const { rows } = await db.query(
    `update public.literature_sources set ${sutunlar.map((s, i) => `${s} = $${i + 3}`).join(", ")}
       where id = $1 and owner_id = $2 returning id`,
    [KAYNAK, kullanici, ...Object.values(degerler)],
  );
  return rows;
}

const oku = async () => {
  await rol(db, "postgres");
  return (await db.query(`select * from public.literature_sources where id = $1`, [KAYNAK])).rows[0];
};

const TAM_FORM = {
  title: "Bounds testing approaches to the analysis of level relationships",
  authors: "Pesaran, M. H., Shin, Y., & Smith, R. J.",
  year: "2001",
  sourceType: "article",
  doiOrUrl: "https://doi.org/10.1002/jae.616",
  containerTitle: "Journal of Applied Econometrics",
  volume: "16",
  issue: "3",
  pages: "289–326",
  publisher: "Wiley",
  publicationPlace: "",
  notes: "ARDL sınır testi; yöntem bölümünde kullanılacak.",
};

describe("kaynak düzenleme", () => {
  test("sahip bütün künye alanlarını ve notunu yazar", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      const donen = await duzenle(SAHIP, TAM_FORM);
      assert.equal(donen.length, 1, "işlem 'kaydedildi' diyebilmeli");
      const k = await oku();
      assert.equal(k.title, TAM_FORM.title);
      assert.equal(k.authors, TAM_FORM.authors);
      assert.equal(k.year, "2001");
      assert.equal(k.doi_or_url, TAM_FORM.doiOrUrl);
      assert.equal(k.container_title, "Journal of Applied Econometrics");
      assert.equal(k.volume, "16");
      assert.equal(k.issue, "3");
      assert.equal(k.pages, "289–326");
      assert.equal(k.publisher, "Wiley");
      assert.equal(k.notes, TAM_FORM.notes);
    }));

  test("boşaltılan alan NULL olur, eski değer kalmaz", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await duzenle(SAHIP, { title: "Eski başlık", sourceType: "article", notes: "   ", containerTitle: "" });
      const k = await oku();
      assert.equal(k.notes, null);
      assert.equal(k.container_title, null);
      assert.equal(k.authors, null);
    }));

  test("başkasının kaynağına yazılamaz: satır dönmez, kayıt değişmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", YABANCI);
      // Yabancı kendi kimliğiyle de, sahibin kimliğini yazarak da deneyebilir; ikisinde de RLS satırı eler.
      assert.equal((await duzenle(YABANCI, TAM_FORM)).length, 0);
      assert.equal((await duzenle(SAHIP, TAM_FORM)).length, 0);
      const k = await oku();
      assert.equal(k.title, "Eski başlık");
      assert.equal(k.notes, "eski not");
    }));

  test("aboneliği biten kullanıcı kendi kaynağını düzenleyebilir (kapı yalnızca eklemede)", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "postgres");
      await db.query(`insert into public.individual_subscriptions (user_id, status, current_period_end) values ($1, 'canceled', now() - interval '1 day')`, [SAHIP]);
      await rol(db, "authenticated", SAHIP);
      assert.equal((await db.query(`select public.subscription_open() as acik`)).rows[0].acik, false, "kapı kapalı olmalı");
      assert.equal((await duzenle(SAHIP, { ...TAM_FORM, notes: "kapı kapalıyken yazılan not" })).length, 1);
      assert.equal((await oku()).notes, "kapı kapalıyken yazılan not");
    }));

  test("bilinmeyen tür CHECK kısıtına çarpmaz, 'other' yazılır; başlıksız form satır üretmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", SAHIP);
      await duzenle(SAHIP, { title: "Bir başlık", sourceType: "podcast" });
      assert.equal((await oku()).source_type, "other");
      assert.deepEqual(kaynakDuzenlemeSatiri(form({ title: "   " })), { hata: "baslik" });
    }));
});
