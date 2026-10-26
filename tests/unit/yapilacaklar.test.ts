import assert from "node:assert/strict";
import test from "node:test";
import { ACIKLAMA_SINIRI, BASLIK_SINIRI, yapilacakGirdisi } from "@/lib/yapilacaklar";

test("başlık boşsa eklenmez; boşluklar sadeleşir", () => {
  assert.equal(yapilacakGirdisi({ baslik: "   " }), null);
  assert.deepEqual(yapilacakGirdisi({ baslik: "  Pesaran   (2001)\n atıfsız ", aciklama: "" }), {
    baslik: "Pesaran (2001) atıfsız",
    aciklama: null,
  });
});

test("veritabanı sınırını aşan metin kırpılır, reddedilmez", () => {
  const sonuc = yapilacakGirdisi({ baslik: "a".repeat(500), aciklama: "b".repeat(5000) });
  assert.equal(sonuc?.baslik.length, BASLIK_SINIRI);
  assert.equal(sonuc?.aciklama?.length, ACIKLAMA_SINIRI);
});
