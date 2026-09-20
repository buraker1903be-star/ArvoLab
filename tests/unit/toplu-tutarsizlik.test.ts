import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { taranacakCalismalar, type TaramaAdayi } from "@/lib/toplu-tutarsizlik";

const aday = (parca: Partial<TaramaAdayi> & { id: string }): TaramaAdayi => ({
  onayli: false,
  kelime: 5000,
  guncellendi: "2026-09-20T10:00:00Z",
  ...parca,
});

describe("toplu tutarsızlık taraması", () => {
  test("onaylanmış çalışma taranmaz", () => {
    // Kontrolör kararını vermiş; her listelemede uyarı göstermek kararını sorgulamak olur.
    assert.deepEqual(taranacakCalismalar([aday({ id: "a", onayli: true }), aday({ id: "b" })]), ["b"]);
  });

  test("yazılmamış müsvedde taranmaz", () => {
    /*
      Denetim 200 karakterden kısa metinde zaten hiçbir şey söylemiyor;
      tam metnini çekmek boşuna maliyet olurdu.
    */
    assert.deepEqual(taranacakCalismalar([aday({ id: "a", kelime: 0 }), aday({ id: "b", kelime: 39 })]), []);
    assert.deepEqual(taranacakCalismalar([aday({ id: "c", kelime: 40 })]), ["c"]);
  });

  test("sınır aşılınca en taze çalışmalar seçilir", () => {
    const adaylar = [
      aday({ id: "eski", guncellendi: "2026-01-01T00:00:00Z" }),
      aday({ id: "taze", guncellendi: "2026-09-19T00:00:00Z" }),
      aday({ id: "orta", guncellendi: "2026-05-01T00:00:00Z" }),
    ];
    assert.deepEqual(taranacakCalismalar(adaylar, 2), ["taze", "orta"]);
  });

  test("tarih bilinmeyen kayıt sona düşer ama elenmez", () => {
    const adaylar = [aday({ id: "tarihsiz", guncellendi: null }), aday({ id: "tarihli" })];
    assert.deepEqual(taranacakCalismalar(adaylar), ["tarihli", "tarihsiz"]);
  });

  test("sınır sıfır ya da liste boşken sorgu üretilmez", () => {
    assert.deepEqual(taranacakCalismalar([]), []);
    assert.deepEqual(taranacakCalismalar([aday({ id: "a" })], 0), []);
  });
});
