import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { birimIlerlemesi, siradakiAdimlar, type CalismaOzeti } from "@/lib/calisma-ozeti";

const CALISMA = {
  id: "c1",
  title: "Harmanlanmış öğrenme ve özyeterlik",
  project_type: "thesis",
  status: "writing",
  progress: 40,
  university: "Ankara Üniversitesi",
  institute: null,
  department: null,
  citation_style: "apa7",
  research_method: "quantitative",
  due_date: null,
  priority: "normal",
  assignee_name: null,
  updated_at: "2026-09-20T10:00:00Z",
};

const ozet = (parca: Partial<CalismaOzeti> = {}): CalismaOzeti => ({
  calisma: CALISMA,
  musvedde: null,
  literatur: { toplam: 0, okunan: 0, kullanilan: 0 },
  kaynakca: null,
  belgeSayisi: 0,
  danismanlikSayisi: 0,
  ...parca,
});

const adim = (o: CalismaOzeti, anahtar: string) => siradakiAdimlar(o).find((a) => a.anahtar === anahtar)!;

describe("çalışmanın birimleri", () => {
  test("boş çalışmada hiçbir adım tamamlanmış görünmez", () => {
    const adimlar = siradakiAdimlar(ozet());
    assert.deepEqual(adimlar.map((a) => a.tamam), [false, false, false, false]);
    assert.equal(birimIlerlemesi(adimlar), 0);
  });

  test("her birim kendi sayfasına götürür", () => {
    // "Ekosistem" tam olarak bu: birimler birbirine bağlı ve tek tıkla erişilir.
    const o = ozet();
    assert.equal(adim(o, "literatur").href, "/dashboard/literature");
    assert.equal(adim(o, "yazim").href, "/dashboard/editor/c1/write");
    assert.equal(adim(o, "kaynakca").href, "/dashboard/citations");
    assert.equal(adim(o, "belge").href, "/dashboard/documents");
  });

  test("kayıt varsa adım tamamlanır ve sayılar açıklamada geçer", () => {
    const o = ozet({
      literatur: { toplam: 12, okunan: 7, kullanilan: 3 },
      musvedde: { kelime: 5400, guncellendi: "2026-09-20T09:00:00Z" },
    });
    assert.equal(adim(o, "literatur").tamam, true);
    assert.match(adim(o, "literatur").aciklama, /12 kaynak kayıtlı, 7 okundu, 3 kullanıldı/);
    assert.equal(adim(o, "yazim").tamam, true);
    assert.match(adim(o, "yazim").aciklama, /5\.400 kelime/);
  });

  test("boş müsvedde yazım adımını tamamlamaz", () => {
    // Kayıt satırı var ama içi boş: "yazıldı" saymak kullanıcıyı yanıltır.
    const o = ozet({ musvedde: { kelime: 0, guncellendi: "2026-09-20T09:00:00Z" } });
    assert.equal(adim(o, "yazim").tamam, false);
  });

  test("kaynakça açıklaması çalışmanın durumuna göre değişir", () => {
    assert.match(adim(ozet(), "kaynakca").aciklama, /Metin ve kaynaklar hazır olunca/);
    assert.match(
      adim(ozet({ musvedde: { kelime: 900, guncellendi: "x" } }), "kaynakca").aciklama,
      /henüz denetlenmedi/,
    );
    assert.match(
      adim(ozet({ kaynakca: { id: "k1", skor: 88, tarih: "2026-09-20T09:00:00Z" } }), "kaynakca").aciklama,
      /APA uyum 88\/100/,
    );
  });

  test("birim ilerlemesi tamamlanan adımların oranıdır", () => {
    const o = ozet({
      literatur: { toplam: 3, okunan: 1, kullanilan: 1 },
      musvedde: { kelime: 100, guncellendi: "x" },
    });
    assert.equal(birimIlerlemesi(siradakiAdimlar(o)), 50);
  });
});
