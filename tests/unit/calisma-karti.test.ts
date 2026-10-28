import assert from "node:assert/strict";
import test from "node:test";
import { calismaAdresi, eksikSatirlari, filtrelerGorunsun, kartIlerlemesi, secimAdresi, seciliCalismaId, yeniCalismaAdresi } from "@/lib/calisma-karti";

test("filtreler personelde hep, öğrencide yalnızca uzun listede", () => {
  assert.equal(filtrelerGorunsun(1, false), false);
  assert.equal(filtrelerGorunsun(3, false), false);
  assert.equal(filtrelerGorunsun(4, false), true);
  assert.equal(filtrelerGorunsun(1, true), true);
});

test("hedef varsa yüzde gerçek yazımdan; elle girilen değer ezilir", () => {
  const i = kartIlerlemesi({ kelime: 9710, hedefKelime: 18400, elleIlerleme: 100 });
  assert.deepEqual([i?.yuzde, i?.etiket], [53, "yazıldı"]);
  assert.equal(kartIlerlemesi({ kelime: 30000, hedefKelime: 18400, elleIlerleme: null })?.yuzde, 100);
});

test("hedef yoksa yalnızca girilmiş elle değer, o da 'ilerleme' adıyla", () => {
  assert.deepEqual(kartIlerlemesi({ kelime: 500, hedefKelime: null, elleIlerleme: 40 })?.etiket, "ilerleme");
  assert.equal(kartIlerlemesi({ kelime: 500, hedefKelime: null, elleIlerleme: 0 }), null);
  assert.equal(kartIlerlemesi({ kelime: null, hedefKelime: null, elleIlerleme: null }), null);
});

test("seçim: adresteki geçerliyse o, değilse en son düzenlenen, o da yoksa ilki", () => {
  const zaman: Record<string, string> = { a: "2026-10-20T10:00:00Z", b: "2026-10-25T10:00:00Z" };
  const son = (id: string) => zaman[id];
  assert.equal(seciliCalismaId(["a", "b", "c"], "c", son), "c");
  // Silinmiş ya da filtrenin dışında kalmış çalışma: sağ kart boş kalmasın.
  assert.equal(seciliCalismaId(["a", "b", "c"], "yok", son), "b");
  assert.equal(seciliCalismaId(["x", "y"], null, () => undefined), "x");
  assert.equal(seciliCalismaId([], "a", son), null);
});

test("varsayılan seçimde aktif çalışma önce; açıkça istenen bitmiş çalışma yine açılır", () => {
  const zaman: Record<string, string> = { eski: "2026-10-27T10:00:00Z", yeni: "2026-10-20T10:00:00Z" };
  const aktif = (id: string) => id !== "eski";
  assert.equal(seciliCalismaId(["eski", "yeni"], null, (id) => zaman[id], aktif), "yeni");
  assert.equal(seciliCalismaId(["eski", "yeni"], "eski", (id) => zaman[id], aktif), "eski");
  assert.equal(seciliCalismaId(["eski"], null, (id) => zaman[id], aktif), "eski", "aktif yoksa bitmiş olan");
  assert.equal(secimAdresi({ sec: "a", takvim: "1" }, "b"), "/dashboard/editor?sec=b");
  assert.equal(calismaAdresi("x", { takvim: true }), "/dashboard/editor?sec=x&takvim=1");
});

test("seçim adresi filtreleri korur, eski seçimi değiştirir", () => {
  assert.equal(secimAdresi({ q: "tez", durum: "aktif", sec: "eski" }, "yeni"), "/dashboard/editor?q=tez&durum=aktif&sec=yeni");
  assert.equal(secimAdresi({}, "a"), "/dashboard/editor?sec=a");
  // Yeni çalışmanın kılavuz penceresi başka satıra taşınmaz.
  assert.equal(secimAdresi({ sec: "a", kilavuz: "1" }, "b"), "/dashboard/editor?sec=b");
});

test("eksikler ağırlık sırasıyla; 'şimdi' satırındaki iş tekrar edilmez", () => {
  const maddeler = [
    { id: "bakim", label: "Bakılacak", detail: "", status: "warning" },
    { id: "ok", label: "Tamam", detail: "", status: "ok" },
    { id: "bolum", label: "Bölüm eksik", detail: "", status: "todo" },
    { id: "kapak", label: "Kapak eksik", detail: "", status: "todo" },
  ];
  const adimlar = [
    { anahtar: "literatur", baslik: "Literatür topla", aciklama: "", href: "/l", tamam: true },
    { anahtar: "kaynakca", baslik: "Kaynakçayı denetle", aciklama: "", href: "/k", tamam: false },
    { anahtar: "belge", baslik: "Belgeyi kontrol ettir", aciklama: "", href: "/b", tamam: false },
  ];
  const liste = eksikSatirlari({
    calismaId: "c1",
    stilUyarisi: "APA ayarlı, kılavuz IEEE istiyor",
    maddeler,
    tutarsizliklar: [{ tur: "atifsiz_kaynak", baslik: "2 kaynak metinde yok", aciklama: "" }],
    asistanBulgulari: [{ baslik: "Örneklem gerekçesi yok", aciklama: "" }],
    adimlar,
    sirada: { kaynakMadde: "bolum", href: "/x", bitti: false },
  });
  assert.deepEqual(
    liste.map((s) => `${s.tur}:${s.baslik}`),
    [
      "stil:Atıf stili kılavuzla çelişiyor",
      "eksik:Kapak eksik",
      "tutarsizlik:2 kaynak metinde yok",
      "bakilacak:Bakılacak",
      "asistan:Örneklem gerekçesi yok",
      "yapilmadi:Kaynakçayı denetle",
      "yapilmadi:Belgeyi kontrol ettir",
    ],
  );
  assert.equal(liste[1].href, "/dashboard/editor/c1/write?teslim=kapak");
  assert.equal(liste[2].href, "/dashboard/literature?calisma=c1");

  // "Şimdi" bir birimden geldiyse o birim listeden çıkar.
  const birimden = eksikSatirlari({ calismaId: "c1", stilUyarisi: null, maddeler: [], tutarsizliklar: [], adimlar, sirada: { href: "/k", bitti: false } });
  assert.deepEqual(birimden.map((s) => s.baslik), ["Belgeyi kontrol ettir"]);
});

test("yeni çalışmanın ilk adımı: kılavuzsuz tez kılavuz penceresine, makale dergi bilgilerine", () => {
  assert.equal(yeniCalismaAdresi({ id: "t", tur: "thesis", kilavuzVar: false }), "/dashboard/editor/t?kilavuz=1");
  assert.equal(yeniCalismaAdresi({ id: "t", tur: "thesis", kilavuzVar: true }), "/dashboard/editor/t/write");
  assert.equal(yeniCalismaAdresi({ id: "m", tur: "article", kilavuzVar: false }), "/dashboard/editor/m/makale?dergi=1");
  assert.equal(yeniCalismaAdresi({ id: "p", tur: "project", kilavuzVar: false }), "/dashboard/editor/p/write");
});

test("öğrencinin çalışma adresi Çalışmalarım, çalışma seçili", () => {
  assert.equal(calismaAdresi("a"), "/dashboard/editor?sec=a");
  assert.equal(calismaAdresi("a", { kilavuz: true }), "/dashboard/editor?sec=a&kilavuz=1");
});

test("İngilizce kart ilerlemesi ve stil başlığı", () => {
  const i = kartIlerlemesi({ kelime: 5000, hedefKelime: 20000, elleIlerleme: null, dil: "en" });
  assert.deepEqual(i, { yuzde: 25, etiket: "written", ipucu: "25% of the ~20,000-word target based on the guideline's page limit" });
  const satirlar = eksikSatirlari({ calismaId: "c1", stilUyarisi: "x", maddeler: [], tutarsizliklar: [], adimlar: [], dil: "en" });
  assert.equal(satirlar[0].baslik, "Citation style conflicts with the guideline");
});
