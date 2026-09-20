import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kayitOzeti, kunyeIzi, literaturIstemi, taramaCozumle } from "../../lib/ai/literatur-taramasi";
import { bulgulariDogrula } from "../../lib/ai/bulgu";
import { readFile } from "node:fs/promises";

const girdi = {
  arastirmaSorusu: "Harmanlanmış öğrenmenin matematik özyeterliğine etkisi nedir?",
  kayitlar: [
    { baslik: "Blended learning and self-efficacy", yazarlar: "Kaya, M.", yil: "2018", yayin: "Computers & Education" },
    { baslik: "Harmanlanmış öğrenme uygulamaları", yazarlar: "Demir, A.", yil: "2019", tur: "thesis" },
  ],
};

describe("kayıt özeti", () => {
  test("başlık ve künye kuyruğu tek satırda", () => {
    assert.equal(
      kayitOzeti(girdi.kayitlar),
      "[1] Blended learning and self-efficacy (Kaya, M. · 2018 · Computers & Education)\n" +
        "[2] Harmanlanmış öğrenme uygulamaları (Demir, A. · 2019 · thesis)",
    );
  });
});

describe("literatür istemi", () => {
  test("kaynak önermek istemde açıkça yasak", () => {
    const { mesajlar, kaynak } = literaturIstemi(girdi);
    const sistem = mesajlar[0].metin;
    // Dil modellerinin en zararlı hatası uydurma künye üretmek; kural hem
    // istemde hem kodda (kunyeIzi) duruyor.
    assert.match(sistem, /KAYNAK ÖNERME/);
    assert.match(sistem, /DOI uydurma/);
    /*
      Arama dizesinin biçimi açıkça şart koşulur. Önce yalnızca "Boole
      operatörleriyle birleştir" deniyordu; güçlü model boşluğu kendi
      dolduruyor, küçük model doldurmuyordu — altı dizenin üçü tırnaksız,
      operatörsüz anahtar kelime listesi geliyordu (canlıda 20.09.2026,
      claude-haiku). Veri tabanı öyle bir diziyi tam ifade araması olarak
      okumaz.
    */
    assert.match(sistem, /TIRNAK içinde/);
    assert.match(sistem, /En az bir Boole operatörü/);
    // Parantezsiz OR grubu sessiz bir hatadır: dize çalışır ama ilk terimi
    // geçen her şeyi döndürür. claude-haiku altı dizeden birinde unuttu.
    assert.match(sistem, /HER OR grubu PARANTEZ içine alınacak/);
    assert.match(sistem, /kök operatörü/);
    assert.match(sistem, /gri literatüre ayır/);
    assert.ok(kaynak.includes("Harmanlanmış öğrenmenin matematik"));
  });

  test("bütçe dolunca araştırma sorusu korunur", () => {
    const { kaynak, kirpilanlar } = literaturIstemi(
      { ...girdi, kayitlar: Array.from({ length: 80 }, (_, i) => ({ baslik: `Kayıt ${i} ${"x".repeat(200)}` })) },
      700,
    );
    assert.ok(kaynak.includes("Harmanlanmış öğrenmenin matematik"));
    assert.deepEqual(kirpilanlar, ["Toplanan kaynaklar"]);
  });
});

describe("yanıt çözümleme", () => {
  test("arama dizeleri ve bulgular birlikte okunur", () => {
    const ham =
      '{"aramalar":["(\\"blended learning\\" OR \\"harmanlanmış öğrenme\\") AND self-efficacy"],' +
      '"bulgular":[{"tur":"oneri","baslik":"Yöntem çeşitliliği","aciklama":"Listede nitel çalışma görünmüyor."}]}';
    const sonuc = taramaCozumle(ham);
    assert.equal(sonuc.aramalar.length, 1);
    assert.match(sonuc.aramalar[0], /blended learning/);
    assert.equal(sonuc.bulgular[0].baslik, "Yöntem çeşitliliği");
  });

  test("arama listesi yoksa bulgular yine okunur", () => {
    const sonuc = taramaCozumle('{"bulgular":[{"tur":"bilgi","baslik":"A","aciklama":"B"}]}');
    assert.deepEqual(sonuc.aramalar, []);
    assert.equal(sonuc.bulgular.length, 1);
  });
});

describe("künye izi", () => {
  test("APA künyesi biçimindeki metin yakalanır", () => {
    assert.equal(
      kunyeIzi([{ tur: "oneri", baslik: "Kaynak", aciklama: "Şu çalışmaya bakın: Yıldırım, S. (2020). Öğrenme ortamları." }]),
      true,
    );
  });

  test("alan adıyla konuşan bulgu temizdir", () => {
    assert.equal(
      kunyeIzi([{ tur: "oneri", baslik: "Ölçek kaynağı", aciklama: "Özyeterlik ölçeğinin özgün kaynağı listede görünmüyor." }]),
      false,
    );
  });
});

describe("sayı denetimi literatürde uygulanmaz", () => {
  /*
    Canlıda (20.09.2026) iki kusursuz tarama stratejisi üst üste düşürüldü:
    biri "2000'ler başından beri", diğeri "COVID-19" ve "son 15-20 yıl"
    ifadeleri yüzünden. Bunlar kullanıcının verisine dair sayısal iddia
    değil, alan bilgisidir. Denetim sayısal bir VERİ değeri taşıyan
    yeteneklerde kalır (analiz, kaynakça); literatürün riski uydurma
    KAYNAK ve onu kunyeIzi yakalar.
  */
  test("alan bilgisi sayıları analiz/kaynakça ölçütüyle uydurma sayılırdı", () => {
    const { kaynak } = literaturIstemi(girdi);
    const sonuc = bulgulariDogrula(
      [{ tur: "oneri", baslik: "Salgın dönemi", aciklama: "COVID-19 sonrası son 15-20 yıl ayrı taranmalı." }],
      kaynak,
    );
    assert.equal(sonuc.gecti, false, "denetim uygulansaydı bu cevap düşerdi");
  });

  test("literatür yeteneği bu denetimi çağırmaz", async () => {
    const kod = await readFile(new URL("../../app/actions/ai-literatur.ts", import.meta.url), "utf8");
    assert.ok(!kod.includes("bulgulariDogrula"), "literatür eyleminde sayı denetimi olmamalı");
    assert.ok(kod.includes("kunyeIzi"), "künye denetimi yerinde kalmalı");
  });
});
