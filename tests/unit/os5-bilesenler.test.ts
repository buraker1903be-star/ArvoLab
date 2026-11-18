import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aciklamaBaglantisi, alanKimlikleri, dugmeSinifi, durumRolu, sayacDurumu, sekmeTusu } from "@/lib/os5/bilesen";
import { vitrinAcikMi } from "@/lib/os5/vitrin";

/*
  Signature OS 5 ortak bileşenlerinin saf kararları (lib/os5/bilesen.ts) ve
  Phase 1'in "mevcut ekranlar değişmez" sözü. Bileşenler React'e bağlı
  olduğu için burada yalnızca kararlar ve kaynak metni sınanıyor.
*/

describe("düğme sınıfı", () => {
  test("varsayılan: birincil, normal boy", () => {
    assert.equal(dugmeSinifi(), "os5-dugme os5-dugme--birincil");
  });
  test("tür, sık boy, tam genişlik ve ek sınıf birlikte", () => {
    assert.equal(dugmeSinifi({ tur: "ikincil", boyut: "sik", tamGenislik: true, ek: "x" }), "os5-dugme os5-dugme--ikincil os5-dugme--sik os5-dugme--tam x");
  });
  test("her tür os5 önekli: mevcut ekranların sınıflarıyla çakışmaz", () => {
    for (const tur of ["birincil", "ikincil", "sessiz", "tehlike"] as const) {
      for (const sinif of dugmeSinifi({ tur }).split(" ")) assert.match(sinif, /^os5-/);
    }
  });
});

describe("alan bağlantıları (aria-describedby)", () => {
  test("hata önce okunur, sonra açıklama", () => {
    assert.equal(aciklamaBaglantisi("e", { aciklama: true, hata: true }), "e-hata e-aciklama");
  });
  test("yalnızca biri varsa yalnızca o", () => {
    assert.equal(aciklamaBaglantisi("e", { aciklama: true }), "e-aciklama");
    assert.equal(aciklamaBaglantisi("e", { hata: true }), "e-hata");
  });
  test("hiçbiri yoksa öznitelik yazılmaz (boş başvuru geçersiz)", () => {
    assert.equal(aciklamaBaglantisi("e", {}), undefined);
  });
  test("kimlikler bileşendeki metinlerle aynı kökten", () => {
    assert.deepEqual(alanKimlikleri("k"), { aciklama: "k-aciklama", hata: "k-hata" });
  });
});

describe("sekme klavyesi", () => {
  test("ok tuşları dolaşır ve uçlarda sarar", () => {
    assert.equal(sekmeTusu("ArrowRight", 2, 3), 0);
    assert.equal(sekmeTusu("ArrowLeft", 0, 3), 2);
    assert.equal(sekmeTusu("ArrowDown", 0, 3), 1);
    assert.equal(sekmeTusu("ArrowUp", 1, 3), 0);
  });
  test("Home/End uçlara gider", () => {
    assert.equal(sekmeTusu("Home", 2, 3), 0);
    assert.equal(sekmeTusu("End", 0, 3), 2);
  });
  test("başka tuş tarayıcıya bırakılır; boş liste güvenli", () => {
    assert.equal(sekmeTusu("Enter", 0, 3), null);
    assert.equal(sekmeTusu("ArrowRight", 0, 0), null);
  });
});

describe("sayaç ve durum rolü", () => {
  test("sınır yoksa sayaç yok; %90'dan sonra 'yakın'", () => {
    assert.equal(sayacDurumu(5), null);
    assert.deepEqual(sayacDurumu(224, 250), { metin: "224 / 250", yakin: false });
    assert.deepEqual(sayacDurumu(225, 250), { metin: "225 / 250", yakin: true });
  });
  test("yükleniyor kibar duyuru, hata kesinti, boş durum duyuru değil", () => {
    assert.deepEqual(durumRolu("yukleniyor"), { role: "status", "aria-live": "polite" });
    assert.deepEqual(durumRolu("hata"), { role: "alert", "aria-live": "assertive" });
    assert.deepEqual(durumRolu("bos"), {});
  });
});

describe("vitrin kapısı", () => {
  test("Production'da kapalı: çalışma anı ya da derleme değeri yeter", () => {
    assert.equal(vitrinAcikMi({ VERCEL_ENV: "production" }), false);
    assert.equal(vitrinAcikMi({ ARVOLAB_DAGITIM_ORTAMI: "production" }), false);
    assert.equal(vitrinAcikMi({ VERCEL_ENV: "preview", ARVOLAB_DAGITIM_ORTAMI: "production" }), false);
    assert.equal(vitrinAcikMi({ VERCEL_ENV: " Production " }), false);
  });
  test("Preview ve yerelde açık", () => {
    assert.equal(vitrinAcikMi({ VERCEL_ENV: "preview" }), true);
    assert.equal(vitrinAcikMi({}), true);
  });
  test("kapı yerleşimde (gerçek 404) ve her istekte karar veriliyor", () => {
    const yerlesim = readFileSync("app/tasarim/layout.tsx", "utf8");
    assert.match(yerlesim, /if \(!acik\(\)\) notFound\(\)/);
    assert.match(yerlesim, /export const dynamic = "force-dynamic"/);
    assert.match(yerlesim, /index: false/);
    // Başlık yalnızca açıkken: kapalıyken <title> 404 yanıtına sızmasın.
    assert.match(yerlesim, /acik\(\) \? \{ title:[^}]*\} : \{ robots \}/);
  });
  test("kapının ikizi sayfada: yerleşim ve sayfa paralel çizilir, içerik 404'e sızmasın", () => {
    const sayfa = readFileSync("app/tasarim/page.tsx", "utf8");
    assert.match(sayfa, /if \(!vitrinAcikMi\([\s\S]*?\)\) notFound\(\);\s*const t = await ceviri\(\)/);
    assert.doesNotMatch(readFileSync("app/tasarim/page.tsx", "utf8") + readFileSync("app/tasarim/vitrin-ornekleri.tsx", "utf8"), /supabase|createClient|actions\//i);
  });
});

/* Seçici listesini yalnızca en üst düzeydeki virgülden böler: ":not(a, b)" tek parçadır. */
function ustDuzeyBol(secici: string): string[] {
  const parcalar: string[] = [];
  let derinlik = 0;
  let bas = 0;
  for (let i = 0; i < secici.length; i++) {
    const c = secici[i];
    if (c === "(") derinlik++;
    else if (c === ")") derinlik--;
    else if (c === "," && derinlik === 0) {
      parcalar.push(secici.slice(bas, i));
      bas = i + 1;
    }
  }
  parcalar.push(secici.slice(bas));
  return parcalar;
}

describe("Phase 1 mevcut ekranları değiştirmez", () => {
  const css = readFileSync("app/styles/os5-bilesenler.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  test("her kuralın seçicisi os5 sınıfına ya da yeni logo sınıfına bağlı", () => {
    const seciciler = [...css.matchAll(/(^|})\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter((s) => s && !/^(to|from|\d+%)$/.test(s));
    assert.ok(seciciler.length > 20);
    for (const s of seciciler) {
      for (const parca of ustDuzeyBol(s)) assert.match(parca, /\.os5-|\.arvolab-logo/, `os5'e bağlı olmayan seçici: ${parca.trim()}`);
    }
  });
  test("Dialog ve Secici: prop verilmezse eski sınıflar", () => {
    const dialog = readFileSync("app/dashboard/_components/dialog.tsx", "utf8");
    assert.match(dialog, /gorunum === "os5" \? "drawer drawer-compact os5-pencere" : "drawer drawer-compact"/);
    const secici = readFileSync("app/dashboard/_components/secici.tsx", "utf8");
    assert.match(secici, /gorunum === "os5" \? "secici os5-secici" : "secici"/);
  });
  test("şifre bileşeni kural içermez (kural çağıranda ve sunucuda)", () => {
    const kaynak = readFileSync("app/_components/ui/sifre-girdisi.tsx", "utf8");
    assert.doesNotMatch(kaynak, /minLength|maxLength|pattern=|yaygin-sifre|SIFRE_EN/);
  });
});
