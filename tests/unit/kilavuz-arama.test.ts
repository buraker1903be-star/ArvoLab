import { test } from "node:test";
import assert from "node:assert/strict";
import { aramaBicimi, aramaSozcukleri, kilavuzAra } from "@/lib/yardim/kilavuz-arama";
import { kilavuzBolumleri } from "@/lib/yardim/kullanim-kilavuzu";

/*
  Kılavuz araması (Signature OS 4.4). Eskiden kılavuzda arama yoktu;
  telefonda cevabı bulmanın yolu 11.900 piksel kaydırmaktı.
*/
const B = [
  { id: "guvenlik", metinler: ["Hesabınız ve ayarlar", "Şifrenizi Ayarlar'dan değiştirin."] },
  { id: "kaynak", metinler: ["Kaynaklar", "DOI ile kaynak ekleyin; künye bilgileri getirilir."] },
  { id: "istanbul", metinler: ["İSTANBUL ÜNİVERSİTESİ kılavuzu"] },
];

test("Türkçe karakter ve büyük harf fark etmez", () => {
  assert.equal(aramaBicimi("Şifre  DEĞİŞTİR ılık"), "sifre degistir ilik");
  assert.deepEqual(kilavuzAra(B, "sifre"), ["guvenlik"]);
  assert.deepEqual(kilavuzAra(B, "ŞİFRE"), ["guvenlik"]);
  assert.deepEqual(kilavuzAra(B, "istanbul universitesi"), ["istanbul"]);
});

test("birden çok sözcük: hepsi geçmeli", () => {
  assert.deepEqual(kilavuzAra(B, "doi kaynak"), ["kaynak"]);
  assert.deepEqual(kilavuzAra(B, "doi şifre"), []);
});

test("boş ya da tek harfli sorgu arama sayılmaz (null), eşleşme yoksa boş dizi", () => {
  assert.equal(kilavuzAra(B, ""), null);
  assert.equal(kilavuzAra(B, "  a "), null);
  assert.deepEqual(aramaSozcukleri("a ve doi"), ["ve", "doi"]);
  assert.deepEqual(kilavuzAra(B, "olmayan"), []);
});

test("gerçek kılavuzda: 'şifre' Hesap bölümünü, 'doi' Kaynaklar bölümünü bulur", () => {
  const bolumler = kilavuzBolumleri("client").map((b) => ({
    id: b.id,
    metinler: [b.baslik.tr, b.ozet.tr, ...(b.adimlar ?? []).map((a) => a.tr), ...(b.notlar ?? []).map((n) => n.tr)],
  }));
  const sifre = kilavuzAra(bolumler, "sifre") ?? [];
  assert.ok(sifre.length > 0, "şifre hiçbir bölümde bulunamadı");
  assert.ok((kilavuzAra(bolumler, "doi") ?? []).length > 0);
});
