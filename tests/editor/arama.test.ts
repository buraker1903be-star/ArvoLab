import assert from "node:assert/strict";
import test from "node:test";
import { findMatches, MAX_MATCHES, replaceMatches } from "@/lib/tiptap-search";
import { belge, islem, islemSonrasiMetin, paragraf } from "./ortam";

/*
  Editördeki "Bul ve değiştir". Değiştirme kullanıcının TEZ METNİNİ
  değiştiriyor ve tek bir konum kayması yanlış yeri bozar; geri alma tek
  adım olduğu için de kısmen bozulmuş bir belge bırakır.

  Türkçe küçük harf dönüşümü burada ayrıca kritik: "İ" bir karakter,
  küçük harfi de bir karakter — ama bazı dönüşümler uzunluğu DEĞİŞTİRİR ve
  konumlar kayar. Kod bu durumda büyük/küçük harf duyarsızlığından
  vazgeçip birebir aramaya düşüyor; yani doğruluk, kolaylığın önünde.
*/
test("bul ve değiştir", async (t) => {
  await t.test("boş sorgu hiçbir şey bulmuyor", () => {
    assert.deepEqual(findMatches(belge(paragraf("metin")), ""), []);
  });

  await t.test("aynı paragraftaki birden çok eşleşme bulunuyor", () => {
    const doc = belge(paragraf("kedi ve kedi ve kedi"));
    const eslesmeler = findMatches(doc, "kedi");
    assert.equal(eslesmeler.length, 3);
    // Konumlar artan sırada ve çakışmasız olmalı.
    for (let i = 1; i < eslesmeler.length; i += 1) {
      assert.ok(eslesmeler[i].from >= eslesmeler[i - 1].to, JSON.stringify(eslesmeler));
    }
  });

  await t.test("eşleşme konumu belgedeki gerçek metni gösteriyor", () => {
    const doc = belge(paragraf("Birinci paragraf."), paragraf("İkinci paragrafta AMAÇ var."));
    const [eslesme] = findMatches(doc, "AMAÇ");
    assert.ok(eslesme, "bulunmalı");
    assert.equal(doc.textBetween(eslesme.from, eslesme.to), "AMAÇ", "konum kaymış");
  });

  await t.test("büyük/küçük harf gözetilmiyor", () => {
    const doc = belge(paragraf("Araştırmanın AMACI budur."));
    assert.equal(findMatches(doc, "amacı").length, 1);
    assert.equal(findMatches(doc, "AMACI").length, 1);
  });

  await t.test("Türkçe İ/ı aramada konumu kaydırmıyor", () => {
    /*
      "İ".toLocaleLowerCase("tr-TR") bir karakter; ama bazı dizgilerde
      dönüşüm uzunluğu değiştirebiliyor. O durumda kod birebir aramaya
      düşüyor — burada sınanan şey bulunan konumun HER durumda doğru
      metni göstermesi.
    */
    const doc = belge(paragraf("İLK BÖLÜMDE İNCELEME YAPILDI"));
    for (const sorgu of ["İNCELEME", "inceleme", "BÖLÜMDE"]) {
      for (const eslesme of findMatches(doc, sorgu)) {
        assert.equal(
          doc.textBetween(eslesme.from, eslesme.to).toLocaleLowerCase("tr-TR"),
          sorgu.toLocaleLowerCase("tr-TR"),
          `${sorgu}: konum kaymış`,
        );
      }
    }
  });

  await t.test("biçim sınırını aşan eşleşme aranmıyor", () => {
    // "araştırma"nın yarısı kalın olsa iki metin düğümüne bölünür; kod
    // düğüm düğüm arıyor ve bunu bilerek kaçırıyor (yorumda yazılı).
    const doc = belge({
      type: "paragraph",
      content: [
        { type: "text", text: "araş", marks: [{ type: "bold" }] },
        { type: "text", text: "tırma" },
      ],
    });
    assert.equal(findMatches(doc, "araştırma").length, 0);
    assert.equal(findMatches(doc, "tırma").length, 1);
  });

  await t.test("sınır aşılınca arama duruyor", () => {
    const doc = belge(paragraf("a ".repeat(50).trim()));
    assert.equal(findMatches(doc, "a", 5).length, 5);
    assert.ok(findMatches(doc, "a").length <= MAX_MATCHES);
  });

  await t.test("değiştirme sondan başa yapılıyor: konumlar kaymıyor", () => {
    /*
      Bu, modülün en kritik davranışı. Baştan başa değiştirilse ilk
      değişiklik sonraki konumları kaydırır ve metin bambaşka yerlerden
      bozulur. Değiştirilen metin ÖZGÜNDEN UZUN olduğunda kayma en belirgin.
    */
    const doc = belge(paragraf("kedi ve kedi ve kedi"));
    const tr = islem(doc);
    const sayi = replaceMatches(tr, findMatches(doc, "kedi"), "kaplumbağa");
    assert.equal(sayi, 3);
    assert.equal(islemSonrasiMetin(tr), "kaplumbağa ve kaplumbağa ve kaplumbağa");
  });

  await t.test("kısa metinle değiştirmede de kaymıyor", () => {
    const doc = belge(paragraf("kaplumbağa ve kaplumbağa"));
    const tr = islem(doc);
    replaceMatches(tr, findMatches(doc, "kaplumbağa"), "kedi");
    assert.equal(islemSonrasiMetin(tr), "kedi ve kedi");
  });

  await t.test("boş değiştirme metni siliyor", () => {
    const doc = belge(paragraf("bir iki bir üç"));
    const tr = islem(doc);
    replaceMatches(tr, findMatches(doc, "bir "), "");
    assert.equal(islemSonrasiMetin(tr), "iki üç");
  });

  await t.test("birden çok paragrafta değiştirme", () => {
    const doc = belge(paragraf("kedi bir"), paragraf("kedi iki"), paragraf("kedi üç"));
    const tr = islem(doc);
    const sayi = replaceMatches(tr, findMatches(doc, "kedi"), "köpek");
    assert.equal(sayi, 3);
    assert.equal(islemSonrasiMetin(tr), "köpek bir\nköpek iki\nköpek üç");
  });
});

/*
  29.10.2026'ya kadar katlama "tr-TR" idi: "I" "ı" oluyor, İngilizce
  "Introduction" "introduction" aramasıyla HİÇ bulunmuyordu.
*/
test("İngilizce I/i büyük-küçük harf duyarsız eşleşir, Türkçe İ de", () => {
  assert.equal(findMatches(belge(paragraf("Introduction and IBM")), "introduction").length, 1);
  assert.equal(findMatches(belge(paragraf("Introduction")), "INTRODUCTION").length, 1);
  assert.equal(findMatches(belge(paragraf("İstanbul ve istanbul")), "istanbul").length, 2);
  assert.equal(findMatches(belge(paragraf("Işık")), "ışık").length, 1);
});

/*
  Phase 2 (04.11.2026): arama açıkken metne yazılınca bütün belge değil,
  yalnızca değişen bloklar taranıyor. Sonuç tam taramayla BİREBİR aynı
  olmalı: yazma, silme, bölme, biçim ve sorgunun kendisini ekleme ile.
*/
import { EditorState } from "@tiptap/pm/state";
import { eslesmeleriGuncelle } from "@/lib/tiptap-search";

test("artımlı arama güncellemesi tam taramayla aynı", () => {
  let s = 7;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sorgu = "enflasyon";
  const parcalar = [];
  for (let i = 0; i < 30; i++) parcalar.push(paragraf(`Enflasyon ${i} ve işsizlik; enflasyon beklentisi ENFLASYON dönemi ${i}.`));
  let state = EditorState.create({ doc: belge(...parcalar) });
  let eslesmeler = findMatches(state.doc, sorgu);
  let calisti = 0;
  for (let adim = 0; adim < 500; adim++) {
    const boyut = state.doc.content.size;
    const konum = 1 + Math.floor(r() * (boyut - 2));
    const tr = state.tr;
    const tur = r();
    try {
      if (tur < 0.35) tr.insertText(r() < 0.3 ? "Enflasyon" : r() < 0.5 ? "x" : "ena", konum);
      else if (tur < 0.6) tr.delete(konum, Math.min(boyut - 1, konum + 1 + Math.floor(r() * 12)));
      else if (tur < 0.75) tr.split(konum);
      else if (tur < 0.9) tr.addMark(konum, Math.min(boyut - 1, konum + 1 + Math.floor(r() * 8)), state.schema.marks.bold.create());
      else tr.removeMark(0, boyut, state.schema.marks.bold);
    } catch {
      continue;
    }
    if (!tr.docChanged) continue;
    const artimli = eslesmeleriGuncelle(eslesmeler, sorgu, tr);
    const tam = findMatches(tr.doc, sorgu);
    assert.ok(artimli, `adım ${adim}: artımlı güncelleme vazgeçti`);
    assert.deepEqual(artimli, tam, `adım ${adim}: artımlı sonuç tam taramadan farklı`);
    calisti++;
    eslesmeler = artimli;
    state = state.apply(tr);
  }
  assert.ok(calisti > 300, `sınama yeterince adım koşmadı (${calisti})`);
});

test("eşleşme sınırına ulaşılmışsa artımlı güncelleme vazgeçer (tam tarama)", () => {
  const state = EditorState.create({ doc: belge(paragraf("aa")) });
  const tr = state.tr.insertText("a", 1);
  assert.equal(eslesmeleriGuncelle(new Array(MAX_MATCHES).fill({ from: 1, to: 2 }), "a", tr), null);
});
