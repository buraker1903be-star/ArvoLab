import assert from "node:assert/strict";
import test from "node:test";
import { history, undo } from "@tiptap/pm/history";
import { Slice } from "@tiptap/pm/model";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { aralikMetni, araligiDogrula, araligiIzle, asistanAraligiEklentisi, izlenenAralik } from "@/lib/tiptap-asistan-araligi";
import { aiAdimiBaslat, aiAdiminiKapat, geriAlmaIslemi, surumGerekir, yeniAralik } from "@/lib/ai-duzenleme";
import { belge, editorSchema, paragraf } from "./ortam";

/*
  AI DÜZENLEMESİNİN KONUM GÜVENLİĞİ (Signature OS 4.3). Tarayıcısız: gerçek
  şema, gerçek ProseMirror işlemleri ve geçmiş (history) eklentisi.

  İlk test ESKİ davranışın riskini deterministik olarak gösterir: istek
  anındaki sayılarla yapılan değiştirme, arada belgeye yazılınca yanlış
  metni değiştiriyordu. Ötekiler yeni mekanizmayı ve olumsuz senaryoları
  (seçim değişti, silindi, izlenmiyor, AI metni düzenlendi) sınar.
*/

const BIRINCI = "Enflasyon kısa dönemde işsizliği düşürür.";
const IKINCI = "Uzun dönemde bu ilişki zayıflar.";

function durum(eklentiler = [asistanAraligiEklentisi()]) {
  return EditorState.create({ doc: belge(paragraf(BIRINCI), paragraf(IKINCI)), plugins: eklentiler });
}
/** İkinci paragrafın metninin [from, to] aralığı. */
const ikinciAralik = (s: EditorState) => {
  const bas = s.doc.firstChild!.nodeSize + 1;
  return { from: bas, to: bas + IKINCI.length };
};
const AI = "Uzun dönemde bu ilişki istatistiksel olarak zayıflamaktadır.";
const yaz = (s: EditorState, tr: Transaction) => s.apply(tr);

test("ESKİ YÖNTEM: istek anındaki sayılarla değiştirme, arada yazılınca YANLIŞ metni değiştirir", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  assert.equal(aralikMetni(s.doc, from, to), IKINCI);
  // Kullanıcı cevabı beklerken belgenin başına yazıyor.
  s = yaz(s, s.tr.insertText("Giriş: ", 1));
  // Eski kod: Math.min(from, boyut) ile kırpıp aynı sayılarla değiştiriyordu.
  const boyut = s.doc.content.size;
  const degisen = aralikMetni(s.doc, Math.min(from, boyut), Math.min(to, boyut));
  assert.notEqual(degisen, IKINCI, "eski yöntem başka bir metni hedefliyor");
});

test("YENİ: izlenen aralık belgeye yazıldıkça kayar, doğru metin değişir", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  s = yaz(s, araligiIzle(s.tr, "o1", from, to));
  s = yaz(s, s.tr.insertText("Giriş: ", 1));
  s = yaz(s, s.tr.insertText(" Ek cümle.", s.doc.firstChild!.nodeSize - 1));
  const d = araligiDogrula(s, "o1", IKINCI);
  assert.equal(d.tamam, true);
  if (!d.tamam) return;
  s = yaz(s, s.tr.replaceWith(d.from, d.to, editorSchema.text(AI)));
  assert.equal(s.doc.child(0).textContent, `Giriş: ${BIRINCI} Ek cümle.`);
  assert.equal(s.doc.child(1).textContent, AI);
});

test("aralığın hemen başına ya da sonuna yazılan metin aralığa katılmaz", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  s = yaz(s, araligiIzle(s.tr, "o1", from, to));
  s = yaz(s, s.tr.insertText("Ayrıca ", from));
  s = yaz(s, s.tr.insertText(" (bkz. Tablo 2)", izlenenAralik(s, "o1")!.to));
  assert.equal(araligiDogrula(s, "o1", IKINCI).tamam, true);
});

test("seçimin içi değişirse değiştirme REDDEDİLİR", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  s = yaz(s, araligiIzle(s.tr, "o1", from, to));
  s = yaz(s, s.tr.insertText("çok ", from + "Uzun dönemde bu ilişki ".length));
  assert.deepEqual(araligiDogrula(s, "o1", IKINCI), { tamam: false, neden: "degisti" });
});

test("seçim silinirse değiştirme REDDEDİLİR (boşa çıkan aralığa yazılmaz)", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  s = yaz(s, araligiIzle(s.tr, "o1", from, to));
  s = yaz(s, s.tr.delete(from - 1, to + 1));
  assert.deepEqual(araligiDogrula(s, "o1", IKINCI), { tamam: false, neden: "silindi" });
});

test("izlenmeyen öneri uygulanmaz", () => {
  assert.deepEqual(araligiDogrula(durum(), "yok", IKINCI), { tamam: false, neden: "izlenmiyor" });
});

test("izleme belgenin JSON'una girmez (kayıt, sürüm ve çıktılar etkilenmez)", () => {
  let s = durum();
  const once = JSON.stringify(s.doc.toJSON());
  const { from, to } = ikinciAralik(s);
  s = yaz(s, araligiIzle(s.tr, "o1", from, to));
  assert.equal(JSON.stringify(s.doc.toJSON()), once);
});

/* Kabul akışının özü: AI adımı kendi geçmiş olayı, kullanıcı yazımı ayrı. */
function aiKabul(s: EditorState, from: number, to: number, metin: string) {
  const ozgun = s.doc.slice(from, to);
  let tr = aiAdimiBaslat(s.tr.replaceWith(from, to, editorSchema.text(metin, [editorSchema.marks.asistanIzi.create({ kayit: "k1" })])));
  const yeni = yeniAralik(tr, from, to);
  tr = araligiIzle(tr, "o1:eklenen", yeni.from, yeni.to);
  s = s.apply(tr);
  s = s.apply(aiAdiminiKapat(s));
  return { s, ozgun, eklenenMetin: aralikMetni(s.doc, yeni.from, yeni.to) };
}

test("Ctrl+Z: AI değişikliğinden HEMEN SONRA yazılan harfler AI adımıyla birleşmez", () => {
  let s = durum([history(), asistanAraligiEklentisi()]);
  const { from, to } = ikinciAralik(s);
  ({ s } = aiKabul(s, from, to, AI));
  // Kullanıcı yarım saniye içinde aynı paragrafın sonuna yazıyor (eskiden aynı olaya düşebilirdi).
  s = s.apply(s.tr.insertText(" Kaynak: TÜİK.", s.doc.content.size - 1));
  let geri: Transaction | undefined;
  undo(s, (tr) => (geri = tr));
  s = s.apply(geri!);
  assert.equal(s.doc.child(1).textContent, AI, "ilk Ctrl+Z yalnızca kullanıcının yazdığını geri alır");
  undo(s, (tr) => (geri = tr));
  s = s.apply(geri!);
  assert.equal(s.doc.child(1).textContent, IKINCI, "ikinci Ctrl+Z AI değişikliğini geri alır");
});

test("Ctrl+Z: AI değişikliği ÖNCESİNDE yazılanla da birleşmez", () => {
  let s = durum([history(), asistanAraligiEklentisi()]);
  s = s.apply(s.tr.insertText("Giriş: ", 1));
  const { from, to } = ikinciAralik(s);
  ({ s } = aiKabul(s, from, to, AI));
  let geri: Transaction | undefined;
  undo(s, (tr) => (geri = tr));
  s = s.apply(geri!);
  assert.equal(s.doc.child(1).textContent, IKINCI);
  assert.equal(s.doc.child(0).textContent, `Giriş: ${BIRINCI}`, "öncesinde yazılan yerinde kalır");
});

test("Geri al düğmesi yalnızca AI'ın yazdığını geri alır; başka yerdeki kullanıcı değişiklikleri kalır", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  const kabul = aiKabul(s, from, to, AI);
  s = kabul.s;
  s = s.apply(s.tr.insertText("Giriş: ", 1));
  const sonuc = geriAlmaIslemi(s, "o1:eklenen", kabul.eklenenMetin, kabul.ozgun);
  assert.ok("tr" in sonuc);
  if (!("tr" in sonuc)) return;
  s = s.apply(sonuc.tr);
  assert.equal(s.doc.child(1).textContent, IKINCI);
  assert.equal(s.doc.child(0).textContent, `Giriş: ${BIRINCI}`);
  assert.equal(s.doc.child(1).firstChild!.marks.length, 0, "özgün metin asistan izi taşımaz");
});

test("Geri al düğmesi: kullanıcı AI metnini düzenlediyse geri alma YAPILMAZ", () => {
  let s = durum();
  const { from, to } = ikinciAralik(s);
  const kabul = aiKabul(s, from, to, AI);
  s = kabul.s;
  const a = izlenenAralik(s, "o1:eklenen")!;
  s = s.apply(s.tr.insertText(" dikkat", a.from + 5));
  assert.deepEqual(geriAlmaIslemi(s, "o1:eklenen", kabul.eklenenMetin, kabul.ozgun), { hata: "duzenlendi" });
});

test("Geri al düğmesi: ekleme (eski metin yok) geri alınınca eklenen paragraf kalkar", () => {
  let s = durum();
  const son = s.doc.content.size;
  let tr = aiAdimiBaslat(s.tr.insert(son, editorSchema.nodes.paragraph.create(null, editorSchema.text("Yeni paragraf."))));
  const yeni = yeniAralik(tr, son, son);
  tr = araligiIzle(tr, "o2:eklenen", yeni.from, yeni.to);
  s = s.apply(tr);
  const eklenenMetin = aralikMetni(s.doc, yeni.from, yeni.to);
  const sonuc = geriAlmaIslemi(s, "o2:eklenen", eklenenMetin, Slice.empty);
  assert.ok("tr" in sonuc);
  if ("tr" in sonuc) s = s.apply(sonuc.tr);
  assert.equal(s.doc.childCount, 2);
});

test("sürüm eşiği: ana hat her zaman, 150 kelimeyi aşan değişiklik", () => {
  const kelimeler = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`).join(" ");
  assert.equal(surumGerekir("anahat", "", "# Giriş"), true);
  assert.equal(surumGerekir("paragraf", "", kelimeler(150)), false);
  assert.equal(surumGerekir("paragraf", "", kelimeler(151)), true);
  assert.equal(surumGerekir("kisalt", kelimeler(100), kelimeler(10)), false);
  assert.equal(surumGerekir("genislet", kelimeler(100), `${kelimeler(100)} ${kelimeler(151).replace(/k/g, "y")}`), true);
});
