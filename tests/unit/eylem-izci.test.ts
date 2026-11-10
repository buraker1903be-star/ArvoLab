import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error — düz JS modülü (scripts/onizleme), tip bildirimi yok
import { anlat, bostakileriSiniflandir, eylemAdlariniCoz, hataMi, istekBicimi } from "../../scripts/onizleme/eylem-izci.mjs";

/*
  Araç çubuğu kabulünün "boştayken sunucu isteği" denetimi (G1 Aşama 5).
  Eskiden yük altında gecikmiş bir açılış okuması hayalet kayıt gibi
  düşüyordu; artık açılış okumasının tekrarı bilgi, belge yazımı ve
  açılışta görülmemiş eylem HATA.
*/
type Istek = { kimlik: string; belgeYazimi: boolean; bayt: number; argumanSayisi: number | null; durum: number | null; ad?: string };
const ID_A = "0076c96023fccb8948397e337552c734a83797f2a7";
const ID_B = "409c594470a16ef7fb1921e9bf79f71afac600f83c";
const ID_C = "60aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("istemci paketinden kimlik → eylem adı", () => {
  const js = `(0, x.createServerReference)("${ID_A}", y.callServer, void 0, y.findSourceMapURL, "getLiteratureSources");
    q = (0, x.createServerReference)("${ID_B}", y.callServer, void 0, y.findSourceMapURL, "listNotifications")`;
  assert.deepEqual(eylemAdlariniCoz(js), { [ID_A]: "getLiteratureSources", [ID_B]: "listNotifications" });
  assert.deepEqual(eylemAdlariniCoz("başka bir paket"), {});
});

test("gövdenin yalnızca biçimi alınır: belge yazımı, bayt, argüman sayısı", () => {
  assert.deepEqual(istekBicimi('["b1"]'), { belgeYazimi: false, bayt: 6, argumanSayisi: 1 });
  const kayit = istekBicimi('["b1",{"content":{"type":"doc","content":[]},"expectedUpdatedAt":"x"}]');
  assert.equal(kayit.belgeYazimi, true);
  assert.equal(kayit.argumanSayisi, 2);
  assert.equal(istekBicimi("çok parçalı form").argumanSayisi, null);
});

test("açılış okumasının gecikmiş tekrarı hata değil; belge yazımı ve bilinmeyen eylem hata", () => {
  const acilis = new Set([ID_A, ID_B]);
  const sonuc = bostakileriSiniflandir(
    [
      { kimlik: ID_A, belgeYazimi: false, bayt: 2, argumanSayisi: 0, durum: 200 },
      { kimlik: ID_C, belgeYazimi: false, bayt: 6, argumanSayisi: 1, durum: 200 },
      // Açılışta görülmüş kimlik bile belge yazıyorsa HATA (hayalet kayıt).
      { kimlik: ID_B, belgeYazimi: true, bayt: 900, argumanSayisi: 2, durum: 200 },
    ] as Istek[],
    acilis,
  );
  assert.deepEqual(sonuc.map((i: { tur: string }) => i.tur), ["acilis-tekrari", "beklenmeyen", "belge-yazimi"]);
  assert.deepEqual(sonuc.map(hataMi), [false, true, true]);
});

test("rapor satırı içerik taşımaz, ad ve biçim taşır", () => {
  const satir = anlat({ kimlik: ID_A, ad: "saveManuscript", tur: "belge-yazimi", belgeYazimi: true, bayt: 812, argumanSayisi: 2, durum: 200 });
  assert.equal(satir, "saveManuscript [0076c96023fc] belge-yazimi, POST, gövde 812 bayt, 2 argüman, yanıt 200");
  assert.match(anlat({ kimlik: ID_C, tur: "beklenmeyen", bayt: 1, argumanSayisi: null, durum: null }), /\(adı çözülemedi\).*\? argüman, yanıt bekliyor/);
});
