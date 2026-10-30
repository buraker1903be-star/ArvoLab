/*
  KULLANIM KILAVUZU (lib/yardim/kullanim-kilavuzu.ts).

  Kılavuzun bozulma biçimleri sessizdir: bir düğmenin adı değişir,
  kılavuz eski adı söylemeye devam eder; bir sayfa taşınır, kılavuzun
  bağlantısı 404'e gider; İngilizce metin eksik kalır, yabancı kullanıcı
  boş bir madde görür. Hiçbiri derlemede ya da tip denetiminde görünmez.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { kilavuzBolumleri, kilavuzSorulari, KILAVUZ_ADRESI, TUM_BOLUMLER } from "@/lib/yardim/kullanim-kilavuzu";
import type { Metin } from "@/lib/dil";

const KOK = process.cwd();

function metinleri(b: (typeof TUM_BOLUMLER)[number]): Metin[] {
  return [b.baslik, b.ozet, ...(b.adimlar ?? []), ...(b.notlar ?? []), ...(b.baglanti ? [b.baglanti.etiket] : [])];
}

/** "/dashboard/x?y=1" → app/dashboard/x/page.tsx var mı. */
function sayfaVarMi(href: string): boolean {
  const yol = href.split(/[?#]/)[0].replace(/^\//, "");
  return fs.existsSync(path.join(KOK, "app", yol, "page.tsx"));
}

describe("içerik eksiksiz", () => {
  test("her metin iki dilde de dolu", () => {
    for (const b of TUM_BOLUMLER) {
      for (const m of metinleri(b)) {
        assert.ok(m.tr.trim() && m.en.trim(), `${b.id}: ${m.tr || m.en}`);
      }
    }
    for (const s of kilavuzSorulari()) assert.ok(s.soru.en.trim() && s.cevap.en.trim() && s.soru.tr.trim() && s.cevap.tr.trim());
  });

  test("bölüm kimlikleri benzersiz ve çapaya uygun", () => {
    const kimlikler = TUM_BOLUMLER.map((b) => b.id);
    assert.equal(new Set(kimlikler).size, kimlikler.length);
    for (const k of kimlikler) assert.match(k, /^[a-z][a-z0-9-]*$/);
    assert.ok(!kimlikler.includes("sss"), "sss sık sorulanların çapası");
  });

  test("bağlantılar gerçek sayfalara gidiyor", () => {
    assert.ok(sayfaVarMi(KILAVUZ_ADRESI), KILAVUZ_ADRESI);
    for (const rol of [null, "employee", "controller", "founder"]) {
      for (const b of kilavuzBolumleri(rol)) {
        if (b.baglanti) assert.ok(sayfaVarMi(b.baglanti.href), `${b.id}: ${b.baglanti.href}`);
      }
    }
  });
});

/*
  Kılavuz düğmeleri ekrandaki adlarıyla anar ("Okudum ve onaylıyorum").
  Tırnak içindeki her ad uygulama kodunda geçmeli; geçmiyorsa ya düğmenin
  adı değişti ya kılavuz yanlış yazdı. Büyük/küçük harf bakılmıyor:
  cümle içinde ad küçük harfle başlayabiliyor.
*/
test("kılavuzdaki tırnaklı düğme adları kodda geçiyor", () => {
  const dosyalar: string[] = [];
  const tara = (dizin: string) => {
    for (const ad of fs.readdirSync(dizin, { withFileTypes: true })) {
      const tam = path.join(dizin, ad.name);
      if (ad.isDirectory()) tara(tam);
      else if (/\.(ts|tsx)$/.test(ad.name) && !tam.includes(`${path.sep}yardim${path.sep}`)) dosyalar.push(tam);
    }
  };
  tara(path.join(KOK, "app"));
  tara(path.join(KOK, "lib"));
  const kaynak = dosyalar.map((d) => fs.readFileSync(d, "utf8")).join("\n").toLocaleLowerCase("tr");

  const eksik: string[] = [];
  for (const b of TUM_BOLUMLER) {
    for (const m of metinleri(b)) {
      for (const dil of ["tr", "en"] as const) {
        for (const [, ad] of m[dil].matchAll(/"([^"]+)"/g)) {
          if (!kaynak.includes(ad.toLocaleLowerCase("tr"))) eksik.push(`${b.id} (${dil}): "${ad}"`);
        }
      }
    }
  }
  assert.deepEqual(eksik, []);
});

describe("role göre bölümler", () => {
  const kimlikler = (rol: string | null) => kilavuzBolumleri(rol).map((b) => b.id);

  test("öğrenci personel ve iç ekip bölümlerini görmüyor", () => {
    for (const rol of [null, "student"]) {
      assert.ok(!kimlikler(rol).includes("personel"), String(rol));
      assert.ok(!kimlikler(rol).includes("yonetim"), String(rol));
    }
  });

  test("personel kendi bölümünü görüyor, iç ekibinkini görmüyor", () => {
    for (const rol of ["employee", "expert", "controller", "academic_manager"]) {
      assert.ok(kimlikler(rol).includes("personel"), rol);
      assert.ok(!kimlikler(rol).includes("yonetim"), rol);
    }
  });

  test("iç ekip hepsini görüyor", () => {
    for (const rol of ["system_admin", "founder"]) {
      assert.ok(kimlikler(rol).includes("personel") && kimlikler(rol).includes("yonetim"), rol);
    }
  });

  /* editor/page.tsx: gözetim rolleri pencereyi değil ayrı sayfayı kullanıyor. */
  test("yeni çalışma bağlantısı role göre doğru yere", () => {
    const adres = (rol: string | null) => kilavuzBolumleri(rol).find((b) => b.id === "ilk-calisma")?.baglanti?.href;
    assert.equal(adres(null), "/dashboard/editor?yeni=1");
    assert.equal(adres("employee"), "/dashboard/editor?yeni=1");
    assert.equal(adres("controller"), "/dashboard/editor/new");
    assert.equal(adres("founder"), "/dashboard/editor/new");
  });
});
