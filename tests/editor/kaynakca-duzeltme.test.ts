import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { EditorState } from "@tiptap/pm/state";
import { history, undo } from "@tiptap/pm/history";
import { kaynakcaDuzeltmeIslemi } from "@/app/dashboard/editor/[id]/write/editor-navigation";
import { kunyeAnahtari } from "@/lib/kaynak-pdf";
import { belge, baslik, paragraf } from "./ortam";

/*
  HAZIR DÜZELTMELERİN BELGEYE YAZILMASI. Üç kuralı gerçek bir
  ProseMirror belgesinde sabitler: tek geri alma adımı, satırın
  METİNDEN eşleşmesi (konumdan değil) ve bulunamayan düzeltmenin
  "uygulandı" sayılmaması.
*/

const ESKI_A = "Yılmaz A 2020 Öğrenme stilleri Eğitim Dergisi 12 3 45-60";
const YENI_A = "Yılmaz, A. (2020). Öğrenme stilleri. Eğitim Dergisi, 12(3), 45-60.";
const ESKI_B = "Demir B 2019 Motivasyonun rolü Psikoloji Dergisi 8 1 10-25";
const YENI_B = "Demir, B. (2019). Motivasyonun rolü. Psikoloji Dergisi, 8(1), 10-25.";

const duzeltme = (eski: string, yeni: string) => ({ anahtar: kunyeAnahtari(eski), parcalar: [{ text: yeni }] });

const durum = (...kunyeler: string[]) =>
  EditorState.create({
    doc: belge(baslik(1, "Giriş"), paragraf("Gövde metni burada."), baslik(1, "Kaynakça"), ...kunyeler.map((k) => paragraf(k))),
    plugins: [history()],
  });
const metin = (s: EditorState) => s.doc.textBetween(0, s.doc.content.size, "\n");

describe("hazır düzeltmelerin uygulanması", () => {
  test("seçilen künyeler değişiyor, gövde metni duruyor", () => {
    const s = durum(ESKI_A, ESKI_B);
    const tr = s.tr;
    const sayi = kaynakcaDuzeltmeIslemi(tr, [duzeltme(ESKI_A, YENI_A), duzeltme(ESKI_B, YENI_B)]);
    const yeni = s.apply(tr);
    assert.equal(sayi, 2);
    assert.match(metin(yeni), new RegExp(YENI_A.replace(/[.()]/g, "\\$&")));
    assert.match(metin(yeni), new RegExp(YENI_B.replace(/[.()]/g, "\\$&")));
    assert.match(metin(yeni), /Gövde metni burada\./);
    assert.doesNotMatch(metin(yeni), /Yılmaz A 2020/);
  });

  test("iki düzeltme TEK geri alma adımıyla kalkıyor", () => {
    const s = durum(ESKI_A, ESKI_B);
    const tr = s.tr;
    kaynakcaDuzeltmeIslemi(tr, [duzeltme(ESKI_A, YENI_A), duzeltme(ESKI_B, YENI_B)]);
    const uygulanmis = s.apply(tr);
    let geri = uygulanmis;
    undo(uygulanmis, (t) => { geri = uygulanmis.apply(t); });
    assert.match(metin(geri), /Yılmaz A 2020/);
    assert.match(metin(geri), /Demir B 2019/);
    assert.doesNotMatch(metin(geri), /Yılmaz, A\. \(2020\)/);
  });

  test("seçilmeyen künyeye dokunulmuyor", () => {
    const s = durum(ESKI_A, ESKI_B);
    const tr = s.tr;
    const sayi = kaynakcaDuzeltmeIslemi(tr, [duzeltme(ESKI_B, YENI_B)]);
    const yeni = s.apply(tr);
    assert.equal(sayi, 1);
    assert.match(metin(yeni), /Yılmaz A 2020/);
    assert.match(metin(yeni), new RegExp(YENI_B.replace(/[.()]/g, "\\$&")));
  });

  /*
    Denetimden sonra kaynakça değişmiş olabilir: eşleşmeyen düzeltme
    ATLANIR. Konuma (indekse) güvenseydik yanlış satır değişirdi.
  */
  test("kaynakçada bulunmayan künye uygulanmıyor ve sayıya girmiyor", () => {
    const s = durum(ESKI_A);
    const tr = s.tr;
    const sayi = kaynakcaDuzeltmeIslemi(tr, [duzeltme(ESKI_B, YENI_B)]);
    assert.equal(sayi, 0);
    assert.equal(metin(s.apply(tr)), metin(s));
  });

  test("sıra değişmiş olsa bile doğru satır değişiyor", () => {
    /* Denetimden sonra araya yeni bir künye girmiş. */
    const s = durum("Kaya, C. (2021). Sonradan eklenen kaynak. Başka Dergi.", ESKI_A);
    const tr = s.tr;
    const sayi = kaynakcaDuzeltmeIslemi(tr, [duzeltme(ESKI_A, YENI_A)]);
    const yeni = s.apply(tr);
    assert.equal(sayi, 1);
    assert.match(metin(yeni), /Sonradan eklenen kaynak/);
    assert.match(metin(yeni), new RegExp(YENI_A.replace(/[.()]/g, "\\$&")));
  });

  test("Kaynakça bölümü yoksa hiçbir şey yapılmıyor", () => {
    const s = EditorState.create({ doc: belge(baslik(1, "Giriş"), paragraf(ESKI_A)), plugins: [history()] });
    const tr = s.tr;
    assert.equal(kaynakcaDuzeltmeIslemi(tr, [duzeltme(ESKI_A, YENI_A)]), 0);
    assert.equal(metin(s.apply(tr)), metin(s));
  });

  test("boş düzeltme listesi belgeye dokunmuyor", () => {
    const s = durum(ESKI_A);
    const tr = s.tr;
    assert.equal(kaynakcaDuzeltmeIslemi(tr, []), 0);
    assert.equal(metin(s.apply(tr)), metin(s));
  });
});
