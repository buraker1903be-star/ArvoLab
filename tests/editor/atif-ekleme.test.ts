import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import { aiAtiflariniBagla, atifIslemi, kaynakcaGirdisiIslemi } from "@/app/dashboard/editor/[id]/write/editor-navigation";
import { belge, baslik, editorSchema, paragraf } from "./ortam";

/*
  ALINTI + ATIF TEK İŞLEMDE (20.11.2026, canlı deneme). Eskiden PDF'ten
  alıntı ayrı bir işlemle, önüne boşluk konmadan yazılıyordu
  ("tanımlanmıştır“…”"), atıf üretilemezse alıntı atıfsız kalıyordu ve
  Ctrl+Z ikisini ayrı ayrı geri alıyordu. Bu dosya gerçek ProseMirror
  belgesi ve geçmiş eklentisiyle sabitler.
*/
const kaynak = { title: "Seasonal patterns in synthetic data", authors: "Fisher, E. W., & Other, J.", year: "2023", source_type: "article", doi_or_url: null, container_title: "Journal of Science & Society" };
const ALINTI = "Seasonal variation explained most of the observed difference.";

function durum(doc = belge(baslik(1, "Giriş"), paragraf("Önceki çalışmalar şöyle tanımlar"))) {
  return EditorState.create({ doc, plugins: [history()] });
}
const metin = (s: EditorState) => s.doc.textBetween(0, s.doc.content.size, "\n");
/* "Önceki çalışmalar şöyle tanımlar" paragrafının içindeki konumlar (başlık 7 düğüm boyu). */
const PARAGRAF_BASI = 8;
const PARAGRAF_SONU = PARAGRAF_BASI + "Önceki çalışmalar şöyle tanımlar".length;

describe("alıntı ve atıf", () => {
  test("sözcük sonuna: önce boşluk, sonra alıntı, boşluk, atıf; kaynakça açılır", () => {
    const s = durum();
    const tr = s.tr;
    const sonuc = atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    const yeni = s.apply(tr);
    assert.equal(sonuc.addedReference, true);
    assert.match(metin(yeni), /tanımlar “Seasonal variation explained most of the observed difference\.” \(Fisher ve Other, 2023\)\nKaynakça\nFisher, E\. W\., & Other, J\./);
  });

  test("eklenen alıntı seçilen metnin birebir aynısı (sözcük ortasında biten seçim dahil)", () => {
    const yarim = "Seasonal variation expl";
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: yarim, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    assert.ok(metin(s.apply(tr)).includes(`“${yarim}”`));
  });

  test("tek geri alma alıntıyı, atfı ve kaynakça girdisini birlikte kaldırır", () => {
    const s = durum();
    const tr = s.tr;
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    let yeni = s.apply(tr);
    undo(yeni, (t) => (yeni = yeni.apply(t)));
    assert.equal(metin(yeni), metin(s));
  });

  test("kayıtlı konuma yazar; işlemin seçimi başka yerdeyse de", () => {
    const s = durum();
    const tr = s.tr.setSelection(TextSelection.create(s.doc, 2)); // seçim başlıkta
    atifIslemi(tr, kaynak, "apa7", { alinti: ALINTI, konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
    const yeni = s.apply(tr);
    assert.ok(metin(yeni).startsWith("Giriş\nÖnceki çalışmalar şöyle tanımlar “"), metin(yeni));
  });

  test("boşluktan, parantezden sonra ve paragraf başında fazladan boşluk yok; sözcük ortasında arkaya boşluk", () => {
    const bosluk = durum(belge(paragraf("Metin ")));
    const t1 = bosluk.tr;
    atifIslemi(t1, kaynak, "apa7", { konum: { from: 7, to: 7 } });
    assert.ok(metin(bosluk.apply(t1)).startsWith("Metin (Fisher ve Other, 2023)"));

    const bas = durum(belge(paragraf("Metin")));
    const t2 = bas.tr;
    atifIslemi(t2, kaynak, "apa7", { alinti: ALINTI, konum: { from: 1, to: 1 } });
    assert.ok(metin(bas.apply(t2)).startsWith(`“${ALINTI}” (Fisher ve Other, 2023) Metin`), metin(bas.apply(t2)));
  });

  test("aynı kaynağa ikinci atıf kaynakçayı yinelemez", () => {
    let s = durum();
    for (let i = 0; i < 2; i++) {
      const tr = s.tr;
      atifIslemi(tr, kaynak, "apa7", { konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
      s = s.apply(tr);
    }
    assert.equal(metin(s).split("Seasonal patterns in synthetic data").length - 1, 1, metin(s));
  });

  /*
    KÜNYE ÇALIŞMANIN STİLİNDE YAZILIYOR. Atıf eklemenin kaynakçayı
    kendiliğinden kurması ancak doğru BİÇİMDE kurarsa işe yarar; stil
    geçirilmezse ya da biçimleyici stili tanımazsa künye sessizce APA
    çıkar ve öğrenci bunu ancak danışmanından öğrenir.
  */
  test("kaynakça girdisi çalışmanın stiline göre yazılıyor", () => {
    const yaz = (stil: Parameters<typeof atifIslemi>[2]) => {
      const s = durum();
      const tr = s.tr;
      atifIslemi(tr, kaynak, stil, { konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU } });
      return metin(s.apply(tr)).split("\nKaynakça\n")[1] ?? "";
    };
    const apa = yaz("apa7");
    const ieee = yaz("ieee");
    const chicagoNotlar = yaz("chicago-notlar");
    assert.match(apa, /^Fisher, E\. W\., & Other, J\. \(2023\)\./);
    assert.match(ieee, /^\[1\] E\. W\. Fisher/);
    /*
      Chicago Notlar–Kaynakça: yıl SONDA. Yazar–tarih sürümünde yazardan
      hemen sonra gelirdi ("Fisher, E. W. 2023. …"); ikisini aynı saymak
      öğrenciye yanlış kaynakça yazmak olurdu.
    */
    assert.match(chicagoNotlar, /\(2023\)\.$/);
    assert.doesNotMatch(chicagoNotlar, /^Fisher[^.]*\.\s*2023\./);
    assert.equal(new Set([apa, ieee, chicagoNotlar]).size, 3, `${apa} | ${ieee} | ${chicagoNotlar}`);
  });

  test("hazır (CSL) atıf ve dipnot biçimi de aynı işlemde", () => {
    const s = durum();
    const tr = s.tr;
    const r = atifIslemi(tr, kaynak, "apa7", {
      alinti: ALINTI,
      konum: { from: PARAGRAF_SONU, to: PARAGRAF_SONU },
      hazir: { atif: [{ text: "Fisher ve Other, 2023, s. 4." }], kunye: [{ text: "Fisher, E. W. ve Other, J. 2023." }], dipnot: true },
    });
    const yeni = s.apply(tr);
    assert.equal(r.citation, "Fisher ve Other, 2023, s. 4.");
    let dipnot = 0;
    yeni.doc.descendants((n) => {
      if (n.type.name === "footnoteReference") dipnot++;
    });
    assert.equal(dipnot, 1);
    assert.ok(metin(yeni).includes(`tanımlar “${ALINTI}”`));
  });
});

test("şema: editorSchema yüklendi", () => assert.ok(editorSchema.nodes.footnoteReference));

/*
  B-16 (20.11.2026): yazım asistanının metni ve eşleşen kaynağın künyesi
  AYNI işlemde girer. Eskiden metin düz atıfla giriyor, Kaynakça hiç
  güncellenmiyordu; ayrı işlem olsaydı Ctrl+Z metni geri alıp künyeyi
  kaynakçada yetim bırakırdı.
*/
test("B-16: AI metni ve künyesi tek işlemde; tek geri alma ikisini birlikte kaldırır; olan künye yinelenmez", () => {
  let s = EditorState.create({ doc: belge(baslik(1, "Giriş"), paragraf("Önceki çalışmalar")), plugins: [history()] });
  const tr = s.tr.insert(s.doc.content.size, editorSchema.nodeFromJSON({ type: "paragraph", content: [{ type: "text", text: "Mevsimsel örüntüler belirgindir (Fisher & Other, 2023)." }] }));
  assert.equal(kaynakcaGirdisiIslemi(tr, kaynak, "apa7", { dil: "tr" }), true);
  s = s.apply(tr);
  assert.match(metin(s), /Kaynakça\nFisher, E\. W\., & Other, J\. \(2023\)/);
  const tr2 = s.tr;
  assert.equal(kaynakcaGirdisiIslemi(tr2, kaynak, "apa7", { dil: "tr" }), false, "künye zaten kaynakçada");
  assert.equal(tr2.docChanged, false);
  undo(s, (u) => (s = s.apply(u)));
  assert.equal(metin(s), "Giriş\nÖnceki çalışmalar");
});

/*
  B-16 ikinci adım (20.11.2026): AI metnindeki tekil eşleşen atıf, atıf
  altyapısıyla belgenin STİLİNDE yeniden üretilir. Eskiden IEEE ya da
  dipnotlu belgede metinde yazar–tarih atfı kalıyordu.
*/
describe("B-16: AI atıfları belgenin stilinde", () => {
  const izli = (metin: string) => ({ type: "text", text: metin, marks: [{ type: "asistanIzi", attrs: { kayit: "k1" } }] });
  const aiDurum = (metin: string) =>
    EditorState.create({ doc: belge(baslik(1, "Giriş"), { type: "paragraph", content: [izli(metin)] }), plugins: [history()] });
  const fisher = kaynak;
  const bul = (atif: string) => (/Fisher/.test(atif) ? fisher : null);
  const uygula = (s: EditorState, style: "apa7" | "ieee" | "dipnot") => {
    const tr = s.tr;
    const sonuc = aiAtiflariniBagla(tr, { kayitId: "k1", kaynakBul: bul, style, secenek: { dil: "tr" } });
    return { s: s.apply(tr), sonuc };
  };

  test("APA: atıf stil biçiminde kalır, künye Kaynakça'ya; belirsiz atıf düz metin kalır", () => {
    const { s, sonuc } = uygula(aiDurum("Mevsimsel örüntüler belirgindir (Fisher & Other, 2023). Tartışmalıdır (Aras, 2020)."), "apa7");
    assert.equal(sonuc.donusen, 1);
    assert.match(metin(s), /belirgindir \(Fisher (&|ve) Other, 2023\)\. Tartışmalıdır \(Aras, 2020\)\./);
    assert.match(metin(s), /Kaynakça\nFisher, E\. W\., & Other, J\. \(2023\)/);
    assert.doesNotMatch(metin(s).split("Kaynakça")[1] ?? "", /Aras/, "belirsiz atıf kaynakçaya girmez");
  });

  test("IEEE: yazar–tarih atfı numaraya döner", () => {
    const { s } = uygula(aiDurum("Mevsimsel örüntüler belirgindir (Fisher & Other, 2023)."), "ieee");
    assert.match(metin(s), /belirgindir \[1\]\./);
    assert.doesNotMatch(metin(s), /\(Fisher/);
  });

  test("dipnot: atıf dipnot düğümü olur, metinde parantez kalmaz", () => {
    const { s } = uygula(aiDurum("Mevsimsel örüntüler belirgindir (Fisher & Other, 2023)."), "dipnot");
    let dipnot = 0;
    s.doc.descendants((n) => {
      if (n.type.name === "footnoteReference") dipnot += 1;
    });
    assert.equal(dipnot, 1);
    assert.doesNotMatch(metin(s), /\(Fisher/);
  });

  test("tek geri alma: metin dönüşümü ve künye birlikte geri alınır; iz taşımayan metne dokunulmaz", () => {
    let s = EditorState.create({ doc: belge(baslik(1, "Giriş"), paragraf("Öğrencinin kendi atfı (Fisher & Other, 2023)."), { type: "paragraph", content: [izli("AI cümlesi (Fisher & Other, 2023).")] }), plugins: [history()] });
    const tr = s.tr;
    const sonuc = aiAtiflariniBagla(tr, { kayitId: "k1", kaynakBul: bul, style: "ieee", secenek: { dil: "tr" } });
    s = s.apply(tr);
    assert.equal(sonuc.donusen, 1, "yalnızca bu asistan kaydının metni");
    assert.match(metin(s), /Öğrencinin kendi atfı \(Fisher & Other, 2023\)\.\nAI cümlesi \[1\]\./);
    undo(s, (u) => (s = s.apply(u)));
    assert.equal(metin(s), "Giriş\nÖğrencinin kendi atfı (Fisher & Other, 2023).\nAI cümlesi (Fisher & Other, 2023).");
  });
});
