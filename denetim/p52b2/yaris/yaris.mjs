// P52b-2C tasarım sertleştirmesi: gerçek PostgreSQL 17 (READ COMMITTED) üzerinde
// yarış kanıtları. Uygulama kodu ya da migration DEĞİLDİR; her senaryo kendi
// karalama şemasında, yerel ve ayrı bir veritabanında (p52b2_yaris) çalışır.
//
// - Gerçek Storage'a istek yok, gerçek veri yok. Depo "depo" tablosuyla temsil
//   ediliyor; silme bir satırı silmek değil, `silindi = true` yazmak.
// - Hiçbir senaryoda DELETE ifadesi yok: kuyruk satırının iptali de `durum =
//   'IPTAL'` ile temsil ediliyor (anlamı aynı).
// - Worker ÇALIŞTIRILMIYOR: worker'ın kira alma, işaretleme ve yeniden deneme
//   adımları SQL oturumlarıyla, istenen sırada elle oynatılıyor.
//
// Çalıştırma:  createdb p52b2_yaris  &&  node denetim/p52b2/yaris/yaris.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Oturum, kilitBekliyorMu, bitti } from "./oturum.mjs";

const burasi = dirname(fileURLToPath(import.meta.url));
const sonuclar = [];
let sema = 0;

/* ---------------------------------------------------------------- düzenek */

const TEMEL = `
create table ref    (id bigserial primary key, yol text);              -- referans (ör. kaynak_pdfleri.depo_yolu)
create table depo   (yol text primary key, silindi boolean not null default false,
                     nesne_kimligi uuid not null default gen_random_uuid()); -- Storage temsili
create table kuyruk (yol text primary key, durum text not null,
                     kusak int not null default 0, kira_sahibi text, kira_bitis timestamptz,
                     nesne_kimligi uuid, deneme int not null default 0);
create table kanit  (yol text, kusak int, yazan text, at timestamptz default clock_timestamp());
`;

/* 2C ilk tasarımı (16.11 belgesi): tetikleyici kuyruk satırını FOR UPDATE ile kilitler. */
const BAGLA_V1 = `
create function bagla() returns trigger language plpgsql as $$
declare d text;
begin
  select durum into d from kuyruk where yol = new.yol for update;
  if d = 'PENDING_DELETE' then update kuyruk set durum = 'IPTAL' where yol = new.yol;
  elsif d in ('DELETING','DELETED') then raise exception 'BAGLAMA_REDDI durum=%', d;
  end if;
  return new;
end $$;
create trigger bagla before insert or update of yol on ref for each row execute function bagla();
`;
const KUYRUGA_AL_V1 = (yol) => `insert into kuyruk (yol, durum)
  select '${yol}', 'PENDING_DELETE'
  where not exists (select 1 from ref where yol = '${yol}')
  on conflict (yol) do nothing;`;

/* Önerilen: her iki taraf da yol başına bir danışma kilidini AYRI bir ifadede alır. */
const KILIT = `create function yol_kilidi(p text) returns void language sql volatile as
  $$ select pg_advisory_xact_lock(hashtextextended('arvolab.depo:' || p, 0)) $$;`;
const BAGLA_V2 = `
${KILIT}
create function bagla() returns trigger language plpgsql volatile as $$
declare d text; k int;
begin
  perform yol_kilidi(new.yol);
  select durum, kusak into d, k from kuyruk where yol = new.yol for update;
  if d = 'PENDING_DELETE' and k = 0 then update kuyruk set durum = 'IPTAL' where yol = new.yol;
  elsif d is not null and d <> 'IPTAL' then raise exception 'BAGLAMA_REDDI durum=% kusak=%', d, k;
  end if;
  return new;
end $$;
create trigger bagla before insert or update of yol on ref for each row execute function bagla();
create function kuyruga_al(p text) returns boolean language plpgsql volatile as $$
begin
  perform yol_kilidi(p);
  insert into kuyruk (yol, durum, nesne_kimligi)
    select p, 'PENDING_DELETE', (select nesne_kimligi from depo where yol = p)
    where not exists (select 1 from ref where yol = p)
    on conflict (yol) do nothing;
  return found;
end $$;
`;

async function senaryo(ad, aciklama, kur, govde) {
  const s = `y${Date.now().toString(36)}_${++sema}`;
  const kurucu = new Oturum("kurucu");
  const r0 = await kurucu.calistir(`create schema ${s}; set search_path to ${s}; ${kur}`);
  if (r0.hata) throw new Error(`${ad} kurulumu: ${r0.hata}`);
  const ac = async (o) => {
    const ot = new Oturum(o);
    await ot.calistir(`set search_path to ${s};`);
    await ot.pid();
    return ot;
  };
  const gozcu = new Oturum("gozcu");
  const oturumlar = [];
  const yeni = async (o) => {
    const ot = await ac(o);
    oturumlar.push(ot);
    return ot;
  };
  const durum = async (sql) => (await kurucu.calistir(sql)).cikti;
  let sonuc;
  try {
    sonuc = await govde({ yeni, gozcu, durum, kurucu });
  } catch (e) {
    sonuc = { gozlenen: `HATA: ${e.message}`, gecti: false };
  }
  for (const o of [...oturumlar, gozcu, kurucu]) o.kapat();
  const kayit = { ad, aciklama, sema: s, ...sonuc };
  sonuclar.push(kayit);
  console.log(`${kayit.gecti ? "GEÇTİ " : "KALDI "} ${ad} — ${kayit.gozlenen}`);
}

/** Kuyruk + referans son hâli: "SAHIPLI_VE_KUYRUKTA" kalıcı silmeye giden yoldur. */
async function sonHal(durum, yol = "p") {
  const ref = Number(await durum(`select count(*) from ref where yol = '${yol}';`));
  const k = (await durum(`select coalesce(max(durum), '-') from kuyruk where yol = '${yol}';`)) || "-";
  const tehlike = ref > 0 && (k === "PENDING_DELETE" || k === "DELETING");
  return { ref, kuyruk: k, tehlike };
}

/* ======================================================= A. kuyruğa alma ↔ bağlama */

// A1: 2C ilk tasarımı. Kuyruk satırı henüz yokken FOR UPDATE hiçbir şeyi kilitlemez.
for (const [kod, sira] of [
  ["A1-i1", "E kuyruğa alır (açık) → B bağlar → E commit → B commit"],
  ["A1-i2", "B bağlar (açık) → E kuyruğa alır → B commit → E commit"],
  ["A1-i3", "E kuyruğa alır, commit → sonra B bağlar (seri)"],
  ["A1-i4", "B bağlar, commit → sonra E kuyruğa alır (seri)"],
]) {
  await senaryo(kod, `İlk tasarım (INSERT … WHERE NOT EXISTS + tetikleyicide FOR UPDATE). ${sira}`, TEMEL + BAGLA_V1, async ({ yeni, gozcu, durum }) => {
    const E = await yeni("E");
    const B = await yeni("B");
    const bekleme = [];
    const adim = async (o, sql) => {
      const p = o.gonder(sql);
      const bloke = await kilitBekliyorMu(gozcu, await o.pid(), 400);
      bekleme.push(`${o.ad}:${bloke ? "BEKLEDI" : "-"}`);
      return bloke ? p : bitti(p);
    };
    if (kod === "A1-i1") {
      await E.calistir("begin;"); await adim(E, KUYRUGA_AL_V1("p"));
      await B.calistir("begin;"); await adim(B, "insert into ref (yol) values ('p');");
      await E.calistir("commit;"); await B.calistir("commit;");
    } else if (kod === "A1-i2") {
      await B.calistir("begin;"); await adim(B, "insert into ref (yol) values ('p');");
      await E.calistir("begin;"); await adim(E, KUYRUGA_AL_V1("p"));
      await B.calistir("commit;"); await E.calistir("commit;");
    } else if (kod === "A1-i3") {
      await adim(E, KUYRUGA_AL_V1("p")); await adim(B, "insert into ref (yol) values ('p');");
    } else {
      await adim(B, "insert into ref (yol) values ('p');"); await adim(E, KUYRUGA_AL_V1("p"));
    }
    const h = await sonHal(durum);
    const beklenen = kod === "A1-i1" || kod === "A1-i2" ? "tehlike" : "guvenli";
    return {
      beklenen: beklenen === "tehlike" ? "ANOMALİ (yol hem bağlı hem kuyrukta)" : "güvenli",
      gozlenen: `ref=${h.ref} kuyruk=${h.kuyruk} kilit=[${bekleme.join(" ")}]${h.tehlike ? " → ANOMALİ" : ""}`,
      gecti: (beklenen === "tehlike") === h.tehlike,
    };
  });
}

// A2: öneri. Danışma kilidi + sonraki ifadede yeniden okuma.
for (const [kod, sira] of [
  ["A2-i1", "E kuyruğa alır (açık) → B bağlar [BEKLER] → E commit → B iptal eder"],
  ["A2-i2", "B bağlar (açık) → E kuyruğa alır [BEKLER] → B commit → E eklemez"],
  ["A2-i3", "Yeniden bağlama (UPDATE ref set yol): E açık → B bekler → E commit → B iptal eder"],
  ["A2-i4", "İki eşzamanlı kuyruğa alma: tek satır"],
]) {
  await senaryo(kod, `Öneri: yol başına danışma kilidi, kontrol ayrı ifadede. ${sira}`, TEMEL + BAGLA_V2 + `insert into ref (yol) values ('baska');`, async ({ yeni, gozcu, durum }) => {
    const E = await yeni("E");
    const B = await yeni("B");
    const bekleme = [];
    if (kod === "A2-i1" || kod === "A2-i3") {
      await E.calistir("begin;");
      await bitti(E.gonder("select kuyruga_al('p');"));
      await B.calistir("begin;");
      const bsql = kod === "A2-i1" ? "insert into ref (yol) values ('p');" : "update ref set yol = 'p' where yol = 'baska';";
      const pB = B.gonder(bsql);
      bekleme.push(`B:${(await kilitBekliyorMu(gozcu, await B.pid(), 3000)) ? "BEKLEDI" : "-"}`);
      await E.calistir("commit;");
      const rb = await bitti(pB);
      await B.calistir("commit;");
      if (rb.hata) bekleme.push(`B-hata:${rb.hata}`);
    } else if (kod === "A2-i2") {
      await B.calistir("begin;");
      await bitti(B.gonder("insert into ref (yol) values ('p');"));
      await E.calistir("begin;");
      const pE = E.gonder("select kuyruga_al('p');");
      bekleme.push(`E:${(await kilitBekliyorMu(gozcu, await E.pid(), 3000)) ? "BEKLEDI" : "-"}`);
      await B.calistir("commit;");
      const re = await bitti(pE);
      bekleme.push(`kuyruga_al=${re.cikti}`);
      await E.calistir("commit;");
    } else {
      const E2 = await yeni("E2");
      await E.calistir("begin;");
      await bitti(E.gonder("select kuyruga_al('p');"));
      await E2.calistir("begin;");
      const p2 = E2.gonder("select kuyruga_al('p');");
      bekleme.push(`E2:${(await kilitBekliyorMu(gozcu, await E2.pid(), 3000)) ? "BEKLEDI" : "-"}`);
      await E.calistir("commit;");
      const r2 = await bitti(p2);
      await E2.calistir("commit;");
      bekleme.push(`E2.kuyruga_al=${r2.cikti}`);
      const n = await durum("select count(*) from kuyruk where yol='p';");
      return { beklenen: "tek satır, ikinci çağrı false", gozlenen: `satır=${n} [${bekleme.join(" ")}]`, gecti: n === "1" && r2.cikti === "f" };
    }
    const h = await sonHal(durum);
    const bekledi = bekleme.some((x) => x.endsWith("BEKLEDI"));
    return {
      beklenen: "güvenli; ikinci işlem kilitte bekler",
      gozlenen: `ref=${h.ref} kuyruk=${h.kuyruk} [${bekleme.join(" ")}]`,
      gecti: !h.tehlike && h.ref === 1 && bekledi,
    };
  });
}

// A2-yanlis-1: kilit doğru ama kontrol AYNI ifadede → ifadenin anlık görüntüsü kilitten önce alınmış.
await senaryo(
  "A2-yanlis-tek-ifade",
  "Kilit ile NOT EXISTS aynı INSERT ifadesinde: READ COMMITTED anlık görüntüsü kilit beklemesinden ÖNCE alınır",
  TEMEL + BAGLA_V2 +
    `create function kilitle_dogru(p text) returns boolean language plpgsql volatile as $$ begin perform yol_kilidi(p); return true; end $$;`,
  async ({ yeni, gozcu, durum }) => {
    const E = await yeni("E");
    const B = await yeni("B");
    await B.calistir("begin;");
    await bitti(B.gonder("insert into ref (yol) values ('p');"));
    await E.calistir("begin;");
    const pE = E.gonder(`insert into kuyruk (yol, durum) select 'p', 'PENDING_DELETE'
       where kilitle_dogru('p') and not exists (select 1 from ref where yol = 'p') on conflict do nothing;`);
    const bekledi = await kilitBekliyorMu(gozcu, await E.pid(), 3000);
    await B.calistir("commit;");
    await bitti(pE);
    await E.calistir("commit;");
    const h = await sonHal(durum);
    return {
      beklenen: "ANOMALİ (kilit beklendi ama karar eski görüntüyle verildi)",
      gozlenen: `E kilitte ${bekledi ? "bekledi" : "beklemedi"}; ref=${h.ref} kuyruk=${h.kuyruk}${h.tehlike ? " → ANOMALİ" : ""}`,
      gecti: bekledi && h.tehlike,
    };
  },
);

// A2-yanlis-2: tetikleyici işlevi STABLE ise kilitten sonraki okuma da dış ifadenin görüntüsünü kullanır.
await senaryo(
  "A2-yanlis-stable",
  "Tetikleyici işlevi STABLE: kilit alınsa da kuyruk okuması dış ifadenin (kilitten önceki) görüntüsüyle",
  TEMEL + KILIT + `
create function bagla() returns trigger language plpgsql stable as $$
declare d text;
begin
  perform yol_kilidi(new.yol);
  select durum into d from kuyruk where yol = new.yol;   -- STABLE işlevde FOR UPDATE yasak
  if d is not null then raise exception 'BAGLAMA_REDDI durum=%', d; end if;
  return new;
end $$;
create trigger bagla before insert on ref for each row execute function bagla();
create function kuyruga_al(p text) returns boolean language plpgsql volatile as $$
begin perform yol_kilidi(p);
  insert into kuyruk (yol, durum) select p, 'PENDING_DELETE' where not exists (select 1 from ref where yol = p) on conflict do nothing;
  return found; end $$;`,
  async ({ yeni, gozcu, durum }) => {
    const E = await yeni("E");
    const B = await yeni("B");
    await E.calistir("begin;");
    await bitti(E.gonder("select kuyruga_al('p');"));
    await B.calistir("begin;");
    const pB = B.gonder("insert into ref (yol) values ('p');");
    const bekledi = await kilitBekliyorMu(gozcu, await B.pid(), 3000);
    await E.calistir("commit;");
    const rb = await bitti(pB);
    await B.calistir("commit;");
    const h = await sonHal(durum);
    return {
      beklenen: "ANOMALİ (STABLE işlev yeni commit'i görmez)",
      gozlenen: `B kilitte ${bekledi ? "bekledi" : "beklemedi"}; bağlama ${rb.hata ? "reddedildi" : "geçti"}; ref=${h.ref} kuyruk=${h.kuyruk}${h.tehlike ? " → ANOMALİ" : ""}`,
      gecti: bekledi && h.tehlike,
    };
  },
);

// A3: SERIALIZABLE, ilk tasarımın mantığıyla: yazma çarpıklığı yakalanır, biri düşer.
await senaryo(
  "A3-serializable",
  "Aynı ilk tasarım, iki taraf da SERIALIZABLE: biri serialization_failure (40001) ile düşmeli",
  TEMEL + BAGLA_V1,
  async ({ yeni, durum }) => {
    const E = await yeni("E");
    const B = await yeni("B");
    await E.calistir("begin isolation level serializable;");
    await E.calistir(KUYRUGA_AL_V1("p"));
    await B.calistir("begin isolation level serializable;");
    const rb = await B.calistir("insert into ref (yol) values ('p');");
    const ce = await E.calistir("commit;");
    const cb = await B.calistir("commit;");
    const hatalar = [rb.hata, ce.hata, cb.hata].filter(Boolean).join(" | ");
    const h = await sonHal(durum);
    return {
      beklenen: "biri 40001 ile düşer; son hâl güvenli",
      gozlenen: `ref=${h.ref} kuyruk=${h.kuyruk}; hata: ${hatalar.slice(0, 110) || "yok"}`,
      gecti: /serializ/i.test(hatalar) && !h.tehlike,
    };
  },
);

// A4: değişmez nesne kaydı (satır ÖNCEDEN var): FOR UPDATE gerçekten sıralar.
await senaryo(
  "A4-kayit-satiri",
  "Nesne kaydı satırı yükleme anında yazılmışsa her iki taraf onu FOR UPDATE ile kilitler; READ COMMITTED yeniden değerlendirir",
  TEMEL + `
create table nesne (yol text primary key, durum text not null default 'ACTIVE');
insert into nesne values ('p');
create function bagla() returns trigger language plpgsql volatile as $$
declare d text;
begin
  select durum into d from nesne where yol = new.yol for update;
  if d = 'PENDING_DELETE' then update nesne set durum = 'ACTIVE' where yol = new.yol;
  elsif d <> 'ACTIVE' then raise exception 'BAGLAMA_REDDI durum=%', d; end if;
  return new;
end $$;
create trigger bagla before insert on ref for each row execute function bagla();`,
  async ({ yeni, gozcu, durum }) => {
    const E = await yeni("E");
    const B = await yeni("B");
    await B.calistir("begin;");
    await bitti(B.gonder("insert into ref (yol) values ('p');"));
    await E.calistir("begin;");
    // Tek ifade: UPDATE … WHERE NOT EXISTS. Satır kilitliyse bekler ve kilit kalkınca
    // satırı YENİDEN okur (EvalPlanQual) — ama NOT EXISTS alt sorgusu yeniden okunmaz.
    const pE = E.gonder(`update nesne set durum = 'PENDING_DELETE' where yol = 'p' and durum = 'ACTIVE'
       and not exists (select 1 from ref where yol = 'p');`);
    const bekledi = await kilitBekliyorMu(gozcu, await E.pid(), 3000);
    await B.calistir("commit;");
    await bitti(pE);
    await E.calistir("commit;");
    const n = await durum("select durum from nesne where yol='p';");
    const ref = await durum("select count(*) from ref where yol='p';");
    return {
      beklenen: "kayıt satırı kilidi sıralar; ama tek ifadedeki NOT EXISTS yeniden okunmaz → kontrol ayrı ifadede olmalı",
      gozlenen: `E ${bekledi ? "bekledi" : "beklemedi"}; nesne=${n} ref=${ref}${n === "PENDING_DELETE" && ref === "1" ? " → ANOMALİ (EvalPlanQual alt sorguyu tazelemez)" : " → güvenli"}`,
      // Bu senaryo bir KANIT: sonucu hangisi olursa olsun kayda geçer; beklenen ANOMALİ.
      gecti: bekledi && n === "PENDING_DELETE" && ref === "1",
    };
  },
);

/* ===================================================== B. kira süresi ve geç yanıt */

const ISCI_V1 = `
create function kira_al(w text) returns table (yol text, kusak int) language sql volatile as $$
  update kuyruk set durum = 'DELETING', kira_sahibi = w, kira_bitis = clock_timestamp() + interval '1 second', kusak = kusak + 1
  where kuyruk.yol in (select k.yol from kuyruk k where k.durum = 'PENDING_DELETE' order by k.yol for update skip locked limit 1)
  returning kuyruk.yol, kuyruk.kusak $$;
create function kurtar() returns int language sql volatile as $$
  with x as (update kuyruk set durum = 'PENDING_DELETE', kira_sahibi = null, deneme = deneme + 1
             where durum = 'DELETING' and kira_bitis < clock_timestamp() returning 1) select count(*)::int from x $$;
create function depo_sil(p text) returns void language sql volatile as $$ update depo set silindi = true where yol = p $$;
`;
const bekle = (ms) => new Promise((c) => setTimeout(c, ms));

await senaryo(
  "B1-ilk-tasarim",
  "Worker A silme isteğinde takılır, kira dolar, yol PENDING_DELETE'e döner, kullanıcı aynı yolu bağlar, A'nın gecikmiş isteği SONRA uygulanır",
  TEMEL + BAGLA_V2 + ISCI_V1 + `insert into depo (yol) values ('p'); select kuyruga_al('p');`,
  async ({ yeni, durum }) => {
    const A = await yeni("A");
    const U = await yeni("U");
    const kira = (await A.calistir("select kusak from kira_al('A');")).cikti;
    // A, Storage'a DELETE gönderdi; istek yolda (henüz uygulanmadı).
    await bekle(1300);
    const kurtarilan = (await A.calistir("select kurtar();")).cikti;
    // İlk tasarımda kurtarılan satır PENDING_DELETE + kusak sayılmıyor → bağlama iptal edebiliyor.
    // V2 tetikleyicisi kusak > 0'ı reddediyor; ilk tasarımı göstermek için kusak'ı bilerek sıfırlıyoruz.
    await durum("update kuyruk set kusak = 0 where yol = 'p';");
    const bag = await U.calistir("insert into ref (yol) values ('p');");
    await A.calistir("select depo_sil('p');"); // gecikmiş istek şimdi uygulandı
    const ref = await durum("select count(*) from ref where yol='p';");
    const sil = await durum("select silindi from depo where yol='p';");
    return {
      beklenen: "VERİ KAYBI (bağlı dosya silindi)",
      gozlenen: `kira kuşağı=${kira}, kurtarılan=${kurtarilan}, bağlama=${bag.hata ? "red" : "geçti"}, ref=${ref}, dosya silindi=${sil}${ref === "1" && sil === "t" ? " → VERİ KAYBI" : ""}`,
      gecti: ref === "1" && sil === "t",
    };
  },
);

await senaryo(
  "B1b-isim-ile-bitlemeli",
  "Kuşak yerine kira_sahibi adıyla koşullu geçiş: aynı adla yeniden başlayan worker'ın geç 'yeniden dene'si B'nin kirasını düşürür",
  TEMEL + BAGLA_V2 + ISCI_V1 + `insert into depo (yol) values ('p'); select kuyruga_al('p');`,
  async ({ yeni, durum }) => {
    const A = await yeni("A");
    const B = await yeni("B");
    await A.calistir("select kusak from kira_al('isci-1');");
    await bekle(1300);
    await B.calistir("select kurtar();");
    await B.calistir("select kusak from kira_al('isci-1');"); // aynı dağıtım, aynı ad
    // A'nın gecikmiş yanıtı "bilinmiyor": yeniden dene, yalnızca ada göre koşullu
    const r = await A.calistir(`with x as (update kuyruk set durum = 'PENDING_DELETE', deneme = deneme + 1
      where yol = 'p' and durum = 'DELETING' and kira_sahibi = 'isci-1' returning 1) select count(*) from x;`);
    const C = await yeni("C");
    const c = (await C.calistir("select count(*) from kira_al('isci-2');")).cikti;
    return {
      beklenen: "ÇİFT KİRA (B hâlâ çalışırken C de aldı)",
      gozlenen: `A'nın geç yazımı ${r.cikti} satırı (B'nin kirasını) geri aldı; ardından C kira aldı=${c}${c === "1" ? " → ÇİFT KİRA" : ""}`,
      gecti: c === "1",
    };
  },
);

const ISCI_V2 = `
create function kira_al(w text) returns table (yol text, kusak int) language sql volatile as $$
  update kuyruk set durum = 'DELETING', kira_sahibi = w, kira_bitis = clock_timestamp() + interval '1 second', kusak = kusak + 1
  where kuyruk.yol in (select k.yol from kuyruk k where k.durum = 'PENDING_DELETE' order by k.yol for update skip locked limit 1)
  returning kuyruk.yol, kuyruk.kusak $$;
create function kurtar() returns int language sql volatile as $$
  with x as (update kuyruk set durum = 'PENDING_DELETE', kira_sahibi = null, deneme = deneme + 1
             where durum = 'DELETING' and kira_bitis < clock_timestamp() returning 1) select count(*)::int from x $$;
create function depo_sil(p text) returns void language sql volatile as $$ update depo set silindi = true where yol = p $$;
-- Bütün geçişler kuşağa (bitleme jetonu) koşullu; kanıt aynı ifadede, en çok bir kez.
create function silindi_isaretle(p text, k int, w text) returns int language sql volatile as $$
  with x as (update kuyruk set durum = 'DELETED' where yol = p and kusak = k and durum = 'DELETING' returning yol, kusak),
       y as (insert into kanit (yol, kusak, yazan) select yol, kusak, w from x returning 1)
  select count(*)::int from y $$;
create function yeniden_dene(p text, k int) returns int language sql volatile as $$
  with x as (update kuyruk set durum = 'PENDING_DELETE', deneme = deneme + 1 where yol = p and kusak = k and durum = 'DELETING' returning 1)
  select count(*)::int from x $$;
-- Silmeden hemen önce: yoldaki nesne, kuyruğa alınan nesne mi?
create function ayni_nesne_mi(p text) returns boolean language sql volatile as $$
  select exists (select 1 from depo d join kuyruk k using (yol) where d.yol = p and d.nesne_kimligi = k.nesne_kimligi and not d.silindi) $$;
`;

await senaryo(
  "B2-oneri",
  "Aynı akış önerilen tasarımla: bir kez kiralanan yol bir daha bağlanamaz, geçişler kuşağa koşullu, kanıt bir kez",
  TEMEL + BAGLA_V2 + ISCI_V2 + `insert into depo (yol) values ('p'); select kuyruga_al('p');`,
  async ({ yeni, durum }) => {
    const A = await yeni("A");
    const U = await yeni("U");
    const B = await yeni("B");
    const kA = (await A.calistir("select kusak from kira_al('isci-1');")).cikti;
    await bekle(1300);
    await B.calistir("select kurtar();");
    const bag = await U.calistir("insert into ref (yol) values ('p');"); // reddedilmeli
    const yeniYol = await U.calistir("insert into depo (yol) values ('p2'); insert into ref (yol) values ('p2');");
    await A.calistir("select depo_sil('p');"); // A'nın gecikmiş isteği
    const kB = (await B.calistir("select kusak from kira_al('isci-1');")).cikti;
    const isB = (await B.calistir(`select silindi_isaretle('p', ${kB}, 'B');`)).cikti;
    const isA = (await A.calistir(`select silindi_isaretle('p', ${kA}, 'A');`)).cikti;
    const ddA = (await A.calistir(`select yeniden_dene('p', ${kA});`)).cikti;
    const ref = await durum("select count(*) from ref where yol='p';");
    const ref2 = await durum("select count(*) from ref r join depo d using (yol) where r.yol='p2' and not d.silindi;");
    const kan = await durum("select count(*) from kanit where yol='p';");
    const son = await durum("select durum||'/'||kusak from kuyruk where yol='p';");
    const ok = !!bag.hata && /BAGLAMA_REDDI/.test(bag.hata) && !yeniYol.hata && ref === "0" && ref2 === "1" && isB === "1" && isA === "0" && ddA === "0" && kan === "1" && son === "DELETED/2";
    return {
      beklenen: "bağlama reddi, yeni yolla yükleme, A'nın geç yazımları 0 satır, kanıt 1, son DELETED/2",
      gozlenen: `bağlama=${bag.hata ? "red" : "geçti"}, yeni yol bağlı=${ref2}, B işaretledi=${isB}, A geç işaret=${isA}, A geç yeniden dene=${ddA}, kanıt=${kan}, son=${son}`,
      gecti: ok,
    };
  },
);

await senaryo(
  "B3-nesne-kimligi",
  "Yol aynı ama nesne değişmiş (belirlenimci yol üzerine yazıldı): worker silmeden önce fark eder ve durur",
  TEMEL + BAGLA_V2 + ISCI_V2 + `insert into depo (yol) values ('p'); select kuyruga_al('p');`,
  async ({ yeni, durum }) => {
    const W = await yeni("W");
    const k = (await W.calistir("select kusak from kira_al('isci-1');")).cikti;
    await durum("update depo set nesne_kimligi = gen_random_uuid() where yol = 'p';"); // aynı yola yeni dosya
    const ayni = (await W.calistir("select ayni_nesne_mi('p');")).cikti;
    return {
      beklenen: "ayni_nesne_mi = false → silme yapılmaz, satır elle bakılmalıya",
      gozlenen: `kuşak=${k}, ayni_nesne_mi=${ayni}`,
      gecti: ayni === "f",
    };
  },
);

/* ============================================================ C. eksik envanter */

await senaryo(
  "C1-offset-tekrar-kayip",
  "storage.search gibi ORDER BY name LIMIT/OFFSET: sayfalar arasında ekleme bir nesneyi İKİ KEZ, silme bir nesneyi HİÇ göstermez",
  `create table nesneler (name text primary key, gorunur boolean not null default true);
   insert into nesneler select chr(97 + g) from generate_series(0, 8) g;`,
  async ({ yeni }) => {
    const L = await yeni("L");
    const D = await yeni("D");
    const sayfa = async (ofs) =>
      (await L.calistir(`select string_agg(name, ',' order by name) from (select name from nesneler where gorunur order by name limit 3 offset ${ofs}) s;`)).cikti;
    // Tur 1: araya ekleme
    const t1 = [await sayfa(0)];
    await D.calistir("insert into nesneler values ('aa');");
    t1.push(await sayfa(3), await sayfa(6), await sayfa(9));
    // Tur 2: araya silme (Storage'da satır gider; burada görünmez yapılıyor)
    await D.calistir("update nesneler set gorunur = (name <> 'aa');");
    const t2 = [await sayfa(0)];
    await D.calistir("update nesneler set gorunur = false where name = 'b';");
    t2.push(await sayfa(3), await sayfa(6), await sayfa(9));
    const tekrar = t1.join(",").split(",").filter(Boolean);
    const cift = tekrar.filter((x, i) => tekrar.indexOf(x) !== i);
    const goru = t2.join(",").split(",").filter(Boolean);
    const kayip = ["a", "c", "d", "e", "f", "g", "h", "i"].filter((x) => !goru.includes(x));
    return {
      beklenen: "tur 1'de tekrar eden, tur 2'de hiç görünmeyen bir nesne",
      gozlenen: `ekleme: [${t1.join(" | ")}] tekrar=${cift.join(",") || "-"}; silme: [${t2.join(" | ")}] görünmeyen=${kayip.join(",") || "-"}`,
      gecti: cift.length === 1 && kayip.length === 1,
    };
  },
);

/* ------------------------------------------------------------------- rapor */
const ozetSatir = { toplam: sonuclar.length, gecen: sonuclar.filter((x) => x.gecti).length };
const dosya = join(burasi, "..", "sonuclar", "yaris.json");
mkdirSync(dirname(dosya), { recursive: true });
writeFileSync(
  dosya,
  JSON.stringify({ zaman: new Date().toISOString(), postgres: process.env.PG_SURUM ?? "17", izolasyon: "read committed", ...ozetSatir, sonuclar }, null, 2) + "\n",
);
console.log(`\n${ozetSatir.gecen}/${ozetSatir.toplam} kanıt beklendiği gibi`);
process.exit(ozetSatir.gecen === ozetSatir.toplam ? 0 : 1);
