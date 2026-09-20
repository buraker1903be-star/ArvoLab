import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { atifStiliCelisiyorMu, birimIlerlemesi, siradakiAdimlar, type CalismaOzeti } from "@/lib/calisma-ozeti";

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
  guideline_id: null,
};

const ozet = (parca: Partial<CalismaOzeti> = {}): CalismaOzeti => ({
  calisma: CALISMA,
  hazirlik: null,
  musvedde: null,
  literatur: { toplam: 0, okunan: 0, kullanilan: 0 },
  kaynakca: null,
  belgeSayisi: 0,
  danismanlikSayisi: 0,
  asistan: { toplam: 0, sonTarih: null, sonBulgular: [] },
  tutarsizliklar: [],
  kilavuz: null,
  ...parca,
});

const adim = (o: CalismaOzeti, anahtar: string) => siradakiAdimlar(o).find((a) => a.anahtar === anahtar)!;

describe("çalışmanın birimleri", () => {
  test("boş çalışmada hiçbir adım tamamlanmış görünmez", () => {
    const adimlar = siradakiAdimlar(ozet());
    assert.deepEqual(adimlar.map((a) => a.tamam), [false, false, false, false]);
    assert.equal(birimIlerlemesi(adimlar), 0);
  });

  test("her birim kendi sayfasına, çalışma kimliğini taşıyarak götürür", () => {
    /*
      "Ekosistem" tam olarak bu: birimler birbirine bağlı ve tek tıkla
      erişilir. Kimlik bağlantıda taşınıyor ki hedef sayfa çalışmayı hazır
      seçsin — kullanıcı her sayfada aynı seçimi tekrar yapmasın.
    */
    const o = ozet();
    assert.equal(adim(o, "literatur").href, "/dashboard/literature?calisma=c1");
    assert.equal(adim(o, "yazim").href, "/dashboard/editor/c1/write");
    assert.equal(adim(o, "kaynakca").href, "/dashboard/citations?calisma=c1");
    assert.equal(adim(o, "belge").href, "/dashboard/documents?calisma=c1");
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

describe("birimler arası tutarlılık", () => {
  /*
    Ekosistemin asıl işi: iki birim ayrı ayrı doğru ama birlikte yanlışsa
    bunu kimse fark etmiyordu. Çalışma APA 7'ye ayarlı, kurumun kılavuzu
    Vancouver istiyorsa kullanıcı bunu ancak jüriden öğreniyordu.
  */
  const kilavuz = (atifStili: string | null) => ({
    id: "k1", baslik: "Tez Yazım Kılavuzu", surum: "v2",
    kurum: "Ankara Üniversitesi", enstitu: null, atifStili,
  });

  test("kılavuz başka stil istiyorsa çelişki bildirilir", () => {
    assert.equal(atifStiliCelisiyorMu(ozet({ kilavuz: kilavuz("vancouver") })), true);
  });

  test("aynı stilde çelişki yok", () => {
    assert.equal(atifStiliCelisiyorMu(ozet({ kilavuz: kilavuz("apa7") })), false);
  });

  test("kılavuz yoksa ya da stili belirtilmemişse uyarı verilmez", () => {
    // Bilgisizlik çelişki değildir; yanlış alarm güveni yıpratır.
    assert.equal(atifStiliCelisiyorMu(ozet()), false);
    assert.equal(atifStiliCelisiyorMu(ozet({ kilavuz: kilavuz(null) })), false);
  });
});
