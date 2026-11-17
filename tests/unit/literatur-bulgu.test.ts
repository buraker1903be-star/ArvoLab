import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LITERATUR_KODLARI, LITERATUR_SABLONLARI, literaturBulgulari } from "../../lib/ai/literatur-bulgu";
import { eklenenYazarlar, kayitliLiteraturCevabi, literaturIstemi, taramaCozumle } from "../../lib/ai/literatur-taramasi";
import { kunyeIziMetinde } from "../../lib/ai/bulgu";

/*
  Literatür bulguları: kod → iki dilli sunucu şablonu (PR #105, 17.11.2026).
  Modelin serbest başlık/açıklaması kullanıcıya hiçbir yoldan ulaşmamalı:
  yeni cevap, kayıtlı cevap, geçmiş listesi. Arama dizeleri AYRI bir yüzey;
  oradaki kalan risk aşağıda "BİLİNEN AÇIK" olarak sabit.
*/

const BILINEN_ORNEKLER = [
  "Weiss'i okuyun.",
  "Weiss'e bakın.",
  "Weiss gibi kuramcıların yaklaşımı",
  "Weiss bu konuda öncüdür.",
  "Weiss’in çalışmalarına bakın.",
  "kaynaklar (Peplau & Perlman, Weiss vb.)",
];
const metinleri = (bulgular: { baslik: string; aciklama: string }[]) => bulgular.map((b) => `${b.baslik} ${b.aciklama}`).join("\n");

describe("literatür bulguları: kod → şablon", () => {
  test("geçerli kodun yanındaki serbest başlık/açıklama yok sayılır; metin şablondan, iki dilde", () => {
    const satir = { kod: "kuram_kaynagi_eksik", tur: "uyari", baslik: "Weiss'i okuyun", aciklama: "Peplau & Perlman, Weiss vb." };
    const tr = literaturBulgulari([satir], "tr").bulgular[0];
    const en = literaturBulgulari([satir], "en").bulgular[0];
    assert.deepEqual(tr, { kod: "kuram_kaynagi_eksik", tur: "uyari", ...{ baslik: LITERATUR_SABLONLARI.kuram_kaynagi_eksik.baslik.tr, aciklama: LITERATUR_SABLONLARI.kuram_kaynagi_eksik.aciklama.tr } });
    assert.equal(en.baslik, "Theoretical framework sources missing");
    assert.doesNotMatch(metinleri([tr, en]), /Weiss|Peplau/);
  });

  test("bilinmeyen/eksik kod düşer; geçersiz tur şablonun varsayılanını alır; yinelenen kod bir kez", () => {
    const { bulgular, dusen } = literaturBulgulari([
      { kod: "uydurma_kod", tur: "uyari", baslik: "x", aciklama: "y" },
      { tur: "uyari", baslik: "Kodsuz", aciklama: "Weiss'i okuyun." },
      { kod: "yil_dagilimi_eski", tur: "kritik" },
      { kod: "yil_dagilimi_eski", tur: "bilgi" },
      "düz metin",
      null,
    ]);
    assert.equal(dusen, 4);
    assert.deepEqual(bulgular.map((b) => [b.kod, b.tur]), [["yil_dagilimi_eski", "uyari"]]);
  });

  test("şablonların kendisi öneri taşımaz: özel ad kalıbı, künye izi ve rakam yok; sınırlar içinde", () => {
    for (const kod of LITERATUR_KODLARI) {
      for (const dil of ["tr", "en"] as const) {
        const { baslik, aciklama } = LITERATUR_SABLONLARI[kod];
        const metin = `${baslik[dil]} ${aciklama[dil]}`;
        assert.ok(baslik[dil] && aciklama[dil], `${kod}/${dil} boş`);
        assert.ok(baslik[dil].length <= 60 && aciklama[dil].length <= 400, `${kod}/${dil} uzun`);
        assert.deepEqual(eklenenYazarlar(metin, ""), [], `${kod}/${dil}`);
        assert.equal(kunyeIziMetinde(metin), false, `${kod}/${dil}`);
        assert.doesNotMatch(metin, /\d/, `${kod}/${dil} rakam içeriyor`);
      }
    }
  });

  test("istem kodları şablonla aynı kaynaktan listeler ve serbest açıklama istemez", () => {
    const sistem = literaturIstemi({ arastirmaSorusu: "Uzaktan öğrenim yalnızlığı nasıl etkiler?" }).mesajlar[0].metin;
    for (const kod of LITERATUR_KODLARI) assert.ok(sistem.includes(`- ${kod}:`), kod);
    assert.match(sistem, /"bulgular":\[\{"kod":/);
    assert.doesNotMatch(sistem, /"aciklama"/);
  });
});

describe("bilinen öneri örnekleri bulgu metninden kullanıcıya ulaşmaz", () => {
  test("modelin bulgu alanlarına yazdığı her biçim gösterilmez", () => {
    const ham = JSON.stringify({
      aramalar: [],
      bulgular: [
        ...BILINEN_ORNEKLER.map((ornek) => ({ kod: "kuram_kaynagi_eksik", tur: "uyari", baslik: ornek, aciklama: ornek })),
        ...BILINEN_ORNEKLER.map((ornek) => ({ tur: "oneri", baslik: ornek.slice(0, 60), aciklama: ornek })),
      ],
    });
    for (const dil of ["tr", "en"] as const) {
      const { bulgular } = taramaCozumle(ham, dil);
      assert.equal(bulgular.length, 1, "geçerli kod bir kez, kodsuz satırlar düşer");
      assert.doesNotMatch(metinleri(bulgular), /Weiss|Peplau|Perlman/);
    }
  });

  test("RC06k gerçek çıktısı (kodsuz eski biçim): bulgu gösterilmez, arama dizeleri kalır", () => {
    const rc06k = JSON.parse(readFileSync(new URL("../fixtures/rc06k-haiku-literatur.json", import.meta.url), "utf8")) as { baglam: string; bulgular: unknown[]; aramalar: string[] };
    const sonuc = taramaCozumle(JSON.stringify({ aramalar: rc06k.aramalar, bulgular: rc06k.bulgular }));
    assert.deepEqual(sonuc.bulgular, []);
    assert.equal(sonuc.aramalar.length, rc06k.aramalar.length);
  });

  test("meşru girdi yasaklanmaz: 'Türkiye'nin araştırma politikaları' soruda geçince bulgu ve arama dizesi gösterilir", () => {
    const { kaynak } = literaturIstemi({ arastirmaSorusu: "Türkiye'nin araştırma politikaları doktora öğrencilerinin yayın üretimini nasıl etkiler?" });
    const ham = JSON.stringify({
      aramalar: ['"Türkiye\'nin araştırma politikaları" AND ("doktora" OR "lisansüstü")'],
      bulgular: [{ kod: "gri_literatur", tur: "oneri", baslik: "Türkiye'nin araştırma politikaları", aciklama: "x" }],
    });
    const sonuc = taramaCozumle(ham);
    // Bulgu yolunda ad süzgeci YOK: kod geçerliyse şablon gösterilir, gereksiz düşme olmaz.
    assert.equal(sonuc.bulgular.length, 1);
    // Arama dizesi girdide geçen ifadeyi taşıyor: serbest.
    const kayitli = kayitliLiteraturCevabi(sonuc, kaynak);
    assert.equal(kayitli.aramalar.length, 1);
    assert.equal(kayitli.dusenArama, 0);
  });
});

describe("kayıtlı cevaplar", () => {
  test("eski kayıt (kodsuz serbest bulgular) gösterilmez ve sayılır; arama dizeleri süzgeçten geçer", () => {
    const eski = {
      bulgular: [
        { tur: "uyari", baslik: "Teorik çerçeve", aciklama: "Kaynaklar (Peplau & Perlman, Weiss vb.) eksiktir." },
        { tur: "bilgi", baslik: "Okuma", aciklama: "Weiss'i okuyun." },
      ],
      aramalar: ['"loneliness" AND "distance learning"', '"Hawkley & Cacioppo" AND loneliness'],
    };
    const sonuc = kayitliLiteraturCevabi(eski, "### Araştırma sorusu\nUzaktan öğrenim yalnızlığı nasıl etkiler?");
    assert.deepEqual(sonuc.bulgular, []);
    assert.equal(sonuc.dusenBulgu, 2);
    assert.deepEqual(sonuc.aramalar, ['"loneliness" AND "distance learning"']);
    assert.equal(sonuc.dusenArama, 1);
  });

  test("yeni kayıt (kodlu) yeniden şablondan, istenen dilde çizilir", () => {
    const yeni = { bulgular: [{ kod: "tarama_plani", tur: "bilgi", baslik: "Tarama planı", aciklama: "…" }], aramalar: [] };
    assert.equal(kayitliLiteraturCevabi(yeni, "", "en").bulgular[0].baslik, "Search plan");
  });

  /*
    Kayıtlı cevap dönüştürülemese bile eylem modele KENDİLİĞİNDEN gitmez.
    Eylem Next'e bağlı olduğu için kaynak düzeyinde sınanır: kayıtlı cevap
    dalı koşulsuz döner ve hak kontrolünden (asistanHakkiVar) önce gelir.
  */
  test("eylem: kayıtlı cevap dalı koşulsuz döner, ücretli çağrıya düşmez", () => {
    const kod = readFileSync(new URL("../../app/actions/ai-literatur.ts", import.meta.url), "utf8");
    const dal = kod.indexOf("if (onceki) {");
    const hak = kod.indexOf("await asistanHakkiVar(");
    assert.ok(dal > 0 && hak > dal, "kayıtlı cevap dalı hak kontrolünden önce olmalı");
    const govde = kod.slice(dal, hak);
    assert.match(govde, /kayitliLiteraturCevabi\(/);
    assert.match(govde, /return \{/);
    assert.doesNotMatch(govde, /sor\(/);
  });
});

/*
  BİLİNEN AÇIK — ARAMA DİZELERİ. Bulgu şablonları bütün cevap için garanti
  DEĞİLDİR: arama dizeleri hâlâ modelin serbest metni. kunyeIzi ve yazar
  önerisi izi yalnızca belirli biçimleri yakalıyor; aşağıdakiler GEÇİYOR.
  Arama üretimi bu PR'da yeniden tasarlanmadı.
*/
describe("BİLİNEN AÇIK: arama dizelerinde serbest metin", () => {
  test("tek yazarlı ad içeren arama dizesi kullanıcıya ulaşabiliyor", () => {
    const ham = JSON.stringify({ aramalar: ['"Weiss" AND "loneliness"', 'loneliness AND Weiss theory'], bulgular: [] });
    const sonuc = taramaCozumle(ham);
    const kayitli = kayitliLiteraturCevabi(sonuc, "");
    assert.equal(kayitli.aramalar.length, 2, "açık kapanmış görünüyor: rapor ve testi güncelleyin");
  });
});
