import assert from "node:assert/strict";
import test from "node:test";
import {
  kayibiDogrula,
  metindekiGorselYollari,
  nesneyiSiniflandir,
  referansiSiniflandir,
  saltOkunurMu,
  yerelAdresMi,
  yetimiDogrula,
  yolCoz,
  type Baglam,
} from "@/lib/depo-envanteri";
import { depoEnvanteri, VARSAYILAN_AYAR, type DepoGirdisi, type DepoOkuyucu, type ListeSonucu, type TaramaAyari, type VeriOkuyucu } from "@/lib/depo-envanteri-tarama";

/*
  P52b-2A: salt okunur depo envanteri. Asıl korunan şey YANLIŞ POZİTİF
  YETİM'in olmaması: belirsiz her durum DOGRULANAMADI, taze nesne aday
  olamaz, ikinci geçişte bağlanan nesne düşer. Gerçek Storage + Postgres
  kabulü: denetim/p52b2/kabul.mjs.
*/

const P = "3b281459-8ae2-4a9a-b31f-4530474fea2e"; // var olan çalışma
const P_SILINMIS = "9c1e0d4a-1111-4222-8333-444455556666";
const U = "b4219800-20a2-492d-ac4c-8fbd295efd70"; // var olan kullanıcı
const U_SILINMIS = "0f0e0d0c-0b0a-4908-8706-050403020100";
const GUN = 24 * 60 * 60 * 1000;
const SIMDI = Date.parse("2026-11-16T12:00:00Z");
const ESKI = new Date(SIMDI - 3 * GUN).toISOString();
const TAZE = new Date(SIMDI - 60_000).toISOString();

test("yolCoz: kategoriler ve sahip klasörü; bozuk yol bilinmeyen", () => {
  assert.deepEqual(yolCoz(`${P}/kaynak-pdf/a.pdf`), { gecerli: true, kategori: "kaynak-pdf", sahipId: P, sahip: "calisma" });
  assert.equal(yolCoz(`${P}/editor-images/x.png`).kategori, "editor-images");
  assert.equal(yolCoz(`${U}/imports/1-a.docx`).kategori, "imports");
  assert.equal(yolCoz(`${U}/1763-belge.pdf`).kategori, "belge");
  for (const k of ["kilavuz", "uak", "docentlik", "etik", "exports"]) assert.equal(yolCoz(`${U}/${k}/a.pdf`).kategori, k);
  for (const bozuk of ["", `${P}`, `${P}/../x`, `${P}//a`, `${P}/x/y/z.pdf`, `${P}/bilinmez/a`, `${P.toUpperCase()}/kaynak-pdf/a.pdf`, "kok/a.pdf", `${P}\\a`]) {
    assert.equal(yolCoz(bozuk).gecerli, false, bozuk);
  }
});

const baglam = (ek: Partial<Baglam> = {}): Baglam => ({
  sahip: (id) => (id === P || id === U ? "var" : "yok"),
  referansli: () => false,
  simdi: SIMDI,
  yasEsigiMs: GUN,
  ...ek,
});

test("sınıflandırma: sahip yoksa (eski) aday yetim; taze/yaşı bilinmeyen asla aday değil", () => {
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P_SILINMIS}/kaynak-pdf/a.pdf`, boyut: 1, olusturma: ESKI }, baglam()), { sinif: "ADAY_YETIM", sebep: "sahip_yok" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P_SILINMIS}/kaynak-pdf/a.pdf`, boyut: 1, olusturma: TAZE }, baglam()), { sinif: "DOGRULANAMADI", sebep: "taze" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${U_SILINMIS}/etik/a.pdf`, boyut: 1, olusturma: null }, baglam()), { sinif: "DOGRULANAMADI", sebep: "yas_bilinmiyor" });
});

test("sınıflandırma: referanslı her şey sahipli; referanssız eski kaynak PDF/belge aday; editör görseli kütüphane", () => {
  const ref = baglam({ referansli: (y) => y.endsWith("ref.pdf") });
  assert.equal(nesneyiSiniflandir({ yol: `${P}/kaynak-pdf/ref.pdf`, boyut: 1, olusturma: ESKI }, ref).sinif, "SAHIPLI");
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P}/kaynak-pdf/yok.pdf`, boyut: 1, olusturma: ESKI }, ref), { sinif: "ADAY_YETIM", sebep: "referanssiz" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${U}/1-a.pdf`, boyut: 1, olusturma: ESKI }, ref), { sinif: "ADAY_YETIM", sebep: "referanssiz" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P}/editor-images/x.png`, boyut: 1, olusturma: ESKI }, ref), { sinif: "SAHIPLI", sebep: "kutuphane" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${U}/imports/1-a.docx`, boyut: 1, olusturma: ESKI }, ref), { sinif: "ADAY_YETIM", sebep: "gecici_eski" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${U}/imports/1-a.docx`, boyut: 1, olusturma: TAZE }, ref), { sinif: "DOGRULANAMADI", sebep: "taze" });
});

test("sınıflandırma: başka kullanıcının sahipli dosyaları (kılavuz, ÜAK, doçentlik, etik, dışa aktarma) ASLA aday değil", () => {
  for (const k of ["kilavuz", "uak", "docentlik", "etik", "exports"]) {
    assert.deepEqual(nesneyiSiniflandir({ yol: `${U}/${k}/a.pdf`, boyut: 1, olusturma: ESKI }, baglam()), { sinif: "DOGRULANAMADI", sebep: "kapsam_disi" }, k);
  }
});

test("sınıflandırma: referanslar ya da sahip okunamazsa DOGRULANAMADI (sahibi gitmiş olsa bile)", () => {
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P_SILINMIS}/kaynak-pdf/a.pdf`, boyut: 1, olusturma: ESKI }, baglam({ referansli: () => null })), { sinif: "DOGRULANAMADI", sebep: "referans_okunamadi" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P}/kaynak-pdf/a.pdf`, boyut: 1, olusturma: ESKI }, baglam({ sahip: () => "bilinmiyor" })), { sinif: "DOGRULANAMADI", sebep: "sahip_okunamadi" });
  assert.deepEqual(nesneyiSiniflandir({ yol: `${P}/x/y/z`, boyut: 1, olusturma: ESKI }, baglam()), { sinif: "DOGRULANAMADI", sebep: "bilinmeyen_kalip" });
});

test("ikinci doğrulama: arada bağlanan, sahibi geri gelen, silinen nesne aday kalmaz; okunamayan DOGRULANAMADI", () => {
  const aday = { sinif: "ADAY_YETIM" as const, sebep: "sahip_yok" };
  assert.equal(yetimiDogrula(aday, { depoda: "var", referansli: true, sahip: "yok" })?.sinif, "SAHIPLI");
  assert.equal(yetimiDogrula(aday, { depoda: "var", referansli: false, sahip: "var" })?.sinif, "SAHIPLI");
  assert.equal(yetimiDogrula(aday, { depoda: "yok", referansli: false, sahip: "yok" }), null);
  assert.equal(yetimiDogrula(aday, { depoda: "bilinmiyor", referansli: false, sahip: "yok" })?.sinif, "DOGRULANAMADI");
  assert.equal(yetimiDogrula(aday, { depoda: "var", referansli: null, sahip: "yok" })?.sinif, "DOGRULANAMADI");
  assert.deepEqual(yetimiDogrula(aday, { depoda: "var", referansli: false, sahip: "yok" }), aday);
});

test("kayıp: yalnızca klasör EKSİKSİZ listelendiyse; ikinci geçişte gelen ya da referansı kalkan düşer", () => {
  const ref = { yol: `${P}/kaynak-pdf/a.pdf`, kaynak: "kaynak_pdfleri.depo_yolu" };
  assert.deepEqual(referansiSiniflandir(ref, () => false, () => false), { sinif: "DOGRULANAMADI", sebep: "klasor_okunamadi" });
  assert.deepEqual(referansiSiniflandir(ref, () => true, () => true), { sinif: "SAHIPLI", sebep: "depoda" });
  const aday = referansiSiniflandir(ref, () => true, () => false);
  assert.equal(aday.sinif, "ADAY_KAYIP");
  assert.equal(kayibiDogrula(aday, { depoda: "var", referansli: true })?.sinif, "SAHIPLI");
  assert.equal(kayibiDogrula(aday, { depoda: "yok", referansli: false }), null);
  assert.equal(kayibiDogrula(aday, { depoda: "bilinmiyor", referansli: true })?.sinif, "DOGRULANAMADI");
  assert.equal(kayibiDogrula(aday, { depoda: "yok", referansli: true })?.sinif, "ADAY_KAYIP");
  assert.equal(referansiSiniflandir({ yol: "../x", kaynak: "t" }, () => true, () => false).sinif, "DOGRULANAMADI");
});

test("metindeki görseller: yalnızca kendi Supabase kökenimizin depo bağlantıları", () => {
  const koken = "https://abc.supabase.co";
  const icerik = {
    type: "doc",
    content: [
      { type: "image", attrs: { src: `${koken}/storage/v1/object/sign/project-files/${P}/editor-images/a%20b.png?token=x` } },
      { type: "paragraph", content: [{ type: "image", attrs: { src: `https://kotu.example/storage/v1/object/sign/project-files/${P}/editor-images/c.png` } }] },
      { type: "image", attrs: { src: "veri:bozuk" } },
    ],
  };
  assert.deepEqual(metindekiGorselYollari(icerik, koken), [`${P}/editor-images/a b.png`]);
});

test("salt okunur istemci: yalnızca GET/HEAD ve Storage listeleme; yerel adres denetimi", () => {
  assert.equal(saltOkunurMu("http://127.0.0.1:54401/rest/v1/kaynak_pdfleri?select=*", "GET"), true);
  assert.equal(saltOkunurMu("http://127.0.0.1:54401/storage/v1/object/list/project-files", "POST"), true);
  for (const [u, y] of [
    ["http://127.0.0.1:54401/storage/v1/object/project-files", "DELETE"],
    ["http://127.0.0.1:54401/storage/v1/object/project-files/a.pdf", "POST"],
    ["http://127.0.0.1:54401/rest/v1/kaynak_pdfleri", "PATCH"],
    ["http://127.0.0.1:54401/rest/v1/rpc/herhangi", "POST"],
    ["http://127.0.0.1:54401/storage/v1/object/move", "POST"],
  ]) assert.equal(saltOkunurMu(u, y), false, `${y} ${u}`);
  assert.equal(yerelAdresMi("http://127.0.0.1:54401"), true);
  assert.equal(yerelAdresMi("http://localhost:3000"), true);
  assert.equal(yerelAdresMi("https://abc.supabase.co"), false);
  assert.equal(yerelAdresMi("http://127.0.0.1.evil.example"), false);
});

/* ---------- tarayıcı, sahte depo ve veritabanıyla ---------- */

type SahteNesne = { boyut: number; olusturma: string };
function sahteDepo(nesneler: Map<string, SahteNesne>, ayar: { dusen?: Set<string>; gecici?: Map<string, number> } = {}) {
  const cagri: string[] = [];
  const depo: DepoOkuyucu = {
    async listele(klasor, offset, limit, ara): Promise<ListeSonucu> {
      cagri.push(klasor);
      if (ayar.dusen?.has(klasor)) return { ok: false, tekrarDenenebilir: false };
      const kalan = ayar.gecici?.get(klasor) ?? 0;
      if (kalan > 0) {
        ayar.gecici!.set(klasor, kalan - 1);
        return { ok: false, tekrarDenenebilir: true };
      }
      const onek = klasor ? `${klasor}/` : "";
      const cocuklar = new Map<string, DepoGirdisi>();
      for (const [yol, n] of [...nesneler.entries()].sort()) {
        if (!yol.startsWith(onek)) continue;
        const geri = yol.slice(onek.length);
        const [ad, ...derin] = geri.split("/");
        if (ara && !ad.startsWith(ara)) continue;
        if (derin.length) cocuklar.set(ad, { ad, klasorMu: true, boyut: null, olusturma: null });
        else cocuklar.set(ad, { ad, klasorMu: false, boyut: n.boyut, olusturma: n.olusturma });
      }
      return { ok: true, girdiler: [...cocuklar.values()].slice(offset, offset + limit) };
    },
  };
  return { depo, cagri };
}

function sahteVeri(o: { calismalar?: string[] | null; profiller?: string[] | null; referanslar?: { yol: string; kaynak: string }[] | null; sonradanReferansli?: Set<string> }): VeriOkuyucu {
  return {
    async calismalar(idler) {
      return o.calismalar === null ? null : new Set(idler.filter((i) => (o.calismalar ?? []).includes(i)));
    },
    async profiller(idler) {
      return o.profiller === null ? null : new Set(idler.filter((i) => (o.profiller ?? []).includes(i)));
    },
    async referanslar() {
      return o.referanslar === undefined ? [] : o.referanslar;
    },
    async yolReferansli(yol) {
      if (o.referanslar === null) return null;
      return (o.referanslar ?? []).some((r) => r.yol === yol) || (o.sonradanReferansli?.has(yol) ?? false);
    },
  };
}

function ayar(ek: Partial<TaramaAyari> = {}) {
  let saat = SIMDI;
  const uykular: number[] = [];
  const a: TaramaAyari = {
    ...VARSAYILAN_AYAR,
    istekAraligiMs: 0,
    geriCekilmeTabanMs: 10,
    ikinciGecisBeklemesiMs: 0,
    simdi: () => saat,
    uyu: async (ms) => {
      uykular.push(ms);
      saat += ms;
    },
    ...ek,
  };
  return { a, uykular };
}

test("tarayıcı: uçtan uca sayılar, yollar rapora girmiyor, depo/veri arayüzünde yazma yöntemi yok", async () => {
  const n = new Map<string, SahteNesne>([
    [`${P}/kaynak-pdf/ref.pdf`, { boyut: 100, olusturma: ESKI }],
    [`${P}/kaynak-pdf/yetim.pdf`, { boyut: 200, olusturma: ESKI }],
    [`${P}/kaynak-pdf/taze.pdf`, { boyut: 50, olusturma: TAZE }],
    [`${P}/editor-images/g.png`, { boyut: 10, olusturma: ESKI }],
    [`${P_SILINMIS}/editor-images/g.png`, { boyut: 30, olusturma: ESKI }],
    [`${U_SILINMIS}/imports/1-a.docx`, { boyut: 40, olusturma: ESKI }],
    [`${U}/kilavuz/k.pdf`, { boyut: 5, olusturma: ESKI }],
  ]);
  const { depo } = sahteDepo(n);
  const veri = sahteVeri({
    calismalar: [P],
    profiller: [U],
    referanslar: [
      { yol: `${P}/kaynak-pdf/ref.pdf`, kaynak: "kaynak_pdfleri.depo_yolu" },
      { yol: `${P}/kaynak-pdf/kayip.pdf`, kaynak: "kaynak_pdfleri.depo_yolu" },
    ],
  });
  const { rapor, ayrinti } = await depoEnvanteri(depo, veri, ayar().a);
  assert.equal(rapor.toplam_dosya, 7);
  assert.equal(rapor.toplam_bayt, 435);
  assert.deepEqual(rapor.sinif.ADAY_YETIM, { adet: 3, bayt: 270 }); // yetim.pdf + silinmiş çalışma görseli + silinmiş kullanıcı içe aktarması
  assert.deepEqual(rapor.sinif.SAHIPLI, { adet: 2, bayt: 110 });
  assert.deepEqual(rapor.sinif.DOGRULANAMADI, { adet: 2, bayt: 55 }); // taze + kapsam dışı
  assert.equal(rapor.aday_kayip, 1);
  const metin = JSON.stringify({ rapor, ayrinti });
  for (const yol of [...n.keys(), `${P}/kaynak-pdf/kayip.pdf`]) assert.equal(metin.includes(yol), false, "rapor yol içeriyor");
  for (const id of [P, U, P_SILINMIS, U_SILINMIS]) assert.equal(metin.includes(id), false, "rapor kimlik içeriyor");
  assert.deepEqual(Object.keys(depo), ["listele"]);
  assert.deepEqual(Object.keys(veri).sort(), ["calismalar", "profiller", "referanslar", "yolReferansli"]);
});

test("tarayıcı: ilk geçişte aday, ikinci geçişte bağlanan nesne YETİM SAYILMAZ (eşzamanlı yükleme)", async () => {
  const n = new Map([[`${P}/kaynak-pdf/gec.pdf`, { boyut: 1, olusturma: ESKI }]]);
  const { depo } = sahteDepo(n);
  const veri = sahteVeri({ calismalar: [P], profiller: [], referanslar: [], sonradanReferansli: new Set([`${P}/kaynak-pdf/gec.pdf`]) });
  const { rapor } = await depoEnvanteri(depo, veri, ayar().a);
  assert.equal(rapor.sinif.ADAY_YETIM.adet, 0);
  assert.equal(rapor.sebep["SAHIPLI:ikinci_geciste_referansli"], 1);
});

test("tarayıcı: sayfalama — 2500 nesnelik klasör üç sayfada eksiksiz; hız sınırı istek arası bekletiyor", async () => {
  const n = new Map<string, SahteNesne>();
  for (let i = 0; i < 2500; i++) n.set(`${P}/editor-images/g${String(i).padStart(5, "0")}.png`, { boyut: 1, olusturma: ESKI });
  const { depo, cagri } = sahteDepo(n);
  const { a, uykular } = ayar({ istekAraligiMs: 100 });
  const { rapor } = await depoEnvanteri(depo, sahteVeri({ calismalar: [P], profiller: [] }), a);
  assert.equal(rapor.toplam_dosya, 2500);
  assert.equal(cagri.filter((k) => k === `${P}/editor-images`).length, 3);
  assert.ok(uykular.filter((x) => x > 0).length >= rapor.istek.listeleme - 1, "her istek arası bekleme");
});

test("tarayıcı: geçici hata (429) üstel geri çekilmeyle yeniden denenir; kalıcı hata klasörü OKUNAMADI yapar, içindeki referans kayıp sayılmaz", async () => {
  const n = new Map([
    [`${P}/kaynak-pdf/a.pdf`, { boyut: 1, olusturma: ESKI }],
    [`${U}/kilavuz/k.pdf`, { boyut: 1, olusturma: ESKI }],
  ]);
  const gecici = new Map([[`${P}/kaynak-pdf`, 2]]);
  const { depo } = sahteDepo(n, { gecici, dusen: new Set([`${U}/kilavuz`]) });
  const { a, uykular } = ayar();
  const veri = sahteVeri({ calismalar: [P], profiller: [U], referanslar: [{ yol: `${P}/kaynak-pdf/a.pdf`, kaynak: "k" }, { yol: `${U}/kilavuz/yok.pdf`, kaynak: "calisma_kilavuzu.depo_yolu" }] });
  const { rapor } = await depoEnvanteri(depo, veri, a);
  assert.equal(rapor.istek.yeniden_deneme, 2);
  assert.ok(uykular.includes(10) && uykular.includes(20), "10, 20 ms geri çekilme");
  assert.equal(rapor.okunamayan_klasor, 1);
  assert.equal(rapor.aday_kayip, 0, "okunamayan klasördeki referans kayıp değil");
  assert.equal(rapor.sebep["KAYIP_DOGRULANAMADI:klasor_okunamadi"], 1);
});

test("tarayıcı: Storage tamamen kapalı → hiçbir aday yok, rapor 'okunamadı' der", async () => {
  const { depo } = sahteDepo(new Map(), { dusen: new Set([""]) });
  const veri = sahteVeri({ calismalar: [], profiller: [], referanslar: [{ yol: `${P}/kaynak-pdf/a.pdf`, kaynak: "k" }] });
  const { rapor } = await depoEnvanteri(depo, veri, ayar().a);
  assert.equal(rapor.toplam_dosya, 0);
  assert.equal(rapor.okunamayan_klasor, 1);
  assert.equal(rapor.aday_kayip, 0);
  assert.equal(rapor.kayip_dogrulanamadi, 1);
});

test("tarayıcı: veritabanı okunamazsa (referans ya da sahip) hiçbir nesne aday yetim olmaz", async () => {
  const n = new Map([[`${P_SILINMIS}/kaynak-pdf/a.pdf`, { boyut: 1, olusturma: ESKI }], [`${U_SILINMIS}/imports/b.docx`, { boyut: 1, olusturma: ESKI }]]);
  for (const veri of [sahteVeri({ calismalar: [], profiller: [], referanslar: null }), sahteVeri({ calismalar: null, profiller: null, referanslar: [] })]) {
    const { rapor } = await depoEnvanteri(sahteDepo(n).depo, veri, ayar().a);
    assert.equal(rapor.sinif.ADAY_YETIM.adet, 0);
    assert.equal(rapor.sinif.DOGRULANAMADI.adet, 2);
  }
});

test("tarayıcı: nesne sınırına ulaşılırsa rapor YARIM der ve kayıp adayı üretmez", async () => {
  const n = new Map<string, SahteNesne>();
  for (let i = 0; i < 20; i++) n.set(`${P}/editor-images/g${i}.png`, { boyut: 1, olusturma: ESKI });
  const veri = sahteVeri({ calismalar: [P], profiller: [], referanslar: [{ yol: `${P}/kaynak-pdf/x.pdf`, kaynak: "k" }] });
  const { rapor, yarim } = await depoEnvanteri(sahteDepo(n).depo, veri, ayar({ enCokNesne: 5 }).a);
  assert.equal(yarim, true);
  assert.equal(rapor.aday_kayip, 0);
});

test("tarayıcı: klasörü hiç olmayan referans KAYIP; üst klasörü okunamayan referans DOĞRULANAMADI", async () => {
  const n = new Map([[`${U}/kilavuz/k.pdf`, { boyut: 1, olusturma: ESKI }]]);
  const refler = [
    { yol: `${P_SILINMIS}/kaynak-pdf/a.pdf`, kaynak: "k" }, // kök eksiksiz listelendi, çalışma klasörü hiç yok
    { yol: `${U}/imports/b.docx`, kaynak: "k" }, // kullanıcı klasörü listelendi, imports alt klasörü yok
  ];
  const tam = await depoEnvanteri(sahteDepo(n).depo, sahteVeri({ calismalar: [], profiller: [U], referanslar: refler }), ayar().a);
  assert.equal(tam.rapor.aday_kayip, 2);
  const dusuk = await depoEnvanteri(sahteDepo(n, { dusen: new Set([U]) }).depo, sahteVeri({ calismalar: [], profiller: [U], referanslar: refler }), ayar().a);
  assert.equal(dusuk.rapor.aday_kayip, 1, "üst klasörü okunamayan referans kayıp sayılmaz");
  assert.equal(dusuk.rapor.sebep["KAYIP_DOGRULANAMADI:klasor_okunamadi"], 1);
});
