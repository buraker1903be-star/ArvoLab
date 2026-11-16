// P52b-2D önce/sonra: aynı eşzamanlı değişiklik senaryolarını ESKİ (05182c7)
// ve YENİ tarayıcıya karşı koşturur. Gerçek Storage'a değil, Storage'ın
// listeleme sözleşmesini (ORDER BY name LIMIT/OFFSET) birebir taklit eden
// bellek içi bir depoya karşı çalışır; gerçek Storage API ile aynı senaryolar
// denetim/p52b2d/kabul-eszamanli.mjs'te.
//
// Kullanım (her kök kendi çözümleyicisiyle):
//   node --import <kök>/tests/register.mjs denetim/p52b2d/envanter-once-sonra.mjs <kök> <etiket>
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const oz = (y) => createHash("sha256").update(y).digest("hex").slice(0, 16);

const [kok, etiket = "?"] = process.argv.slice(2);
const { depoEnvanteri, VARSAYILAN_AYAR } = await import(pathToFileURL(`${kok}/lib/depo-envanteri-tarama.ts`).href);

const P = "3b281459-8ae2-4a9a-b31f-4530474fea2e";
const KLASOR = `${P}/kaynak-pdf`;
const SIMDI = Date.parse("2026-11-16T12:00:00Z");
const ESKI = new Date(SIMDI - 3 * 864e5).toISOString();
const ad = (i) => `g${String(i).padStart(5, "0")}.pdf`;

function depoKur(baslangic, degistir) {
  const adlar = new Set(baslangic);
  let cagri = 0;
  return {
    adlar,
    depo: {
      async listele(klasor, offset, limit, ara) {
        if (klasor === KLASOR) degistir(++cagri, offset, adlar, !!ara);
        let g;
        if (klasor === "") g = [{ ad: P, klasorMu: true, boyut: null, olusturma: null }];
        else if (klasor === P) g = [{ ad: "kaynak-pdf", klasorMu: true, boyut: null, olusturma: null }];
        else g = [...adlar].filter((a) => !ara || a.startsWith(ara)).sort().map((a) => ({ ad: a, klasorMu: false, boyut: 1, olusturma: ESKI }));
        return { ok: true, girdiler: g.slice(offset, offset + limit) };
      },
    },
  };
}
const veri = (refler) => ({
  async calismalar(idler) { return new Set(idler.filter((i) => i === P)); },
  async profiller() { return new Set(); },
  async referanslar() { return refler.map((yol) => ({ yol, kaynak: "kaynak_pdfleri.depo_yolu" })); },
  async yolReferansli(yol) { return refler.includes(yol); },
});
const ayar = () => {
  let saat = SIMDI;
  return { ...VARSAYILAN_AYAR, istekAraligiMs: 0, geriCekilmeTabanMs: 1, ikinciGecisBeklemesiMs: 0, simdi: () => saat, uyu: async (ms) => { saat += ms; } };
};

const temel = Array.from({ length: 2600 }, (_, i) => ad(i * 10));
const hepsiRef = (adlar) => [...adlar].map((a) => `${KLASOR}/${a}`);
const sonuc = [];

async function kos(ad_, aciklama, baslangic, degistir, refler) {
  const { depo, adlar } = depoKur(baslangic, degistir);
  const ilk = new Set(adlar);
  const { rapor, ayrinti } = await depoEnvanteri(depo, veri(refler(ilk)), ayar());
  const gercek = adlar.size;
  // Yol düzeyinde: aynı yol kaç kez sayıldı, tarama boyunca VAR olan kaç yol hiç görülmedi?
  const nes = ayrinti.filter((x) => x.kategori === "kaynak-pdf").map((x) => x.ozet);
  const tekrarSayilan = nes.length - new Set(nes).size;
  const gorulen = new Set(nes);
  const hepBoyunca = [...ilk].filter((a) => adlar.has(a));
  const atlanan = hepBoyunca.filter((a) => !gorulen.has(oz(`${KLASOR}/${a}`))).length;
  const kayit = {
    senaryo: ad_, aciklama,
    var_olan_baslangic: ilk.size, var_olan_son: gercek,
    sayilan: rapor.toplam_dosya,
    ayni_yol_iki_kez_sayilan: tekrarSayilan,
    tarama_boyunca_var_olup_gorulmeyen: atlanan,
    aday_kayip: rapor.aday_kayip,
    kesin: rapor.kesin ?? "(alan yok)",
    degisen_klasor: rapor.degisen_klasor ?? "(alan yok)",
    tekrar_ayiklanan: rapor.tekrar_ayiklanan ?? "(alan yok)",
  };
  sonuc.push(kayit);
  console.log(`[${etiket}] ${ad_.padEnd(10)} sayılan=${kayit.sayilan} (başta ${kayit.var_olan_baslangic}, sonda ${kayit.var_olan_son}) iki_kez_sayılan_yol=${kayit.ayni_yol_iki_kez_sayilan} hep_var_olup_görülmeyen=${kayit.tarama_boyunca_var_olup_gorulmeyen} aday_kayıp=${kayit.aday_kayip} kesin=${kayit.kesin} değişen_klasör=${kayit.degisen_klasor}`);
}

// S1: değişiklik yok
await kos("S1-sabit", "değişiklik yok", temel, () => {}, () => []);
// S2: her ara sayfadan önce sınırın önüne bir ekleme (sürekli yükleme)
{ let n = 0; await kos("S2-ekleme", "her ara sayfadan önce önde bir ekleme", temel, (c, o, a, ara) => { if (!ara && o > 0) a.add(ad(++n * 10 - 5)); }, () => []); }
// S3: her ara sayfadan önce baştan bir silme; bütün dosyalar başvurulu (yani hiçbiri kayıp olmamalı, silinenler hariç)
{ let s = 0; await kos("S3-silme", "her ara sayfadan önce baştan bir silme; kalan her dosya başvurulu", temel, (c, o, a, ara) => { if (!ara && o > 0) a.delete(ad(s++ * 10)); }, (ilk) => hepsiRef([...ilk].slice(100))); }

writeFileSync(new URL(`./sonuclar/once-sonra-${etiket}.json`, import.meta.url), JSON.stringify({ etiket, kok_commit: process.env.KOK_COMMIT ?? null, sonuc }, null, 2) + "\n");
