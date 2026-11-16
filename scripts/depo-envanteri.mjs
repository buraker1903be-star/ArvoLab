// DEPO ENVANTERİ (P52b-2A) — SALT OKUNUR.
//
// Depodaki nesneleri veritabanındaki dosya referanslarıyla karşılaştırır ve
// YALNIZCA SAYI basar: toplam dosya, aday yetim, aday kayıp, doğrulanamayan,
// bayt. Hiçbir dosyayı silmez, hiçbir satırı değiştirmez. Bunu kod sağlıyor:
// istemcinin fetch'i GET/HEAD ve Storage listeleme dışındaki her isteği ağa
// çıkmadan reddeder (lib/depo-envanteri.ts → saltOkunurMu).
//
// YALNIZCA YEREL YIĞIN: adres 127.0.0.1/localhost değilse çalışmaz. Production
// ya da Test'te koşturmak ayrı bir onay ve bu korumanın bilinçli değiştirilmesi
// demek (P52b-2A kuralı: service-role ile Production/Test'e bağlanılmaz).
//
//   SUPABASE_URL=http://127.0.0.1:54401 SUPABASE_SERVICE_ROLE_KEY=<yerel> \
//     node --import ./tests/register.mjs scripts/depo-envanteri.mjs [--yas-esigi-saat 24] \
//       [--ikinci-gecis-sn 60] [--istek-araligi-ms 100] [--sayfa 1000] [--ayrinti <dosya>]
//
// Çıktıda dosya yolu, kimlik ya da kişisel veri YOK. --ayrinti verilirse her
// karar için yolun SHA-256 özeti (16 hane), kategori ve sınıf yazılır; yol yine yok.
import fs from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { metindekiGorselYollari, saltOkunurMu, yerelAdresMi } from "../lib/depo-envanteri.ts";
import { depoEnvanteri, VARSAYILAN_AYAR } from "../lib/depo-envanteri-tarama.ts";

const require = createRequire(import.meta.url);
const KOVA = "project-files";
const SAYFA_DB = 1000;

/** Okuma dışındaki her isteği ağa çıkmadan reddeden fetch. */
export function saltOkunurFetch(icFetch = fetch) {
  return async (url, secenek = {}) => {
    const yontem = (secenek.method ?? (url instanceof Request ? url.method : "GET")).toUpperCase();
    const adres = typeof url === "string" ? url : url.url ?? String(url);
    if (!saltOkunurMu(adres, yontem)) throw new Error(`depo envanteri salt okunur: ${yontem} isteği reddedildi`);
    return icFetch(url, secenek);
  };
}

/* Dosya referansı taşıyan alanlar. Yeni bir dosyalı özellik eklenince buraya satır eklenir. */
const REFERANS_ALANLARI = [
  { tablo: "kaynak_pdfleri", sutun: "depo_yolu", sira: "id" },
  { tablo: "document_uploads", sutun: "storage_path", sira: "id" },
  { tablo: "calisma_kilavuzu", sutun: "depo_yolu", sira: "project_id" },
  { tablo: "uak_tablolari", sutun: "depo_yolu", sira: "id" },
  { tablo: "academic_score_entries", sutun: "belge_yolu", sira: "id" },
];
/* Metindeki görseller: hem güncel metin hem sürümler (sürüm geri yüklenince görsel yeniden kullanılır). */
const METIN_ALANLARI = [
  { tablo: "project_manuscripts", sira: "id" },
  { tablo: "project_manuscript_versions", sira: "id" },
];

export function okuyucular(sb, koken) {
  let gorselOnbellek = null; // ikinci geçişte metinler bir kez yeniden okunur

  async function hepsiniOku(tablo, sutunlar, sira, suzgec) {
    const satirlar = [];
    for (let bas = 0; ; bas += SAYFA_DB) {
      let q = sb.from(tablo).select(sutunlar).order(sira, { ascending: true }).range(bas, bas + SAYFA_DB - 1);
      if (suzgec) q = suzgec(q);
      const { data, error } = await q;
      if (error) return null;
      satirlar.push(...data);
      if (data.length < SAYFA_DB) return satirlar;
    }
  }

  async function gorselYollari() {
    const yollar = new Set();
    for (const m of METIN_ALANLARI) {
      const satirlar = await hepsiniOku(m.tablo, "id, content", m.sira);
      if (satirlar === null) return null;
      for (const s of satirlar) for (const y of metindekiGorselYollari(s.content, koken)) yollar.add(y);
    }
    return yollar;
  }

  return {
    depo: {
      async listele(klasor, offset, limit, ara) {
        try {
          const { data, error } = await sb.storage.from(KOVA).list(klasor, { limit, offset, search: ara, sortBy: { column: "name", order: "asc" } });
          if (error) {
            const durum = Number(error.status ?? error.statusCode ?? 0);
            return { ok: false, tekrarDenenebilir: !durum || durum === 429 || durum >= 500 };
          }
          return {
            ok: true,
            girdiler: (data ?? []).map((g) => ({
              ad: g.name,
              klasorMu: g.id === null,
              boyut: typeof g.metadata?.size === "number" ? g.metadata.size : null,
              olusturma: g.created_at ?? null,
            })),
          };
        } catch {
          return { ok: false, tekrarDenenebilir: true };
        }
      },
    },
    veri: {
      async calismalar(idler) {
        const { data, error } = await sb.from("academic_projects").select("id").in("id", idler);
        return error ? null : new Set(data.map((d) => d.id));
      },
      async profiller(idler) {
        const { data, error } = await sb.from("profiles").select("id").in("id", idler);
        return error ? null : new Set(data.map((d) => d.id));
      },
      async referanslar() {
        const sonuc = [];
        for (const a of REFERANS_ALANLARI) {
          const satirlar = await hepsiniOku(a.tablo, `${a.sira}, ${a.sutun}`, a.sira, (q) => q.not(a.sutun, "is", null));
          if (satirlar === null) return null;
          for (const s of satirlar) sonuc.push({ yol: s[a.sutun], kaynak: `${a.tablo}.${a.sutun}` });
        }
        const gorseller = await gorselYollari();
        if (gorseller === null) return null;
        for (const y of gorseller) sonuc.push({ yol: y, kaynak: "metin.gorsel" });
        gorselOnbellek = null;
        return sonuc;
      },
      async yolReferansli(yol) {
        for (const a of REFERANS_ALANLARI) {
          const { data, error } = await sb.from(a.tablo).select(a.sira).eq(a.sutun, yol).limit(1);
          if (error) return null;
          if (data.length) return true;
        }
        if (!yol.includes("/editor-images/")) return false;
        gorselOnbellek ??= await gorselYollari();
        return gorselOnbellek === null ? null : gorselOnbellek.has(yol);
      },
    },
  };
}

export async function calistir({ url, anahtar, ayar = {}, icFetch = fetch }) {
  if (!yerelAdresMi(url)) throw new Error("Depo envanteri yalnızca yerel yığında çalışır (127.0.0.1/localhost).");
  const { createClient } = require("@supabase/supabase-js");
  const sb = createClient(url, anahtar, {
    global: { fetch: saltOkunurFetch(icFetch) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { depo, veri } = okuyucular(sb, url);
  return depoEnvanteri(depo, veri, {
    ...VARSAYILAN_AYAR,
    simdi: () => Date.now(),
    uyu: (ms) => new Promise((c) => setTimeout(c, ms)),
    ...ayar,
  });
}

function arguman(ad, varsayilan) {
  const i = process.argv.indexOf(`--${ad}`);
  return i > 0 ? process.argv[i + 1] : varsayilan;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anahtar) {
    console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (yalnızca yerel yığın).");
    process.exit(2);
  }
  try {
    const { rapor, ayrinti, yarim } = await calistir({
      url,
      anahtar,
      ayar: {
        yasEsigiMs: Number(arguman("yas-esigi-saat", 24)) * 3600_000,
        ikinciGecisBeklemesiMs: Number(arguman("ikinci-gecis-sn", 60)) * 1000,
        istekAraligiMs: Number(arguman("istek-araligi-ms", 100)),
        sayfa: Number(arguman("sayfa", 1000)),
      },
    });
    const ayrintiDosyasi = arguman("ayrinti");
    if (ayrintiDosyasi) fs.writeFileSync(ayrintiDosyasi, JSON.stringify(ayrinti, null, 2));
    console.log(JSON.stringify({ yarim, ...rapor }, null, 2));
    // Okuyan kişi JSON'un ortasındaki bir alanı kaçırmasın: kesin değilse ayrıca söyle.
    if (!rapor.kesin) console.error(`UYARI: rapor KESİN DEĞİL (${rapor.kesin_degil_cunku.join(", ")}). Sayılar "en az" anlamındadır.`);
    console.error("Bu bir aday raporudur; hiçbir silme kararı bu rapora dayanamaz.");
  } catch (hata) {
    // Hata metni de yol taşımasın: yalnızca türü.
    console.error("Depo envanteri durdu:", hata instanceof Error ? hata.message.slice(0, 200) : "bilinmeyen hata");
    process.exit(1);
  }
}
