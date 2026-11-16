import assert from "node:assert/strict";
import test from "node:test";
import { kesinligiBelirle, ortusmeliOfset, sayfalariBirlestir, bosRapor } from "@/lib/depo-envanteri";
import { depoEnvanteri, VARSAYILAN_AYAR, type DepoGirdisi, type DepoOkuyucu, type ListeSonucu, type TaramaAyari, type VeriOkuyucu } from "@/lib/depo-envanteri-tarama";

/*
  P52b-2D: envanter sayım doğruluğu. Storage listelemesi ORDER BY name
  LIMIT/OFFSET ile sayfalıyor (storage.search). Tarama sırasında sayfa
  sınırının önüne bir nesne eklenirse sınırdaki nesne İKİ KEZ, silinirse bir
  nesne HİÇ görünmüyordu (gerçek PostgreSQL: denetim/p52b2/yaris, C1).
  Eskiden ikisi de sessizdi: tekrar eden yol iki kez sayılıyor, atlanan yol
  yüzünden başvurulan bir dosya "kayıp" adayı olabiliyor ve rapor yine
  eksiksiz görünüyordu.
*/

const P = "3b281459-8ae2-4a9a-b31f-4530474fea2e";
const GUN = 24 * 60 * 60 * 1000;
const SIMDI = Date.parse("2026-11-16T12:00:00Z");
const ESKI = new Date(SIMDI - 3 * GUN).toISOString();
const KLASOR = `${P}/kaynak-pdf`;
const ad = (i: number) => `g${String(i).padStart(5, "0")}.pdf`;

/** Tek klasörlü, değişebilen sahte depo. `degistir` her listeleme çağrısından ÖNCE çalışır. */
function degisenDepo(baslangic: string[], degistir: (cagri: number, klasor: string, offset: number, adlar: Set<string>) => void) {
  const adlar = new Set(baslangic);
  let cagri = 0;
  const depo: DepoOkuyucu = {
    async listele(klasor, offset, limit, ara): Promise<ListeSonucu> {
      if (klasor === KLASOR) degistir(++cagri, klasor, offset, adlar);
      let girdiler: DepoGirdisi[];
      if (klasor === "") girdiler = [{ ad: P, klasorMu: true, boyut: null, olusturma: null }];
      else if (klasor === P) girdiler = [{ ad: "kaynak-pdf", klasorMu: true, boyut: null, olusturma: null }];
      else girdiler = [...adlar].filter((a) => !ara || a.startsWith(ara)).sort().map((a) => ({ ad: a, klasorMu: false, boyut: 1, olusturma: ESKI }));
      return { ok: true, girdiler: girdiler.slice(offset, offset + limit) };
    },
  };
  return { depo, adlar, cagri: () => cagri };
}

const veri = (referanslar: string[] = []): VeriOkuyucu => ({
  async calismalar(idler) {
    return new Set(idler.filter((i) => i === P));
  },
  async profiller() {
    return new Set();
  },
  async referanslar() {
    return referanslar.map((yol) => ({ yol, kaynak: "kaynak_pdfleri.depo_yolu" }));
  },
  async yolReferansli(yol) {
    return referanslar.includes(yol);
  },
});

function ayar(ek: Partial<TaramaAyari> = {}): TaramaAyari {
  let saat = SIMDI;
  return {
    ...VARSAYILAN_AYAR,
    istekAraligiMs: 0,
    geriCekilmeTabanMs: 1,
    ikinciGecisBeklemesiMs: 0,
    simdi: () => saat,
    uyu: async (ms) => {
      saat += ms;
    },
    ...ek,
  };
}

/* ---------- saf birleştirme ---------- */

const g = (...a: string[]) => a.map((x) => ({ ad: x, klasorMu: false }));

test("sayfalariBirlestir: kararlı örtüşen sayfalar; örtüşen öğe tekrar sayılmaz", () => {
  const b = sayfalariBirlestir([g("a", "b", "c"), g("c", "d", "e"), g("e", "f")], 3);
  assert.deepEqual(b.girdiler.map((x) => x.ad), ["a", "b", "c", "d", "e", "f"]);
  assert.equal(b.kararli, true);
  assert.equal(b.tekrar, 0);
  assert.equal(b.bitti, true);
});

test("sayfalariBirlestir: sınırın önüne ekleme → kararsız, tekrar eden yol TEK kez", () => {
  // a,b,c okundu; "aa" eklendi → ofset 2'deki sayfa b,c,d (beklenen c ile başlamalıydı)
  const b = sayfalariBirlestir([g("a", "b", "c"), g("b", "c", "d"), g("d", "e")], 3);
  assert.equal(b.kararli, false);
  assert.deepEqual(b.girdiler.map((x) => x.ad), ["a", "b", "c", "d", "e"]);
  assert.equal(b.tekrar, 2); // b ve c ikinci kez görüldü, sayılmadı
});

test("sayfalariBirlestir: sınırın önünden silme → kararsız (atlanan öğe olabilir)", () => {
  // a,b,c okundu; b silindi → ofset 2'deki sayfa d,e,f ("c" ile başlamalıydı; "d" ATLANMADI ama c'den sonraki boşluk bilinemez)
  const b = sayfalariBirlestir([g("a", "b", "c"), g("e", "f", "g"), g("g")], 3);
  assert.equal(b.kararli, false);
});

test("sayfalariBirlestir: dolu sayfadan sonra boş sayfa → kararsız (sondan silme)", () => {
  const b = sayfalariBirlestir([g("a", "b", "c"), []], 3);
  assert.equal(b.kararli, false);
});

test("örtüşmeli ofset: k·(sayfa−1)", () => {
  assert.deepEqual([0, 1, 2, 3].map((k) => ortusmeliOfset(k, 1000)), [0, 999, 1998, 2997]);
});

test("kesinligiBelirle: varsayılan KESİN DEĞİL; her neden ayrı yazılır; rapor yalnızca aday", () => {
  const r = bosRapor();
  assert.equal(r.kesin, false, "işlev çağrılmadan rapor kesin görünmemeli");
  assert.equal(r.nitelik, "yalnizca_aday");
  kesinligiBelirle(r, { yarim: false, referansOkunamadi: false, sahipOkunamadi: false });
  assert.equal(r.kesin, true);
  r.degisen_klasor = 1;
  r.okunamayan_klasor = 2;
  kesinligiBelirle(r, { yarim: true, referansOkunamadi: true, sahipOkunamadi: true });
  assert.equal(r.kesin, false);
  assert.deepEqual(r.kesin_degil_cunku, ["nesne_ust_siniri", "okunamayan_klasor", "tarama_sirasinda_degisen_klasor", "referanslar_okunamadi", "sahipler_okunamadi"]);
});

/* ---------- tarayıcı: 2500+ nesne ve eşzamanlı değişiklik ---------- */

const baslangic = Array.from({ length: 2600 }, (_, i) => ad(i * 10)); // aralara ekleme yapılabilsin diye 10'ar

test("tarama: değişiklik yoksa 2600 nesne tam bir kez, rapor KESİN", async () => {
  const { depo } = degisenDepo(baslangic, () => {});
  const { rapor } = await depoEnvanteri(depo, veri(), ayar());
  assert.equal(rapor.toplam_dosya, 2600);
  assert.equal(rapor.tekrar_ayiklanan, 0);
  assert.equal(rapor.degisen_klasor, 0);
  assert.equal(rapor.kesin, true);
  assert.deepEqual(rapor.kesin_degil_cunku, []);
});

test("tarama: 2. sayfa isteğinden önce sınırın önüne TEK ekleme → klasör yeniden listelenir, her yol bir kez, rapor kesin", async () => {
  const { depo, adlar } = degisenDepo(baslangic, (c, _k, _o, a) => {
    if (c === 2) a.add(ad(5)); // ilk sayfanın içine
  });
  const { rapor } = await depoEnvanteri(depo, veri(), ayar());
  assert.equal(rapor.toplam_dosya, adlar.size); // 2601: eklenen dahil, kimse iki kez değil
  assert.equal(rapor.degisen_klasor, 0, "yeniden listeleme kararlı çıktı");
  assert.ok(rapor.tekrar_ayiklanan >= 1, "kayan sayfadaki tekrar ayıklandı");
  assert.equal(rapor.kesin, true);
});

test("tarama: her sayfa isteğinde sınırın önüne ekleme (sürekli yükleme) → aynı yol iki kez SAYILMAZ, klasör değişen, rapor KESİN DEĞİL", async () => {
  let n = 0;
  const { depo, adlar } = degisenDepo(baslangic, (c, _k, offset, a) => {
    if (offset > 0) a.add(ad(++n * 10 - 5)); // her ara sayfadan önce önde yeni bir ad
  });
  const { rapor, ayrinti } = await depoEnvanteri(depo, veri([`${KLASOR}/yok-olan.pdf`]), ayar());
  const ozetler = ayrinti.filter((x) => x.kategori === "kaynak-pdf").map((x) => x.ozet);
  assert.equal(new Set(ozetler).size, ozetler.length, "aynı yol ayrıntıda iki kez yok");
  assert.ok(rapor.toplam_dosya <= adlar.size, "sayım var olan nesne sayısını aşamaz");
  assert.ok(rapor.toplam_dosya >= 2600, "başlangıçtaki nesneler kaybolmadı");
  assert.equal(rapor.degisen_klasor, 1);
  assert.equal(rapor.kesin, false);
  assert.ok(rapor.kesin_degil_cunku.includes("tarama_sirasinda_degisen_klasor"));
  // Kararsız klasördeki eksik referans kesin "kayıp" değildir.
  assert.equal(rapor.aday_kayip, 0);
  assert.equal(rapor.kayip_dogrulanamadi, 1);
});

test("tarama: her sayfa isteğinde sınırın önünden silme → başvurulan VAR olan dosya kayıp adayı OLMAZ, rapor kesin değil", async () => {
  const hedef = ad(1500 * 10); // başvurulan, hiç silinmiyor
  let s = 0;
  const { depo } = degisenDepo(baslangic, (_c, _k, offset, a) => {
    if (offset > 0) a.delete(ad(s++ * 10)); // her ara sayfadan önce baştan bir nesne gider
  });
  const { rapor } = await depoEnvanteri(depo, veri([`${KLASOR}/${hedef}`]), ayar());
  assert.equal(rapor.aday_kayip, 0, "kayan liste var olan dosyayı kayıp gösteremez");
  assert.equal(rapor.kesin, false);
  assert.equal(rapor.degisen_klasor, 1);
});

test("tarama: ikinci geçişte (aday doğrulaması) kararsız liste 'yok' sayılmaz → DOGRULANAMADI", async () => {
  // Klasörün ilk listelemesi kararlı; referans edilen dosya yok → ilk geçişte KAYIP adayı.
  // İkinci geçişte (ara = ad) her istekte önde yeni nesne → kararsız → "bilinmiyor".
  let ikinci = false;
  let n = 0;
  const kucuk = Array.from({ length: 30 }, (_, i) => ad(i * 10));
  const { depo } = degisenDepo(kucuk, (_c, _k, offset, a) => {
    if (ikinci && offset > 0 && n < 40) a.add(`g${String(++n).padStart(5, "0")}a.pdf`);
  });
  const sarili: DepoOkuyucu = {
    async listele(k, o, l, ara) {
      if (ara) ikinci = true;
      return depo.listele(k, o, l, ara ? "g" : undefined); // ara önekini genişlet: sayfalar dolsun
    },
  };
  // Var olan dosyaların hepsi başvurulu: tek aday, eksik referans (g99999).
  const refler = [...kucuk.map((x) => `${KLASOR}/${x}`), `${KLASOR}/g99999.pdf`];
  const { rapor } = await depoEnvanteri(sarili, veri(refler), ayar({ sayfa: 5 }));
  assert.ok(ikinci, "ikinci geçiş çalıştı");
  assert.equal(rapor.aday_kayip, 0);
  assert.equal(rapor.kayip_dogrulanamadi, 1);
});

test("tarama: Storage hatası ve referans okunamaması DOGRULANAMADI, rapor kesin değil", async () => {
  const kapali: DepoOkuyucu = { async listele() { return { ok: false, tekrarDenenebilir: false }; } };
  const r1 = (await depoEnvanteri(kapali, veri([`${KLASOR}/a.pdf`]), ayar())).rapor;
  assert.equal(r1.kesin, false);
  assert.ok(r1.kesin_degil_cunku.includes("okunamayan_klasor"));
  assert.equal(r1.aday_kayip, 0);

  const { depo } = degisenDepo(baslangic.slice(0, 10), () => {});
  const refYok: VeriOkuyucu = { ...veri(), async referanslar() { return null; }, async yolReferansli() { return null; } };
  const r2 = (await depoEnvanteri(depo, refYok, ayar())).rapor;
  assert.equal(r2.kesin, false);
  assert.ok(r2.kesin_degil_cunku.includes("referanslar_okunamadi"));
  assert.equal(r2.sinif.ADAY_YETIM.adet, 0);
  assert.equal(r2.sinif.DOGRULANAMADI.adet, 10);

  const sahipYok: VeriOkuyucu = { ...veri(), async calismalar() { return null; } };
  const r3 = (await depoEnvanteri(depo, sahipYok, ayar())).rapor;
  assert.equal(r3.kesin, false);
  assert.ok(r3.kesin_degil_cunku.includes("sahipler_okunamadi"));
  assert.equal(r3.sinif.ADAY_YETIM.adet, 0);
});
