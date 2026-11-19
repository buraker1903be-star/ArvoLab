import assert from "node:assert/strict";
import { test } from "node:test";
import { atifAdaylari, kaynakYazarAnahtari, kartKonumu, tiklananAtif, type KartKaynagi } from "@/lib/atif-karti";

/*
  K3-A: atıf kartı belgeye bir şey yazmadan, tıklama anında eşleştirir.
  Belirsizlikte kullanıcı seçer, eşleşme yoksa hiçbir kaynak seçilmez.
*/
const paragraf = "Önceki araştırmalar yalnızlığın arttığını gösteriyor (Kaya, 2021; Demir, 2019). Ayrıca Ak ve Şahin (2018) ölçeği önerdi.";
const KAYNAKLAR: KartKaynagi[] = [
  { id: "k1", title: "Remote learning and student wellbeing", authors: "Kaya, A.", year: "2021" },
  { id: "k2", title: "Peer study groups in higher education", authors: "Demir, B.", year: "2019" },
  { id: "k3", title: "Measuring loneliness in university students", authors: "Ak, E.; Şahin, C.", year: "2018" },
];

test("parantez içi grupta tıklanan atıf seçilir", () => {
  const kaya = tiklananAtif(paragraf, paragraf.indexOf("Kaya") + 2, "yazar-tarih");
  assert.equal(kaya?.tur, "yazar-tarih");
  assert.deepEqual(kaya && kaya.tur === "yazar-tarih" ? [kaya.yazarlar[0], kaya.yil, kaya.metin] : null, ["kaya", "2021", "Kaya, 2021"]);
  const demir = tiklananAtif(paragraf, paragraf.indexOf("Demir") + 1, "yazar-tarih");
  assert.deepEqual(demir && demir.tur === "yazar-tarih" ? [demir.yazarlar[0], demir.yil] : null, ["demir", "2019"]);
});

test("anlatı biçimi atıf ve atıf dışı metin", () => {
  // "Ayrıca Ak ve Şahin (2018)": cümle başındaki sözcük yazar sanılsa da doğru kaynak bulunur.
  const ak = tiklananAtif(paragraf, paragraf.indexOf("(2018)") + 2, "yazar-tarih");
  assert.equal(ak?.tur === "yazar-tarih" ? ak.yil : null, "2018");
  assert.deepEqual(atifAdaylari(ak!, KAYNAKLAR), ["k3"]);
  assert.equal(tiklananAtif(paragraf, paragraf.indexOf("araştırmalar"), "yazar-tarih"), null);
  // Dipnotlu stilde kart çözmüyor.
  assert.equal(tiklananAtif(paragraf, paragraf.indexOf("Kaya"), "dipnot"), null);
});

test("tek aday: o kaynak; yıl tutmalı", () => {
  const kaya = tiklananAtif(paragraf, paragraf.indexOf("Kaya"), "yazar-tarih")!;
  assert.deepEqual(atifAdaylari(kaya, KAYNAKLAR), ["k1"]);
  const yanlisYil = { ...kaya, yil: "2020" } as typeof kaya;
  assert.deepEqual(atifAdaylari(yanlisYil, KAYNAKLAR), []);
});

test("aynı yazar ve yıl iki kaynakta: iki aday, otomatik seçim yok", () => {
  const ikiKaya = [...KAYNAKLAR, { id: "k4", title: "Isolation and online cohorts", authors: "Kaya, M.", year: "2021" }];
  const kaya = tiklananAtif(paragraf, paragraf.indexOf("Kaya"), "yazar-tarih")!;
  assert.deepEqual(atifAdaylari(kaya, ikiKaya), ["k1", "k4"]);
});

test("eşleşmeyen atıf: aday yok", () => {
  const metin = "Bunu başkaları da söyledi (Yılmaz, 2010).";
  const y = tiklananAtif(metin, metin.indexOf("Yılmaz"), "yazar-tarih")!;
  assert.deepEqual(atifAdaylari(y, KAYNAKLAR), []);
});

test("numaralı atıf kaynakçanın n. girdisiyle eşleşir", () => {
  const metin = "Bu bulgu tekrarlandı [2, 3].";
  const isabet = tiklananAtif(metin, metin.indexOf("3"), "numara");
  assert.deepEqual(isabet && isabet.tur === "numara" ? isabet.numara : null, 3);
  const girdiler = [
    "[1] A. Kaya, Remote learning and student wellbeing, 2021.",
    "[2] B. Demir, Peer study groups in higher education, 2019.",
    "[3] E. Ak, C. Şahin, Measuring loneliness in university students, 2018.",
  ];
  assert.deepEqual(atifAdaylari(isabet!, KAYNAKLAR, girdiler), ["k3"]);
  // Kaynakçada olmayan numara: aday yok.
  assert.deepEqual(atifAdaylari({ tur: "numara", bas: 0, bit: 0, metin: "[9]", numara: 9 }, KAYNAKLAR, girdiler), []);
});

test("kaynak kaydının yazar anahtarı atıfla aynı normalleştirmeden geçer", () => {
  assert.equal(kaynakYazarAnahtari("Kaya, A."), "kaya");
  assert.equal(kaynakYazarAnahtari("Ak, E.; Şahin, C."), "ak");
  assert.equal(kaynakYazarAnahtari("A. Kaya"), "kaya");
  assert.equal(kaynakYazarAnahtari(null), null);
});

test("kart konumu: kâğıdın sağında yer varsa yanında, yoksa satırın altında; ekrandan taşmaz", () => {
  const satir = { left: 400, right: 600, top: 300, bottom: 320 };
  assert.deepEqual(kartKonumu({ kagit: { left: 300, right: 1100, top: 0, bottom: 0 }, satir, ekranGenisligi: 1600, ekranYuksekligi: 900, genislik: 280 }), { yan: "sag", x: 1112, y: 292 });
  const alt = kartKonumu({ kagit: { left: 300, right: 1300, top: 0, bottom: 0 }, satir: { ...satir, left: 1250 }, ekranGenisligi: 1440, ekranYuksekligi: 900, genislik: 280 });
  assert.equal(alt.yan, "alt");
  assert.equal(alt.y, 328);
  assert.ok(alt.x + 280 <= 1440 - 8);
  // Ekranın dibindeki satır: kart satırın ÜSTÜNE açılır, taşmaz ve satırı örtmez.
  const dipte = kartKonumu({ kagit: { left: 300, right: 1300, top: 0, bottom: 0 }, satir: { left: 400, right: 600, top: 820, bottom: 840 }, ekranGenisligi: 1440, ekranYuksekligi: 900, genislik: 280, yukseklik: 220 });
  assert.equal(dipte.y, 820 - 220 - 8);
});

/*
  Görsel uyum (19.11.2026): seçim kartı metin sütununun sağına sığıyorsa
  orada açılır. 1440 px'te kâğıt sağ kenarı 1302, metin sütunu 1270:
  kâğıdın dışına sığmayan 152 px'lik kart metni örtmeden sağda durur.
*/
test("kart konumu: metinSagi verilince sınır metin sütunu; kâğıt dışında yer yoksa bile sağda açılır", () => {
  const satir = { left: 500, right: 900, top: 300, bottom: 320 };
  const kagit = { left: 378, right: 1302, top: 0, bottom: 0 };
  const eski = kartKonumu({ kagit, satir, ekranGenisligi: 1440, ekranYuksekligi: 900, genislik: 168, yukseklik: 120 });
  assert.equal(eski.yan, "alt");
  const yeni = kartKonumu({ kagit, satir, ekranGenisligi: 1440, ekranYuksekligi: 900, genislik: 152, yukseklik: 120, metinSagi: 1270, bosluk: 8 });
  assert.deepEqual(yeni, { yan: "sag", x: 1278, y: 292 });
  // Kart metin sütununun sağında başlar: okunan satırın hiçbir harfini örtmez.
  assert.ok(yeni.x > 1270);
  // Yer yoksa (sağ panel açık) yine satırın altında.
  assert.equal(kartKonumu({ kagit: { ...kagit, right: 1000 }, satir, ekranGenisligi: 1060, ekranYuksekligi: 900, genislik: 152, metinSagi: 968, bosluk: 8 }).yan, "alt");
});
