import assert from "node:assert/strict";
import test from "node:test";
import { eksikSatirlari, filtrelerGorunsun, kartIlerlemesi, secimAdresi, seciliCalismaId } from "@/lib/calisma-karti";

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

test("seçim adresi filtreleri korur, eski seçimi değiştirir", () => {
  assert.equal(secimAdresi({ q: "tez", durum: "aktif", sec: "eski" }, "yeni"), "/dashboard/editor?q=tez&durum=aktif&sec=yeni");
  assert.equal(secimAdresi({}, "a"), "/dashboard/editor?sec=a");
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
      "yapilmadi:Kaynakçayı denetle",
      "yapilmadi:Belgeyi kontrol ettir",
    ],
  );
  assert.equal(liste[1].href, "/dashboard/editor/c1/write?teslim=kapak");

  // "Şimdi" bir birimden geldiyse o birim listeden çıkar.
  const birimden = eksikSatirlari({ calismaId: "c1", stilUyarisi: null, maddeler: [], tutarsizliklar: [], adimlar, sirada: { href: "/k", bitti: false } });
  assert.deepEqual(birimden.map((s) => s.baslik), ["Belgeyi kontrol ettir"]);
});
