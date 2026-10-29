// Kanıt zinciri, makale profili ve tarama günlüğü (migration 20261026065320).
//
// Sınanan kurallar kodda değil VERİTABANINDA: uygulama atlansa da (doğrudan
// PostgREST isteği) alıntı kaynakta olmalı, metinsiz hüküm verilemez, metin
// değişince eski hüküm düşer, yabancı kaynak bağlanamaz, asistan hükmü bir
// asistan kaydına dayanır. Her kuralın yanında meşru akış da sınanıyor.
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { islem, reddedilir, rol, veritabani } from "./ortam.mjs";
import { kanitMetniNormallestir } from "../../lib/kanit/alinti.ts";

const OGRENCI = "00000000-0000-4000-8000-000000000101";
const BASKA = "00000000-0000-4000-8000-000000000102";
const KONTROLOR = "00000000-0000-4000-8000-000000000103";
const YABANCI_KONTROLOR = "00000000-0000-4000-8000-000000000104";
const KURUM = "00000000-0000-4000-8000-0000000001a1";
const BASKA_KURUM = "00000000-0000-4000-8000-0000000001a2";
const MAKALE = "00000000-0000-4000-8000-0000000001b1";
const TEZ = "00000000-0000-4000-8000-0000000001b2";
const BASKA_PROJE = "00000000-0000-4000-8000-0000000001b3";
const KAYNAK = "00000000-0000-4000-8000-0000000001c1";
const BASKA_KAYNAK = "00000000-0000-4000-8000-0000000001c2";
const KANIT = "00000000-0000-4000-8000-0000000001d1";

const METIN = `Bulgular, harmanlanmış öğrenme ortamındaki öğrencilerin matematik
öz-yeterlik puanlarının kontrol grubuna göre “anlamlı biçimde” yüksek olduğunu göster-
mektedir. Ancak etki uzun dönemde sınanmamıştır.`;

let db;
before(async () => {
  db = await veritabani();
});

const tek = async (sql, p = []) => (await db.query(sql, p)).rows[0];

async function tohum() {
  await rol(db, "postgres");
  await db.exec(`
    insert into public.organizations (id, name) values ('${KURUM}', 'Kurum A'), ('${BASKA_KURUM}', 'Kurum B');
    insert into auth.users (id, email) values
      ('${OGRENCI}', 'o@x.co'), ('${BASKA}', 'b@x.co'), ('${KONTROLOR}', 'k@x.co'), ('${YABANCI_KONTROLOR}', 'y@x.co');
    update public.profiles set organization_id = '${KURUM}' where id in ('${OGRENCI}', '${KONTROLOR}');
    update public.profiles set organization_id = '${BASKA_KURUM}' where id in ('${BASKA}', '${YABANCI_KONTROLOR}');
    update public.profiles set role = 'controller' where id in ('${KONTROLOR}', '${YABANCI_KONTROLOR}');
    insert into public.academic_projects (id, owner_id, organization_id, title, project_type) values
      ('${MAKALE}', '${OGRENCI}', '${KURUM}', 'Öğrencinin makalesi', 'article'),
      ('${TEZ}', '${OGRENCI}', '${KURUM}', 'Öğrencinin tezi', 'thesis'),
      ('${BASKA_PROJE}', '${BASKA}', '${BASKA_KURUM}', 'Başkasının makalesi', 'article');
    insert into public.literature_sources (id, owner_id, title) values
      ('${KAYNAK}', '${OGRENCI}', 'Harmanlanmış öğrenme ve öz-yeterlik'),
      ('${BASKA_KAYNAK}', '${BASKA}', 'Başkasının kaynağı');
  `);
}

async function kanitEkle() {
  await rol(db, "authenticated", OGRENCI);
  await db.query(
    `insert into public.kanit_kayitlari (id, project_id, olusturan, iddia, kaynak_id)
     values ($1, $2, $3, 'Harmanlanmış öğrenme öz-yeterliği artırır.', $4)`,
    [KANIT, MAKALE, OGRENCI, KAYNAK],
  );
}

/*
  Asistan kaydını yalnızca sunucu yazar (20261029133812: tarayıcıya
  açık INSERT kurumun kredisini sıfırlatabiliyordu). Kayıt service_role
  ile yazılıp oturum yeniden öğrenciye döner.
*/
async function sunucuKaydi(sql, params, kullanici) {
  await rol(db, "service_role");
  const sonuc = await db.query(sql, params);
  await rol(db, "authenticated", kullanici);
  return sonuc.rows[0];
}

describe("alıntı normalleştirmesi: uygulama ve veritabanı aynı kuralı uyguluyor", () => {
  /*
    lib/kanit/alinti.ts ile public.kanit_metni_normallestir ayrışırsa
    uygulamanın "metinde var" dediği alıntıyı veritabanı reddeder (ya da
    tersi). Aynı girdiler iki tarafta da aynı çıktıyı vermeli.
  */
  const ORNEKLER = [
    "düz metin",
    "  baştaki ve sondaki boşluk  ",
    "satır\nsonu\r\nve\tsekme",
    "kıvrık “çift” ve ‘tek’ tırnak",
    "uzun — tire – ve ‐ kısa",
    "yumuşak\u00adtire",
    "satır sonu tire-\nlemesi",
    "bölünmez\u00a0boşluk ve ince\u2009boşluk",
    "birleşik i\u0307 ve hazır İ",
    "Ğ Ü Ş İ Ö Ç ı",
    METIN,
  ];

  test("her örnekte aynı çıktı", async () => {
    await rol(db, "postgres");
    for (const ornek of ORNEKLER) {
      const { sonuc } = await tek(`select public.kanit_metni_normallestir($1) as sonuc`, [ornek]);
      assert.equal(sonuc, kanitMetniNormallestir(ornek), JSON.stringify(ornek));
    }
  });

  test("normalleştirme fonksiyonu dışarıya kapalı", () =>
    islem(db, async () => {
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(db, `select public.kanit_metni_normallestir('x')`, [], /permission denied/);
    }));
});

describe("kanıt kaydı kuralları", () => {
  test("alıntı incelenen metinde geçmiyorsa reddedilir; tırnak/boşluk/tireleme farkı kabul edilir", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      await reddedilir(
        db,
        `update public.kanit_kayitlari set incelenen_metin = $2, incelenen_kapsam = 'bolum', alinti = 'öğrencilerin başarısı iki kat arttı' where id = $1`,
        [KANIT, METIN],
        /Alıntı incelenen metinde geçmiyor/,
      );
      // PDF'ten kopyalanmış metin, öğrencinin düz tırnakla ve tek satırda yazdığı alıntı.
      await db.query(
        `update public.kanit_kayitlari set incelenen_metin = $2, incelenen_kapsam = 'bolum',
           alinti = 'puanlarının kontrol grubuna göre "anlamlı biçimde" yüksek olduğunu göstermektedir' where id = $1`,
        [KANIT, METIN],
      );
    }));

  test("metin ve alıntı olmadan destek hükmü verilemez; 'doğrulanamadı' verilebilir", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      await reddedilir(
        db,
        `update public.kanit_kayitlari set destek_duzeyi = 'dogrudan', degerlendiren = 'kullanici' where id = $1`,
        [KANIT],
        /kanit_metinsiz_hukum_yok/,
      );
      await db.query(`update public.kanit_kayitlari set destek_duzeyi = 'dogrulanamadi', degerlendiren = 'kullanici' where id = $1`, [KANIT]);
    }));

  test("metin değişince eski hüküm düşer; alıntı yeni metinde yoksa o da düşer, varsa kalır", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      const alinti = "Ancak etki uzun dönemde sınanmamıştır.";
      await db.query(
        `update public.kanit_kayitlari set incelenen_metin = $2, incelenen_kapsam = 'bolum', alinti = $3 where id = $1`,
        [KANIT, METIN, alinti],
      );
      await db.query(
        `update public.kanit_kayitlari set destek_duzeyi = 'kismen', degerlendiren = 'kullanici', degerlendirildi = now(), gerekce = 'kısmi' where id = $1`,
        [KANIT],
      );
      // Metin genişletildi, alıntı hâlâ içinde: alıntı kalır, hüküm düşer.
      await db.query(`update public.kanit_kayitlari set incelenen_metin = $2 where id = $1`, [KANIT, `${METIN}\nEk paragraf.`]);
      let satir = await tek(`select destek_duzeyi, degerlendiren, alinti from public.kanit_kayitlari where id = $1`, [KANIT]);
      assert.deepEqual(satir, { destek_duzeyi: "degerlendirilmedi", degerlendiren: null, alinti });
      // Metin tamamen değişti: alıntı da düşer.
      await db.query(`update public.kanit_kayitlari set incelenen_metin = 'Bambaşka bir paragraf, ilgisiz.' where id = $1`, [KANIT]);
      satir = await tek(`select alinti from public.kanit_kayitlari where id = $1`, [KANIT]);
      assert.equal(satir.alinti, null);
    }));

  test("kaynak değişince künye ve erişim sonucu düşer", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      // Künye sonucunu yalnızca sunucu yazar (20261029143148).
      await sunucuKaydi(
        `update public.kanit_kayitlari set kunye_durumu = 'dogrulandi', kunye_kaynagi = 'crossref', kunye_bakildi = now(), erisim_durumu = 'acik_erisim' where id = $1`,
        [KANIT],
        OGRENCI,
      );
      await db.query(`update public.kanit_kayitlari set kaynak_id = null where id = $1`, [KANIT]);
      const satir = await tek(`select kunye_durumu, kunye_kaynagi, erisim_durumu from public.kanit_kayitlari where id = $1`, [KANIT]);
      assert.deepEqual(satir, { kunye_durumu: "bakilmadi", kunye_kaynagi: null, erisim_durumu: "bilinmiyor" });
    }));

  test("künye sonucu dizinsiz ve tarihsiz yazılamaz", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      await rol(db, "service_role");
      await reddedilir(db, `update public.kanit_kayitlari set kunye_durumu = 'dogrulandi' where id = $1`, [KANIT], /kanit_kunye_kaynakli/);
    }));

  /*
    20261029143148'e kadar öğrenci kendi kaydına "Crossref'te doğrulandı"
    yazabiliyordu: dizine hiç bakılmamış künye doğrulanmış görünüyordu.
  */
  test("öğrenci künye sonucunu kendisi yazamaz", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      await reddedilir(
        db,
        `update public.kanit_kayitlari set kunye_durumu = 'dogrulandi', kunye_kaynagi = 'crossref', kunye_bakildi = now() where id = $1`,
        [KANIT],
        /yalnızca doğrulama işlemiyle/,
      );
      // İlgisiz alanlar (notlar) yazılabilir.
      await db.query(`update public.kanit_kayitlari set eksik_kanit = 'Sayfa numarası eksik.' where id = $1`, [KANIT]);
    }));

  test("başkasının kaynağı bağlanamaz", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      await reddedilir(db, `update public.kanit_kayitlari set kaynak_id = $2 where id = $1`, [KANIT, BASKA_KAYNAK], /kaynağa erişiminiz yok/);
    }));

  test("asistan hükmü tamamlanmış bir 'kanit' asistan kaydına bağlanmalı", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();
      const alinti = "Ancak etki uzun dönemde sınanmamıştır.";
      await db.query(`update public.kanit_kayitlari set incelenen_metin = $2, incelenen_kapsam = 'bolum', alinti = $3 where id = $1`, [KANIT, METIN, alinti]);
      // Kayıtsız asistan hükmü
      await reddedilir(
        db,
        `update public.kanit_kayitlari set destek_duzeyi = 'dolayli', degerlendiren = 'asistan' where id = $1`,
        [KANIT],
        /asistan kaydına bağlanmalı|verdiği düzeyle/,
      );
      // Başka yeteneğin kaydı
      const { id: analiz } = await sunucuKaydi(
        `insert into public.ai_assistant_runs (user_id, capability, status) values ($1, 'analiz', 'completed') returning id`,
        [OGRENCI],
        OGRENCI,
      );
      await reddedilir(
        db,
        `update public.kanit_kayitlari set destek_duzeyi = 'dolayli', degerlendiren = 'asistan', asistan_kaydi = $2 where id = $1`,
        [KANIT, analiz],
        /asistan kaydına bağlanmalı|verdiği düzeyle/,
      );
      /*
        Asistanın "doğrulanamadı" dediği çalışmanın kimliğiyle "doğrudan
        destekleniyor — asistan" yazılamaz (20261029143148'e kadar
        yazılabiliyordu: yalnızca kaydın varlığına bakılıyordu).
      */
      const { id: baskaHukum } = await sunucuKaydi(
        `insert into public.ai_assistant_runs (user_id, capability, status, findings) values ($1, 'kanit', 'completed', '{"duzey":"dogrulanamadi"}') returning id`,
        [OGRENCI],
        OGRENCI,
      );
      await reddedilir(
        db,
        `update public.kanit_kayitlari set destek_duzeyi = 'dolayli', degerlendiren = 'asistan', asistan_kaydi = $2 where id = $1`,
        [KANIT, baskaHukum],
        /verdiği düzeyle/,
      );
      // Meşru: kendi tamamlanmış kanıt kaydı
      const { id: kanitKaydi } = await sunucuKaydi(
        `insert into public.ai_assistant_runs (user_id, capability, status, findings) values ($1, 'kanit', 'completed', '{"duzey":"dolayli"}') returning id`,
        [OGRENCI],
        OGRENCI,
      );
      await db.query(
        `update public.kanit_kayitlari set destek_duzeyi = 'dolayli', degerlendiren = 'asistan', asistan_kaydi = $2, degerlendirildi = now() where id = $1`,
        [KANIT, kanitKaydi],
      );
    }));

  test("asistan kayıtları yeni yetenekleri ve 'alinti' ret nedenini kabul ediyor", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "service_role");
      await db.query(`insert into public.ai_assistant_runs (user_id, capability, status, reject_reason) values ($1, 'kanit', 'rejected', 'alinti')`, [OGRENCI]);
      await db.query(`insert into public.ai_assistant_runs (user_id, capability, status) values ($1, 'makale', 'completed')`, [OGRENCI]);
      await reddedilir(db, `insert into public.ai_assistant_runs (user_id, capability, status) values ($1, 'uydurma', 'completed')`, [OGRENCI], /capability_check/);
    }));
});

describe("kanıt kayıtlarında kurum sınırı", () => {
  test("aynı kurumun kontrolörü okur ve insan incelemesini işaretler; başka kurumun kontrolörü ve başka öğrenci göremez", () =>
    islem(db, async () => {
      await tohum();
      await kanitEkle();

      await rol(db, "authenticated", KONTROLOR);
      assert.equal((await db.query(`select id from public.kanit_kayitlari`)).rows.length, 1);
      await db.query(`update public.kanit_kayitlari set insan_incelemesi = 'yapildi' where id = $1`, [KANIT]);

      for (const kisi of [YABANCI_KONTROLOR, BASKA]) {
        await rol(db, "authenticated", kisi);
        assert.equal((await db.query(`select id from public.kanit_kayitlari`)).rows.length, 0, kisi);
        const { rows } = await db.query(`update public.kanit_kayitlari set iddia = 'ele geçirildi' where id = $1 returning id`, [KANIT]);
        assert.equal(rows.length, 0, kisi);
      }
    }));

  test("başkasının çalışmasına kanıt eklenemez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await reddedilir(
        db,
        `insert into public.kanit_kayitlari (project_id, olusturan, iddia) values ($1, $2, 'Sızma denemesi iddiası')`,
        [BASKA_PROJE, OGRENCI],
        /row-level security/,
      );
    }));
});

describe("makale profili", () => {
  test("yalnızca makale türündeki çalışmaya yazılır", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await db.query(`insert into public.makale_profili (project_id, makale_turu, hedef_dergi) values ($1, 'sistematik_derleme', 'Dergi')`, [MAKALE]);
      await reddedilir(db, `insert into public.makale_profili (project_id) values ($1)`, [TEZ], /row-level security/);
      await reddedilir(db, `insert into public.makale_profili (project_id) values ($1)`, [BASKA_PROJE], /row-level security/);
      await reddedilir(
        db,
        `update public.makale_profili set anahtar_en_az = 6, anahtar_en_cok = 3 where project_id = $1`,
        [MAKALE],
        /makale_anahtar_araligi/,
      );
    }));
});

describe("literatür tarama günlüğü", () => {
  const ekle = (kullanici, proje) =>
    db.query(
      `insert into public.literatur_tarama_gunlugu (kullanici, project_id, sorgu, sorgulanan, yanit_veren, gosterilen_sonuc)
       values ($1, $2, '"blended learning" AND self-efficacy', '{openalex,crossref}', '{openalex}', 12) returning id`,
      [kullanici, proje],
    );

  test("kendi adına yazılır, değiştirilemez ve silinemez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      const { rows } = await ekle(OGRENCI, MAKALE);
      await reddedilir(db, `update public.literatur_tarama_gunlugu set gosterilen_sonuc = 500 where id = $1`, [rows[0].id], /permission denied/);
      await reddedilir(db, `delete from public.literatur_tarama_gunlugu where id = $1`, [rows[0].id], /permission denied/);
      await reddedilir(db, `insert into public.literatur_tarama_gunlugu (kullanici, sorgu, sorgulanan, yanit_veren, gosterilen_sonuc) values ($1, 'x', '{}', '{}', 0)`, [BASKA], /row-level security/);
      await reddedilir(db, `insert into public.literatur_tarama_gunlugu (kullanici, project_id, sorgu, sorgulanan, yanit_veren, gosterilen_sonuc) values ($1, $2, 'x', '{}', '{}', 0)`, [OGRENCI, BASKA_PROJE], /row-level security/);
    }));

  test("çalışmaya bağlı günlüğü aynı kurumun kontrolörü görür, başka kurumunki görmez", () =>
    islem(db, async () => {
      await tohum();
      await rol(db, "authenticated", OGRENCI);
      await ekle(OGRENCI, MAKALE);
      await ekle(OGRENCI, null);
      await rol(db, "authenticated", KONTROLOR);
      assert.equal((await db.query(`select id from public.literatur_tarama_gunlugu`)).rows.length, 1);
      await rol(db, "authenticated", YABANCI_KONTROLOR);
      assert.equal((await db.query(`select id from public.literatur_tarama_gunlugu`)).rows.length, 0);
    }));
});
