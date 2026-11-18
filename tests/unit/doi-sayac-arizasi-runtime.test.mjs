/*
  D5 (13.11.2026): toplu DOI içe aktarmanın sayaç arızası, GERÇEK eylem
  düzeyinde. app/actions/kaynak-aktarim.ts → doiIleEkle çalıştırılıyor;
  yalnızca dış kenarlar sahte: oturum, abonelik, yönetim istemcisi (RPC),
  dil, önbellek tazeleme ve global fetch. Gerçek Crossref ya da Supabase
  çağrısı YOK: beklenmeyen bir adres testi düşürür.

  Neden ayrı dosya: sahte modüller süreç başına bir kez kurulur ve node
  --test her dosyayı ayrı süreçte koşar. Mevcut runtime dosyasının
  düzeneğine dokunmadan aynı eylemi sınar.

  Üç arıza: yönetim istemcisi yok, RPC hata döndürüyor, RPC cevabı bozuk.
  Her birinde beklenen: Crossref 0, kaynak kaydı 0, aranacak DOI'lerin
  tamamı "ertelendi / ariza", kullanıcının sırası, yeniden denenebilirlik.
  Eskiden (D5'in ilk hâli) arıza dalı yalnızca "vardi" satırlarını
  döndürüyordu; T3'te (fail-open) ise Crossref'e istenen kadar gidiliyordu.
  İkisi de burada düşer.
*/
import { registerHooks } from "node:module";
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// ---- Sahte modüller (eylem import edilmeden ÖNCE kurulmalı) ----
const SAHTE = {
  "next/cache": `export const revalidatePath = () => { globalThis.__d5.sayac.tazele += 1; };`,
  "@/lib/auth-guards": `
    export const getAuthContext = async () => globalThis.__d5.oturum ? globalThis.__d5.ctx() : null;
    export const oturumYokMesaji = async () => "OTURUM_YOK";`,
  "@/lib/access": `
    export const isSubscriptionBlocked = async () => globalThis.__d5.abonelikKapali;
    export const abonelikKapaliMesaji = async () => "ABONELIK_KAPALI";`,
  "@/lib/supabase/admin": `export const adminIstemcisiVarsa = () => globalThis.__d5.yonetim();`,
  "@/lib/dil-sunucu": `export const ceviri = async () => (m) => m.tr;`,
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(SAHTE, specifier)) return { url: `sahte:${specifier}`, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("sahte:")) return { format: "module", source: SAHTE[url.slice(6)], shortCircuit: true };
    return nextLoad(url, context);
  },
});

const PROJE = "00000000-0000-4000-8000-0000000000aa";
const KULLANICI = "00000000-0000-4000-8000-0000000000bb";
const MEVCUT = "10.1000/mevcut";
const GIRDI = ["10.1000/y1", MEVCUT, "10.1000/y2", "10.1000/y3"];
const ARANACAK = ["10.1000/y1", "10.1000/y2", "10.1000/y3"];
const CROSSREF = /^https:\/\/api\.crossref\.org\/works\/10\.\d{4,9}\/[^/?#]+$/;

// ---- Durum: her testte sıfırdan kurulur, testler arasında sızmaz ----
const yeniDurum = () => {
  const d = {
    oturum: true,
    abonelikKapali: false,
    sayac: { rpc: 0, fetch: 0, insert: 0, tazele: 0 },
    rpcDavranisi: "hata", // "yok" | "hata" | "bozuk" | "firlat"
    yonetim: () => {
      if (d.rpcDavranisi === "yok") return null;
      return {
        rpc: async (ad) => {
          d.sayac.rpc += 1;
          assert.equal(ad, "rate_limit_take", `beklenmeyen RPC: ${ad}`);
          if (d.rpcDavranisi === "hata") return { data: null, error: { message: "sahte RPC hatası" } };
          if (d.rpcDavranisi === "firlat") throw new Error("sahte ağ hatası");
          return { data: [{ granted: "1", remaining: 0 }], error: null }; // bozuk: tip yanlış
        },
      };
    },
    ctx: () => ({ user: { id: KULLANICI }, supabase: sahteSupabase(d) }),
  };
  return d;
};

// Yalnızca eylemin dokunduğu zincirler; başka bir tablo ya da biçim testi düşürür.
function sahteSupabase(d) {
  return {
    from(tablo) {
      if (tablo === "academic_projects") {
        const zincir = { select: () => zincir, eq: () => zincir, maybeSingle: async () => ({ data: { id: PROJE }, error: null }) };
        return zincir;
      }
      if (tablo === "literature_sources") {
        const sonuc = { data: [{ title: "Mevcut", year: "2020", doi_or_url: MEVCUT }], error: null };
        const zincir = {
          select: () => zincir,
          eq: () => zincir,
          then: (coz, red) => Promise.resolve(sonuc).then(coz, red),
          insert: async () => {
            d.sayac.insert += 1;
            return { error: null };
          },
        };
        return zincir;
      }
      throw new Error(`beklenmeyen tablo: ${tablo}`);
    },
  };
}

let gercekFetch;
let gercekHata;
let gunluk;
beforeEach(() => {
  globalThis.__d5 = yeniDurum();
  gercekFetch = globalThis.fetch;
  globalThis.fetch = async (adres) => {
    const url = String(adres);
    if (!CROSSREF.test(url)) throw new Error(`beklenmeyen adres: ${url}`);
    globalThis.__d5.sayac.fetch += 1;
    return new Response(JSON.stringify({ message: { title: ["Sahte"], DOI: url.split("/works/")[1] } }), { status: 200 });
  };
  gercekHata = console.error;
  gunluk = [];
  console.error = (...a) => gunluk.push(a.join(" "));
});
afterEach(() => {
  globalThis.fetch = gercekFetch;
  console.error = gercekHata;
  delete globalThis.__d5;
});

const { doiIleEkle } = await import("@/app/actions/kaynak-aktarim");
const { YENIDEN_DENENEBILIR } = await import("@/lib/doi-toplu");

const arizaBeklentileri = (sonuc, beklenenRpc) => {
  const s = globalThis.__d5.sayac;
  assert.equal(s.fetch, 0, "Crossref'e istek gitti");
  assert.equal(s.insert, 0, "kaynak kaydı yazıldı");
  assert.equal(s.rpc, beklenenRpc, "RPC sayısı");
  assert.equal(s.tazele, 0, "sayfa tazelendi");
  assert.deepEqual(
    sonuc.sonuclar?.map((x) => [x.doi, x.durum, x.neden]),
    [
      ["10.1000/y1", "ertelendi", "ariza"],
      [MEVCUT, "vardi", undefined],
      ["10.1000/y2", "ertelendi", "ariza"],
      ["10.1000/y3", "ertelendi", "ariza"],
    ],
  );
  assert.equal(sonuc.ozet?.ertelenen, 3);
  assert.equal(sonuc.ozet.ertelenen, sonuc.sonuclar.filter((x) => x.durum === "ertelendi").length);
  assert.deepEqual([sonuc.ozet.sorgulanan, sonuc.ozet.rezerve, sonuc.ozet.kullanilmayan], [0, 0, 0]);
  assert.equal(sonuc.ozet.kalanHak, null);
  assert.equal(sonuc.ozet.yenilenme, null);
  assert.equal(sonuc.ozet.sayacsiz, true);
  assert.deepEqual(sonuc.sonuclar.filter((x) => YENIDEN_DENENEBILIR.has(x.durum)).map((x) => x.doi), ARANACAK);
  assert.ok(sonuc.error, "arıza kullanıcıya bildirilmedi");
  assert.doesNotMatch(sonuc.error, /hakkı doldu|limit reached|düşülmedi|deducted/i);
  assert.ok(gunluk.some((g) => g.startsWith("[kaynak-aktarim]")), "arıza günlüğe yazılmadı");
};

describe("doiIleEkle: sayaç arızasında toplu DOI (fail-closed)", { concurrency: 1 }, () => {
  test("yönetim istemcisi yok", async () => {
    globalThis.__d5.rpcDavranisi = "yok";
    arizaBeklentileri(await doiIleEkle(PROJE, GIRDI), 0);
  });

  test("RPC hata döndürüyor", async () => {
    globalThis.__d5.rpcDavranisi = "hata";
    arizaBeklentileri(await doiIleEkle(PROJE, GIRDI), 1);
  });

  test("RPC fırlatıyor (ağ hatası)", async () => {
    globalThis.__d5.rpcDavranisi = "firlat";
    arizaBeklentileri(await doiIleEkle(PROJE, GIRDI), 1);
  });

  test("RPC cevabı bozuk", async () => {
    globalThis.__d5.rpcDavranisi = "bozuk";
    arizaBeklentileri(await doiIleEkle(PROJE, GIRDI), 1);
  });

  test("aranacak DOI yoksa sayaca hiç gidilmez, arıza da yok", async () => {
    globalThis.__d5.rpcDavranisi = "hata";
    const sonuc = await doiIleEkle(PROJE, [MEVCUT]);
    assert.equal(globalThis.__d5.sayac.rpc, 0);
    assert.equal(globalThis.__d5.sayac.fetch, 0);
    assert.deepEqual(sonuc.sonuclar?.map((x) => [x.doi, x.durum]), [[MEVCUT, "vardi"]]);
    assert.equal(sonuc.ozet?.sayacsiz, false);
    assert.equal(sonuc.error, undefined);
  });
});
