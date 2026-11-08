import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { aralikMetni, araligiBirak, araligiDogrula, araligiIzle, asistanAraligiAnahtari, asistanAraligiEklentisi, izlenenAralik } from "@/lib/tiptap-asistan-araligi";
import { aiAdimiBaslat, altinaEklemeHedefi, yeniAralik } from "@/lib/ai-duzenleme";
import { belge, paragraf } from "./ortam";

/*
  V4.3-0 — AI PANELİ HATA DÜZELTMELERİ (08.11.2026). Tarayıcısız: gerçek
  şema ve gerçek ProseMirror işlemleri. Panelin React bağlantısı
  (kilit, sıranın panelde işlenmesi) tarayıcı ister; o kısım
  scripts/onizleme/ai-kabul.mjs'te.

  P0-1  Sıradaki menü görevi, menüye basıldığı andaki metni taşır.
  P0-2  "Paragrafın altına ekle" bağlamını doğrular.
  P0-3  Bırakılan aralık izlemeden çıkar; sayılmaz, eşlenmez.
  P0-4  Kabul edilmiş önerinin ikinci kabulü belgeyi değiştirmez.
*/

const BIR = "Enflasyon kısa dönemde işsizliği düşürür.";
const IKI = "Uzun dönemde bu ilişki zayıflar.";
const UC = "Türkiye verisi bu tartışmayı sınamak için uygundur.";

const durum = (...p: string[]) => EditorState.create({ doc: belge(...p.map((x) => (x ? paragraf(x) : { type: "paragraph" }))), plugins: [asistanAraligiEklentisi()] });
const yaz = (s: EditorState, tr: Transaction) => s.apply(tr);
/** n. paragrafın (0 tabanlı) içerik başlangıcı ve bitişi. */
function par(s: EditorState, n: number) {
  let bas = 0;
  for (let i = 0; i < n; i++) bas += s.doc.child(i).nodeSize;
  const node = s.doc.child(n);
  return { blokBas: bas, blokSon: bas + node.nodeSize, from: bas + 1, to: bas + 1 + node.content.size };
}
const izlenenSayisi = (s: EditorState) => Object.keys(asistanAraligiAnahtari.getState(s) ?? {}).length;

/* ---------------- P0-1 ---------------- */

test("P0-1: sırada bekleyen görevin metni, kullanıcı arada yazsa ve başka yeri seçse de bulunur", () => {
  let s = durum(BIR, IKI, UC);
  const { from, to } = par(s, 1);
  // Menüye basıldı: seçim o anda izlemeye alındı (secim-ai.tsx).
  s = yaz(s, araligiIzle(s.tr, "gorev-1", from, to));
  const secimMetni = aralikMetni(s.doc, from, to);
  // Önceki yanıt beklenirken kullanıcı belgenin başına yazıyor ve üçüncü paragrafı seçiyor.
  s = yaz(s, s.tr.insertText("Giriş: ", 1));
  const p3 = par(s, 2);
  s = yaz(s, s.tr.setSelection(TextSelection.create(s.doc, p3.from, p3.to)));
  assert.equal(aralikMetni(s.doc, s.selection.from, s.selection.to), UC, "kullanıcı artık başka yeri seçti");
  // Sırası geldi: o anki seçim değil, izlenen aralık doğrulanır.
  const d = araligiDogrula(s, "gorev-1", secimMetni);
  assert.equal(d.tamam, true);
  if (d.tamam) assert.equal(aralikMetni(s.doc, d.from, d.to), IKI);
});

test("P0-1: sırada beklerken seçilen metin değiştiyse görev işlenmez ('degisti')", () => {
  let s = durum(BIR, IKI, UC);
  const { from, to } = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "gorev-1", from, to));
  const secimMetni = aralikMetni(s.doc, from, to);
  s = yaz(s, s.tr.insertText("ARA ", from + 5));
  assert.deepEqual(araligiDogrula(s, "gorev-1", secimMetni), { tamam: false, neden: "degisti" });
});

/* ---------------- P0-2 ---------------- */

/** V4.3-0'a kadarki "altına ekle" hedefi: yalnızca izlenen aralığın sonu, doğrulama yok. */
function eskiAltinaHedefi(s: EditorState, id: string) {
  const a = izlenenAralik(s, id)!;
  const $pos = s.doc.resolve(Math.min(a.to, s.doc.content.size));
  return $pos.depth >= 1 ? $pos.after(1) : $pos.pos;
}

test("P0-2 ESKİ YÖNTEM: imlecin paragrafı silinince öneri KOMŞU paragrafın altına girer", () => {
  let s = durum(BIR, IKI, UC);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.to, p2.to)); // imleç ikinci paragrafın sonunda, seçim yok
  s = yaz(s, s.tr.delete(p2.blokBas, p2.blokSon)); // kullanıcı o paragrafı sildi
  const yer = eskiAltinaHedefi(s, "o");
  // Eski hedef birinci paragrafın sonu: öneri yanlış bağlama ekleniyordu.
  assert.equal(yer, par(s, 0).blokSon);
});

test("P0-2: imlecin paragrafı silindiyse ekleme yapılmaz ('silindi')", () => {
  let s = durum(BIR, IKI, UC);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.to, p2.to));
  s = yaz(s, s.tr.delete(p2.blokBas, p2.blokSon));
  assert.deepEqual(altinaEklemeHedefi(s, "o", { vardi: false, metin: "" }, true), { tamam: false, neden: "silindi" });
});

test("P0-2: seçimle istenen önerinin metni değiştiyse altına da eklenmez ('degisti')", () => {
  let s = durum(BIR, IKI, UC);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.from, p2.to));
  s = yaz(s, s.tr.insertText("X", p2.from + 3));
  assert.deepEqual(altinaEklemeHedefi(s, "o", { vardi: true, metin: IKI }, true), { tamam: false, neden: "degisti" });
});

test("P0-2: geçerli bağlamda hedef, paragrafın ALTI (paragraf bölünmez); öndeki yazım kaydırır", () => {
  let s = durum(BIR, IKI, UC);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.from, p2.to));
  s = yaz(s, s.tr.insertText("Giriş: ", 1)); // öne yazım: aralık kayar, metin aynı
  const h = altinaEklemeHedefi(s, "o", { vardi: true, metin: IKI }, true);
  assert.equal(h.tamam, true);
  if (h.tamam) {
    assert.equal(h.from, par(s, 1).blokSon);
    assert.equal(h.to, h.from);
  }
});

test("P0-2: imlecin önüne yazmak ya da önündeki tek harfi silmek bağlamı 'silinmiş' saydırmaz", () => {
  let s = durum(BIR, IKI, UC);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.to, p2.to));
  s = yaz(s, s.tr.insertText("ek ", p2.from));
  const a1 = izlenenAralik(s, "o")!;
  s = yaz(s, s.tr.delete(a1.from - 1, a1.from)); // imlecin hemen önündeki harf
  assert.equal(izlenenAralik(s, "o")!.silindi, false);
  const h = altinaEklemeHedefi(s, "o", { vardi: false, metin: "" }, true);
  assert.equal(h.tamam, true);
});

test("P0-2: imleç boş paragraftaysa öneri onun YERİNE yazılır; ana hatta (bosParagrafaYaz=false) altına", () => {
  let s = durum(BIR, "", UC);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.from, p2.from));
  const yerine = altinaEklemeHedefi(s, "o", { vardi: false, metin: "" }, true);
  assert.deepEqual(yerine, { tamam: true, from: p2.blokBas, to: p2.blokSon });
  const altina = altinaEklemeHedefi(s, "o", { vardi: false, metin: "" }, false);
  assert.deepEqual(altina, { tamam: true, from: p2.blokSon, to: p2.blokSon });
});

test("P0-2: izlenmeyen öneri için hedef yok ('izlenmiyor')", () => {
  const s = durum(BIR, IKI);
  assert.deepEqual(altinaEklemeHedefi(s, "yok", { vardi: false, metin: "" }, true), { tamam: false, neden: "izlenmiyor" });
});

/* ---------------- P0-3 ---------------- */

test("P0-3: bırakılan aralık izlemeden çıkar; sonraki yazımlarda sayılmaz ve geri gelmez", () => {
  let s = durum(BIR, IKI);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "hatali-istek", p2.from, p2.to));
  s = yaz(s, araligiIzle(s.tr, "gecerli", p2.from, p2.from));
  assert.equal(izlenenSayisi(s), 2);
  // İstek hatayla döndü (cevap.hata / ağ istisnası / metinsiz yanıt): panel bırakır.
  s = yaz(s, araligiBirak(s.tr, "hatali-istek"));
  s = yaz(s, s.tr.insertText("yeni ", 1));
  assert.equal(izlenenSayisi(s), 1);
  assert.equal(izlenenAralik(s, "hatali-istek"), null);
  assert.ok(izlenenAralik(s, "gecerli"), "öteki öneri izlenmeye devam eder");
});

test("P0-3: bilinmeyen kimliği bırakmak durumu bozmaz (çift bırakma güvenli)", () => {
  let s = durum(BIR);
  s = yaz(s, araligiIzle(s.tr, "a", 1, 3));
  s = yaz(s, araligiBirak(s.tr, "a"));
  s = yaz(s, araligiBirak(s.tr, "a"));
  assert.equal(izlenenSayisi(s), 0);
});

/* ---------------- P0-4 ---------------- */

test("P0-4: kabul edilen önerinin ikinci kabulü belgeyi DEĞİŞTİRMEZ (istek aralığı bırakılmış)", () => {
  let s = durum(BIR, IKI);
  const p2 = par(s, 1);
  s = yaz(s, araligiIzle(s.tr, "o", p2.from, p2.to));
  const AI = "Uzun dönemde söz konusu ilişki zayıflamaktadır.";
  // İlk kabul: panelin uygula'sı gibi doğrula, değiştir, eklenen aralığı izle, istek aralığını bırak.
  const d = araligiDogrula(s, "o", IKI);
  assert.ok(d.tamam);
  if (!d.tamam) return;
  const tr = aiAdimiBaslat(s.tr.insertText(AI, d.from, d.to));
  const y = yeniAralik(tr, d.from, d.to);
  araligiIzle(tr, "o:eklenen", y.from, y.to);
  s = yaz(s, araligiBirak(tr, "o"));
  const sonra = s.doc.toJSON();
  // İkinci kabul (çift tıklama): hedef artık izlenmiyor; değiştirme yapılmaz.
  assert.deepEqual(araligiDogrula(s, "o", IKI), { tamam: false, neden: "izlenmiyor" });
  assert.deepEqual(altinaEklemeHedefi(s, "o", { vardi: true, metin: IKI }, true), { tamam: false, neden: "izlenmiyor" });
  assert.deepEqual(s.doc.toJSON(), sonra);
  assert.equal(s.doc.textContent.split(AI).length - 1, 1, "AI metni belgede bir kez");
});
