import assert from "node:assert/strict";
import test from "node:test";
import {
  baslikBenzerligi,
  crossrefKaydi,
  doiAyikla,
  kunyeKarsilastir,
  kunyeOzeti,
  openAlexErisim,
  openAlexKaydi,
  soyadlar,
  type DizinKaydi,
} from "@/lib/kanit/kunye-karsilastirma";

const KAYIT: DizinKaydi = {
  dizin: "crossref",
  baslik: "The \"what\" and \"why\" of goal pursuits: Human needs and the self-determination of behavior",
  soyadlar: ["Deci", "Ryan"],
  yil: 2000,
  yayin: "Psychological Inquiry",
  cilt: "11",
  sayi: "4",
  sayfalar: "227-268",
  doi: "10.1207/s15327965pli1104_01",
  adres: "https://doi.org/10.1207/s15327965pli1104_01",
};

const KAYNAK = {
  title: "The \"what\" and \"why\" of goal pursuits",
  authors: "Deci, E. L., & Ryan, R. M.",
  year: "2000",
  container_title: "Psychological Inquiry",
  volume: "11",
  issue: "4",
  pages: "227–268",
  doi_or_url: "https://doi.org/10.1207/S15327965PLI1104_01",
};

test("doğru künye alt başlıksız yazılmış olsa da doğrulanır", () => {
  const sonuc = kunyeKarsilastir(KAYNAK, KAYIT);
  assert.equal(sonuc.durum, "dogrulandi");
  assert.ok(sonuc.alanlar.every((a) => a.sonuc === "eslesti"), JSON.stringify(sonuc.alanlar));
});

test("yıl uyuşmazlığı 'kısmen' ve hangi alan olduğu söyleniyor", () => {
  const sonuc = kunyeKarsilastir({ ...KAYNAK, year: "2001" }, KAYIT);
  assert.equal(sonuc.durum, "kismen");
  assert.equal(sonuc.alanlar.find((a) => a.alan === "yil")?.sonuc, "farkli");
  assert.match(kunyeOzeti(sonuc), /uyuşmayan: yıl/);
});

test("başlık tutmuyorsa DOI başka yayına ait: 'uyuşmuyor'", () => {
  const sonuc = kunyeKarsilastir({ ...KAYNAK, title: "Örgütsel bağlılık ve iş doyumu ilişkisi" }, KAYIT);
  assert.equal(sonuc.durum, "uyusmuyor");
});

test("ilk yazar dizinde yoksa doğrulandı denmez (yazar bir kapı)", () => {
  const sonuc = kunyeKarsilastir({ ...KAYNAK, authors: "Yılmaz, A." }, KAYIT);
  assert.equal(sonuc.durum, "kismen");
  assert.equal(sonuc.alanlar.find((a) => a.alan === "ilk_yazar")?.sonuc, "farkli");
});

test("temel alan kaydımızda eksikse doğrulandı denmez", () => {
  const sonuc = kunyeKarsilastir({ ...KAYNAK, year: null }, KAYIT);
  assert.equal(sonuc.durum, "kismen");
  assert.equal(sonuc.alanlar.find((a) => a.alan === "yil")?.sonuc, "bizde_yok");
});

test("soyadları: APA, Türkçe harf ve serbest biçim", () => {
  assert.deepEqual(soyadlar("Şahin, A., Özdemir, B. C., & Çelik, D."), ["Şahin", "Özdemir", "Çelik"]);
  assert.deepEqual(soyadlar("Ali Taş; Ayşe Kara"), ["Taş", "Kara"]);
  assert.deepEqual(soyadlar(null), []);
});

test("aksan farkı yazar eşleşmesini düşürmez (dizin 'Yilmaz' yazabilir)", () => {
  const sonuc = kunyeKarsilastir({ ...KAYNAK, authors: "Yılmaz, A." }, { ...KAYIT, soyadlar: ["Yilmaz"] });
  assert.equal(sonuc.alanlar.find((a) => a.alan === "ilk_yazar")?.sonuc, "eslesti");
});

test("başlık benzerliği kısa tarafa göre, ama az ortak kelimede değil", () => {
  assert.ok(baslikBenzerligi(KAYNAK.title, KAYIT.baslik) >= 0.85);
  assert.ok(baslikBenzerligi("İş doyumu", "İş doyumu ve örgütsel bağlılık üzerine bir inceleme") < 0.85);
});

test("DOI her biçimden ayıklanır", () => {
  assert.equal(doiAyikla("https://doi.org/10.1000/ABC.123."), "10.1000/abc.123");
  assert.equal(doiAyikla("doi: 10.1000/xyz"), "10.1000/xyz");
  assert.equal(doiAyikla("https://ornek.com/makale"), null);
});

test("Crossref ve OpenAlex yanıtları DizinKaydi'na çevriliyor", () => {
  const c = crossrefKaydi(
    { title: ["<i>Başlık</i> burada"], author: [{ family: "Deci", given: "E." }], issued: { "date-parts": [[2000]] }, "container-title": ["Dergi"], page: "1-5" },
    "10.1/x",
  );
  assert.deepEqual([c?.baslik, c?.soyadlar, c?.yil, c?.yayin, c?.sayfalar], ["Başlık burada", ["Deci"], 2000, "Dergi", "1-5"]);
  assert.equal(crossrefKaydi({ title: [] }, "10.1/x"), null);

  const o = openAlexKaydi({
    title: "Başlık",
    doi: "https://doi.org/10.1000/Y",
    publication_year: 2020,
    authorships: [{ author: { display_name: "Ayşe Kara" } }],
    biblio: { volume: "3", issue: "2", first_page: "10", last_page: "20" },
    primary_location: { source: { display_name: "Dergi" } },
  });
  assert.deepEqual([o?.soyadlar, o?.doi, o?.sayfalar, o?.adres], [["Kara"], "10.1000/y", "10-20", "https://doi.org/10.1000/y"]);
});

test("açık erişim bilgisi: bilinmiyor ile 'yok' ayrı", () => {
  assert.deepEqual(openAlexErisim({ open_access: { is_oa: true, oa_url: "https://oa.example/pdf" } }), { durum: "acik_erisim", adres: "https://oa.example/pdf" });
  assert.deepEqual(openAlexErisim({ open_access: { is_oa: false } }), { durum: "acik_erisim_yok", adres: null });
  assert.deepEqual(openAlexErisim({}), { durum: "bilinmiyor", adres: null });
});
