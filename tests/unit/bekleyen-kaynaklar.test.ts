import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bekleyenKaynaklar } from "@/lib/bekleyen-kaynaklar";
import { kaynakBaglamlari } from "@/lib/kaynak-kutuphanesi";
import { stilTanimi } from "@/lib/atif/stiller";

const k = (id: string, authors: string | null, year: string | null, status = "to_review") => ({ id, authors, year, title: "Başlık", status });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("bekleyen kaynaklar", () => {
  test("soyad ve yıl gövdede birlikte geçiyorsa kullanılmış", () => {
    const kaynaklar = [k("a", "Öztürk, Ali", "2020"), k("b", "Yılmaz, B.", "2019"), k("c", "Kaya, C.", "2021")];
    const sonuc = bekleyenKaynaklar(kaynaklar, { govdeMetni: "… (ÖZTÜRK, 2020) ile Yılmaz (2018) …", atifTuru: "yazar-tarih" });
    assert.deepEqual(ids(sonuc.bekleyen), ["b", "c"]);
    assert.equal(sonuc.kural, "metin");
  });

  test("durum 'used' olsa da atıf metinde yoksa bekliyor (durum alanı metin içi atıf değildir)", () => {
    assert.equal(bekleyenKaynaklar([k("a", "Öztürk, Ali", "2020", "used")], { govdeMetni: "metin", atifTuru: "yazar-tarih" }).bekleyen.length, 1);
  });

  test("numaralı stil: metinden okunamaz, liste 'Kullandım' işaretine göre ve bunu söyler", () => {
    const s = bekleyenKaynaklar([k("a", "Öztürk, Ali", "2020", "used"), k("b", "Kaya, C.", "2021")], { govdeMetni: "[1] [2]", atifTuru: "numara" });
    assert.equal(s.kural, "durum");
    assert.deepEqual(ids(s.bekleyen), ["b"]);
  });

  test("yazarsız kaynak 'bekliyor' DEĞİL, doğrulanamayan (eskiden bekliyor sayılıyordu)", () => {
    const s = bekleyenKaynaklar([k("a", null, null)], { govdeMetni: "metin", atifTuru: "yazar-tarih" });
    assert.deepEqual(ids(s.bekleyen), []);
    assert.deepEqual(ids(s.dogrulanamayan), ["a"]);
  });

  /*
    B5 (4.3.5): dipnotlu stilde atıf dipnotta; gövdede soyad yok. Eskiden
    editör bu stili yazar-tarih sanıyor, dipnotu hiç okumuyor ve HER kaynağı
    "atıf bekliyor" gösteriyordu.
  */
  test("dipnotlu stil: dipnottaki atıf bulunur; dipnot verilmezse 'bekliyor' denmez", () => {
    const kaynaklar = [k("onder", "Önder, A. Ö.", "2009", "used"), k("kaya", "Kaya, C.", "2021")];
    const govde = "Kısa dönemde ters yönlü ilişki gözlenmiştir.";
    const dipnotlar = ["Önder, Türkiye'de Phillips eğrisinin istikrarı, 2009, s. 12."];
    const s = bekleyenKaynaklar(kaynaklar, { govdeMetni: govde, atifTuru: "dipnot", dipnotlar });
    assert.deepEqual(ids(s.bekleyen), ["kaya"]);
    const okunamadi = bekleyenKaynaklar(kaynaklar, { govdeMetni: govde, atifTuru: "dipnot" });
    assert.deepEqual(ids(okunamadi.bekleyen), [], "dipnotlar okunamadıysa yanlış 'bekliyor' yok");
    assert.deepEqual(ids(okunamadi.dogrulanamayan), ["onder", "kaya"]);
  });

  test("stil sınıflandırması tek yerden: dipnotlu ve numaralı CSL stilleri yazar-tarih sayılmaz", () => {
    assert.equal(stilTanimi("dipnot").tur, "dipnot");
    assert.equal(stilTanimi("ieee").tur, "numara");
    assert.equal(stilTanimi("vancouver").tur, "numara");
    assert.equal(stilTanimi("apa7").tur, "yazar-tarih");
  });

  test("editör kartı ve Kaynaklar sayfası AYNI sonucu verir (dört stil türü)", () => {
    const kaynaklar = [k("onder", "Önder, A. Ö.", "2009", "used"), k("tuik", "TÜİK.", "2026a"), k("yok", null, "2020"), k("kaya", "Kaya, C.", "2021")];
    const govde = "Bulgular (Önder, 2009) ve TÜİK (2026a) ile uyumludur.";
    const dipnotlar = ["Kaya, Ekonomi, 2021, s. 4."];
    for (const atifTuru of ["yazar-tarih", "yazar-sayfa", "dipnot"] as const) {
      const kart = bekleyenKaynaklar(kaynaklar, { govdeMetni: govde, atifTuru, dipnotlar });
      const sayfa = kaynakBaglamlari(kaynaklar.map((x) => ({ ...x, doi_or_url: null })), { govdeMetni: govde, atifTuru, dipnotlar, kanitKaynaklari: [], pdfDoileri: [] });
      const sayfaBekleyen = kaynaklar.filter((x) => sayfa[x.id].metinde === false).map((x) => x.id);
      const sayfaBilinmeyen = kaynaklar.filter((x) => sayfa[x.id].metinde === null).map((x) => x.id);
      assert.deepEqual(ids(kart.bekleyen), sayfaBekleyen, atifTuru);
      assert.deepEqual(ids(kart.dogrulanamayan), sayfaBilinmeyen, atifTuru);
    }
  });
});
