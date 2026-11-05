#!/usr/bin/env node
/*
  SUPABASE HEDEF DENETİMİ (Güvenli Test Ortamı, Aşama 1).

  Migration, şema kurulumu ve sentetik veri betiklerinden ÖNCE çalışır;
  hedef proje izinli değilse 1 ile çıkar ve hiçbir şey yapılmaz. Karar
  lib/supabase/ortam-guvenligi.ts (betikHedefKarari) — uygulamayla aynı modül.

  Hedef kimliği şu sırayla okunur:
    --ref <kimlik>                      (açıkça verilen)
    SUPABASE_DB_URL                     (postgres bağlantı adresi)
    supabase/.temp/project-ref          (`supabase link` ile bağlanan proje)

  Kullanım:
    node scripts/supabase-hedef.mjs --tur migration            # yalnızca test
    node scripts/supabase-hedef.mjs --tur migration --uretim   # + ARVOLAB_URETIM_ONAYI="ÜRETİME UYGULA <üretim kimliği>"
    node scripts/supabase-hedef.mjs --tur sema-kurulumu | sentetik-veri   # üretimde HİÇBİR koşulda

  Gerekli ortam değişkenleri: ARVOLAB_URETIM_SUPABASE_REF, ARVOLAB_TEST_SUPABASE_REF.
  Hiçbir anahtar ya da parola okunmaz ve yazdırılmaz.
*/
import { existsSync, readFileSync } from "node:fs";
import { betikHedefKarari, veritabaniAdresiProjesi } from "../lib/supabase/ortam-guvenligi.ts";

export function hedefRefOku(argv = process.argv.slice(2), env = process.env) {
  const i = argv.indexOf("--ref");
  if (i >= 0 && argv[i + 1]) return { ref: argv[i + 1], kaynak: "--ref" };
  if (env.SUPABASE_DB_URL) return { ref: veritabaniAdresiProjesi(env.SUPABASE_DB_URL), kaynak: "SUPABASE_DB_URL" };
  if (existsSync("supabase/.temp/project-ref")) return { ref: readFileSync("supabase/.temp/project-ref", "utf8").trim(), kaynak: "supabase link" };
  return { ref: null, kaynak: "yok" };
}

export function hedefDenetimi(argv = process.argv.slice(2), env = process.env) {
  const turIndeks = argv.indexOf("--tur");
  const tur = turIndeks >= 0 ? argv[turIndeks + 1] : "migration";
  if (!["migration", "sema-kurulumu", "sentetik-veri"].includes(tur)) return { tur: "red", mesaj: `Bilinmeyen --tur: ${tur}` };
  const { ref, kaynak } = hedefRefOku(argv, env);
  const karar = betikHedefKarari({
    tur,
    hedefRef: ref,
    uretimRef: env.ARVOLAB_URETIM_SUPABASE_REF,
    testRef: env.ARVOLAB_TEST_SUPABASE_REF,
    uretimIstendi: argv.includes("--uretim"),
    onayMetni: env.ARVOLAB_URETIM_ONAYI,
  });
  return { ...karar, ref, kaynak, betik: tur };
}

const dogrudanCalisti = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (dogrudanCalisti) {
  const s = hedefDenetimi();
  if (s.tur === "izin") {
    console.log(`✓ Hedef ${s.hedef === "uretim" ? "ÜRETİM" : "test"} projesi (${s.ref}, kaynak: ${s.kaynak}); ${s.betik} izinli.`);
    process.exit(0);
  }
  console.error(`✗ ${s.betik ?? "betik"} durduruldu: ${s.mesaj}${s.ref ? ` (hedef: ${s.ref}, kaynak: ${s.kaynak})` : ""}`);
  process.exit(1);
}
