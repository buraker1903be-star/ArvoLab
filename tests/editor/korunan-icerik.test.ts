import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { editorSchema, paragraf, type JsonNode } from "./ortam";
import {
  KORUNAN_BLOK,
  KORUNAN_ISARET,
  KORUNAN_SATIR_ICI,
  korunacakIcerigiHazirla,
  korunanIcerigiGeriSar,
  korunanOgeSayisi,
} from "@/lib/tiptap-korunan-icerik";
import { extractPlainText, countWords, type TiptapDoc } from "@/lib/tiptap-text";

/*
  S1.3 — editörün tanımadığı içerik (lib/tiptap-korunan-icerik.ts).

  Eskiden: Tiptap tanımadığı tek bir düğüm yüzünden belgeyi BOŞ açıyordu;
  "Yedekle ve devam et"ten sonra yazılan ilk harf tezin yerine "boş +
  yazılan"ı kaydediyordu. Buradaki testler gerçek editör şemasıyla üç şeyi
  sabitler:
    1. hazırlanan belge editörün şemasında KURULUR (boş açılmaz);
    2. editörde düzenlenip geri sarılan belge, tanınmayan parçaları
       özgün JSON'larıyla birebir taşır (kayıpsız);
    3. kurulamayan belge "acilamadi" olarak işaretlenir (kayıt kapalı kalır).
*/

const belgeJson = (...content: unknown[]) => ({ type: "doc", content });

/** Editörün açacağı belge → kullanıcının göreceği JSON (ProseMirror'dan geçmiş). */
function editordenGecir(icerik: unknown) {
  const dugum = editorSchema.nodeFromJSON(icerik);
  dugum.check();
  return dugum.toJSON();
}

/** Belgedeki tanınmayan alt ağaçlar (yalnızca editörün bilmediği türler), sırayla. */
function yabancilar(icerik: unknown, bilinen = editorSchema): unknown[] {
  const bulunan: unknown[] = [];
  const gez = (d: unknown) => {
    if (!d || typeof d !== "object") return;
    const n = d as JsonNode;
    if (!bilinen.nodes[n.type]) {
      bulunan.push(n);
      return;
    }
    for (const m of n.marks ?? []) if (!bilinen.marks[m.type]) bulunan.push(m);
    for (const c of n.content ?? []) gez(c);
  };
  gez(icerik);
  return bulunan;
}

const BILINMEYEN_BLOK = { type: "kaldirilmisEklentiDugumu", attrs: { id: "x1" }, content: [{ type: "text", text: "Editörün tanımadığı içerik." }] };

test("şemaya uyan belgeye dokunulmaz", () => {
  const icerik = belgeJson(paragraf("Giriş metni."), { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Başlık" }] });
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "temiz");
  assert.equal(sonuc.icerik, icerik, "aynı nesne dönmeli (gereksiz kopya yok)");
  assert.equal(korunanIcerigiGeriSar(icerik), icerik);
});

test("tanınmayan blok: belge BOŞ açılmaz, düzenlenebilir, kayıtta özgünü yerinde", () => {
  const icerik = belgeJson(paragraf("Uyumsuz örnek metnin ilk paragrafı."), BILINMEYEN_BLOK, paragraf("Son paragraf."));
  // Eskiden: nodeFromJSON fırlatıyordu → Tiptap boş belge açıyordu.
  assert.throws(() => editorSchema.nodeFromJSON(icerik), /Unknown node type/);

  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "korundu");
  assert.deepEqual(sonuc.korunan, [{ tur: "kaldirilmisEklentiDugumu", sayi: 1 }]);

  const acilan = editordenGecir(sonuc.icerik);
  assert.equal(acilan.content.length, 3);
  assert.equal(acilan.content[1].type, KORUNAN_BLOK);
  assert.match(extractPlainText(acilan as TiptapDoc), /ilk paragrafı[\s\S]*Son paragraf/);

  const kaydedilen = korunanIcerigiGeriSar(acilan);
  assert.deepEqual(kaydedilen.content[1], BILINMEYEN_BLOK, "özgün düğüm birebir geri gelmeli");
  assert.equal(korunanOgeSayisi(kaydedilen), 0);
  // Sunucunun düz metni ve kelime sayısı özgün içeriği de saymaya devam eder.
  assert.match(extractPlainText(kaydedilen as TiptapDoc), /Editörün tanımadığı içerik/);
  assert.equal(countWords(kaydedilen as TiptapDoc), countWords(icerik as TiptapDoc));
});

test("kullanıcı çevredeki metni düzenler; korunan öğe ve özgün içerik kaybolmaz", () => {
  const icerik = belgeJson(paragraf("Birinci."), BILINMEYEN_BLOK, paragraf("Son."));
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  const doc = editorSchema.nodeFromJSON(sonuc.icerik);
  let state = EditorState.create({ doc });
  // "Son." paragrafının sonuna yaz.
  const son = state.doc.content.size - 1;
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, son)).insertText(" Eklenen cümle."));
  // Başa yeni paragraf ekle.
  state = state.apply(state.tr.insert(0, editorSchema.nodes.paragraph.create(null, editorSchema.text("Yeni giriş."))));
  const kaydedilen = korunanIcerigiGeriSar(state.doc.toJSON());
  assert.deepEqual(yabancilar(kaydedilen), [BILINMEYEN_BLOK]);
  const metin = extractPlainText(kaydedilen as TiptapDoc);
  assert.match(metin, /Yeni giriş[\s\S]*Birinci[\s\S]*Editörün tanımadığı içerik[\s\S]*Son\. Eklenen cümle\./);
});

test("satır içi tanınmayan düğüm ve tanınmayan işaret", () => {
  const satirIci = { type: "eskiMatematik", attrs: { latex: "x^2" } };
  const isaret = { type: "eskiVurgu", attrs: { renk: "sari" } };
  const icerik = belgeJson({
    type: "paragraph",
    content: [
      { type: "text", text: "Formül " },
      satirIci,
      { type: "text", text: " ve vurgulu metin", marks: [{ type: "bold" }, isaret] },
    ],
  });
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "korundu");
  const acilan = editordenGecir(sonuc.icerik);
  const p = acilan.content[0];
  assert.equal(p.content[1].type, KORUNAN_SATIR_ICI);
  // Metin düzenlenebilir hâlde kalır; yalnızca işaret korunur.
  assert.equal(p.content[2].text, " ve vurgulu metin");
  assert.ok(p.content[2].marks.some((m: { type: string }) => m.type === KORUNAN_ISARET));
  assert.ok(p.content[2].marks.some((m: { type: string }) => m.type === "bold"));

  const geri = korunanIcerigiGeriSar(acilan);
  assert.deepEqual(geri.content[0].content[1], satirIci);
  assert.ok(geri.content[0].content[2].marks.some((m: unknown) => JSON.stringify(m) === JSON.stringify(isaret)));
});

test("iç içe yapı: liste ve alıntı içinde tanınmayan blok", () => {
  const icerik = belgeJson(
    { type: "bulletList", content: [{ type: "listItem", content: [paragraf("Madde."), BILINMEYEN_BLOK] }] },
    { type: "blockquote", content: [BILINMEYEN_BLOK] },
  );
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "korundu");
  assert.deepEqual(sonuc.korunan, [{ tur: "kaldirilmisEklentiDugumu", sayi: 2 }]);
  const geri = korunanIcerigiGeriSar(editordenGecir(sonuc.icerik));
  assert.deepEqual(yabancilar(geri), [BILINMEYEN_BLOK, BILINMEYEN_BLOK]);
});

test("tabloda yerine sığmayan öğe: koruma üst düğüme taşınır, belge geçerli kalır", () => {
  const hucre = (metin: string) => ({ type: "tableCell", content: [paragraf(metin)] });
  const tablo = {
    type: "table",
    content: [
      { type: "tableRow", content: [hucre("A1"), hucre("B1")] },
      // Satırın içinde tanınmayan düğüm: satır yalnızca hücre kabul eder.
      { type: "tableRow", content: [hucre("A2"), { type: "eskiHucre", content: [] }] },
    ],
  };
  const icerik = belgeJson(paragraf("Önce."), tablo, paragraf("Sonra."));
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "korundu");
  const acilan = editordenGecir(sonuc.icerik);
  assert.equal(acilan.content[1].type, KORUNAN_BLOK, "bütün tablo tek kutuda korunmalı");
  assert.deepEqual(korunanIcerigiGeriSar(acilan).content[1], tablo);
  assert.match(extractPlainText(acilan as TiptapDoc), /Önce[\s\S]*Sonra/);
});

test("zorunlu özniteliği olmayan ya da boş metin düğümü de korunur", () => {
  const bosMetin = { type: "text", text: "" };
  const icerik = belgeJson({ type: "paragraph", content: [{ type: "text", text: "Metin " }, bosMetin] });
  assert.throws(() => editorSchema.nodeFromJSON(icerik), /Empty text nodes/);
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "korundu");
  editordenGecir(sonuc.icerik);
  assert.deepEqual(korunanIcerigiGeriSar(editordenGecir(sonuc.icerik)).content[0].content[1], bosMetin);
});

test("yapı hatası (kurulabilir, kural tutmuyor): koruma üst düğüme taşınır", () => {
  // Boş liste maddesi: listItem en az bir paragraf ister. Tiptap bunu boşaltmadan gösterirdi.
  const bozuk = { type: "bulletList", content: [{ type: "listItem", content: [] }] };
  const icerik = belgeJson(paragraf("Metin."), bozuk);
  assert.doesNotThrow(() => editorSchema.nodeFromJSON(icerik));
  assert.throws(() => editorSchema.nodeFromJSON(icerik).check());
  const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
  assert.equal(sonuc.durum, "korundu");
  assert.deepEqual(korunanIcerigiGeriSar(editordenGecir(sonuc.icerik)).content[1], bozuk);
});

test("kök düğüm bile kurulamıyorsa 'acilamadi': editör boş açılacak, kayıt kapalı kalmalı", () => {
  for (const icerik of [{ type: "eskiKok", content: [] }, { type: "doc", content: "bozuk" }, [paragraf("dizi")]]) {
    const sonuc = korunacakIcerigiHazirla(icerik, editorSchema);
    assert.ok(sonuc.durum === "acilamadi" || sonuc.durum === "yapi-hatasi", `${JSON.stringify(icerik)} → ${sonuc.durum}`);
    assert.equal(sonuc.icerik, icerik, "açılamayan belge değiştirilmeden geri verilmeli");
  }
  assert.equal(korunacakIcerigiHazirla({ type: "eskiKok", content: [] }, editorSchema).durum, "acilamadi");
});

test("veritabanında korunan öğe varsa: editör açar, kayıt json'u yazar; json bozuksa sunucu reddeder", () => {
  /*
    Korunan türler veritabanında bulunmaz (kayıt geri sarar). Doğrudan
    yazılmış bir kayıtta gelirse editör onu açar ve kayıtta json'u yerine
    koyar — belgeyi yazabilen kişi aynı içeriği paragraf olarak da
    yazabilirdi, yetki açısından yeni bir şey yok. json bozuksa geri
    sarılamaz: saveManuscript korunan öğe kalan belgeyi REDDEDER (üzerine
    yazmak yerine durur).
  */
  const sahte = { type: KORUNAN_BLOK, attrs: { tur: "x", json: JSON.stringify(paragraf("içerik")) } };
  const icerik = belgeJson(paragraf("Metin."), sahte);
  assert.equal(korunacakIcerigiHazirla(icerik, editorSchema).durum, "temiz");
  assert.deepEqual(korunanIcerigiGeriSar(editordenGecir(icerik)).content[1], paragraf("içerik"));

  const bozuk = belgeJson(paragraf("Metin."), { type: KORUNAN_BLOK, attrs: { tur: "x", json: "{bozuk" } });
  const geri = korunanIcerigiGeriSar(editordenGecir(bozuk));
  assert.equal(korunanOgeSayisi(geri), 1, "bozuk öğe olduğu gibi kalmalı (sunucu bunu görüp reddeder)");
});

test("korunan düğümler şemada; dil şemayı değiştirmiyor", () => {
  assert.ok(editorSchema.nodes[KORUNAN_BLOK]?.isAtom && editorSchema.nodes[KORUNAN_BLOK]?.isBlock);
  assert.ok(editorSchema.nodes[KORUNAN_SATIR_ICI]?.isAtom && editorSchema.nodes[KORUNAN_SATIR_ICI]?.isInline);
  assert.ok(editorSchema.marks[KORUNAN_ISARET]);
});
