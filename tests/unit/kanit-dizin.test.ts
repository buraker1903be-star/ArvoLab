import assert from "node:assert/strict";
import test from "node:test";
import { kunyeDogrula, type Getir } from "@/lib/kanit/dizin";

/*
  Ağ katmanının KARARLARI: bulundu / bulunamadı / ulaşılamadı. En önemlisi
  üçüncüsü — geçici bir ağ hatası "doğrulanamadı" diye kaydedilmemeli.
*/

const KAYNAK = { title: "Öğrenme ortamları ve öz-yeterlik: bir karşılaştırma", authors: "Kara, A.", year: "2021", doi_or_url: "10.1000/ornek" };

const crossrefMesaji = {
  message: {
    title: ["Öğrenme ortamları ve öz-yeterlik: bir karşılaştırma"],
    author: [{ family: "Kara", given: "Ayşe" }],
    issued: { "date-parts": [[2021]] },
  },
};

const sahte = (yanitlar: Record<string, { durum: number; veri: unknown } | "hata">): Getir => async (adres) => {
  const anahtar = Object.keys(yanitlar).find((k) => adres.includes(k));
  const yanit = anahtar ? yanitlar[anahtar] : { durum: 404, veri: null };
  if (yanit === "hata") throw new TypeError("fetch failed");
  return yanit;
};

test("DOI Crossref'te bulunur, alanlar tutar, açık erişim OpenAlex'ten gelir", async () => {
  const sonuc = await kunyeDogrula(
    KAYNAK,
    sahte({
      "api.crossref.org/works/10.1000": { durum: 200, veri: crossrefMesaji },
      "api.openalex.org": { durum: 200, veri: { open_access: { is_oa: true, oa_url: "https://oa/x" } } },
    }),
  );
  assert.equal(sonuc.tur, "bulundu");
  if (sonuc.tur !== "bulundu") return;
  assert.equal(sonuc.karsilastirma.durum, "dogrulandi");
  assert.deepEqual(sonuc.erisim, { durum: "acik_erisim", adres: "https://oa/x" });
});

test("DOI iki dizinde de yoksa 'bulunamadı' — sahte olduğu söylenmez", async () => {
  const sonuc = await kunyeDogrula(KAYNAK, sahte({}));
  assert.equal(sonuc.tur, "bulunamadi");
  if (sonuc.tur === "bulunamadi") assert.match(sonuc.neden, /sahte olduğunu göstermez/);
});

test("dizine ulaşılamazsa sonuç YOK (ulaşılamadı)", async () => {
  assert.equal((await kunyeDogrula(KAYNAK, sahte({ "api.crossref.org": "hata" }))).tur, "ulasilamadi");
  assert.equal((await kunyeDogrula(KAYNAK, sahte({ "api.crossref.org": { durum: 503, veri: null } }))).tur, "ulasilamadi");
});

test("açık erişim bilgisi alınamazsa doğrulama yine geçerli, erişim 'bilinmiyor'", async () => {
  const sonuc = await kunyeDogrula(KAYNAK, sahte({ "api.crossref.org/works/10.1000": { durum: 200, veri: crossrefMesaji }, "api.openalex.org": "hata" }));
  assert.equal(sonuc.tur, "bulundu");
  if (sonuc.tur === "bulundu") assert.equal(sonuc.erisim.durum, "bilinmiyor");
});

test("DOI yoksa başlıkla aranır; eşik altındaki aday kabul edilmez", async () => {
  const kaynak = { ...KAYNAK, doi_or_url: null };
  const bulundu = await kunyeDogrula(
    kaynak,
    sahte({ "query.bibliographic": { durum: 200, veri: { message: { items: [{ ...crossrefMesaji.message, DOI: "10.1000/bulunan" }] } } } }),
  );
  assert.equal(bulundu.tur, "bulundu");
  if (bulundu.tur === "bulundu") assert.equal(bulundu.doi, "10.1000/bulunan");

  const ilgisiz = await kunyeDogrula(
    kaynak,
    sahte({ "query.bibliographic": { durum: 200, veri: { message: { items: [{ title: ["Tamamen başka bir çalışma"], DOI: "10.1/z" }] } } } }),
  );
  assert.equal(ilgisiz.tur, "bulunamadi");
});
