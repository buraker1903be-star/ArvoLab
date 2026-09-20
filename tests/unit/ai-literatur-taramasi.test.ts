import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kayitOzeti, kunyeIzi, literaturIstemi, taramaCozumle } from "../../lib/ai/literatur-taramasi";
import { bulgulariDogrula } from "../../lib/ai/bulgu";

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

describe("sayı denetimi yalnızca bulgulara uygulanır", () => {
  test("literatürde yıl serbesttir, diğer uydurma sayı yakalanır", () => {
    /*
      Canlıda (20.09.2026) asistan kusursuz bir tarama stratejisi üretti ve
      "harmanlanmış öğrenme 2000'ler başından beri literatürde" cümlesindeki
      2000 yüzünden cevabın tamamı düşürüldü. Yıl, kullanıcının verisine dair
      bir iddia değil alan bilgisidir; literatürde serbest bırakıldı.
      Analiz ve kaynakçada kapalı kalır — orada uydurulan yıl yanıltır.
    */
    const { kaynak } = literaturIstemi(girdi);
    assert.deepEqual(
      bulgulariDogrula(
        [{ tur: "oneri", baslik: "Yıl aralığı", aciklama: "Kavram 2000'ler başından beri literatürde." }],
        kaynak,
        { yillarSerbest: true },
      ),
      { gecti: true },
    );
    // Yıl olmayan uydurma değer serbest bırakılmaz.
    assert.equal(
      bulgulariDogrula(
        [{ tur: "uyari", baslik: "Oran", aciklama: "Kaynakların %73'ü eski." }],
        kaynak,
        { yillarSerbest: true },
      ).gecti,
      false,
    );
  });

  test("yıl serbestisi kapalıyken yakalanır (analiz ve kaynakça)", () => {
    const { kaynak } = literaturIstemi(girdi);
    const sonuc = bulgulariDogrula(
      [{ tur: "uyari", baslik: "Güncellik", aciklama: "2023 sonrası kaynak yok." }],
      kaynak,
    );
    assert.equal(sonuc.gecti, false);
  });

  test("listedeki yıllar serbesttir", () => {
    const { kaynak } = literaturIstemi(girdi);
    assert.deepEqual(
      bulgulariDogrula([{ tur: "bilgi", baslik: "Yıl aralığı", aciklama: "Kaynaklar 2018 ve 2019 yıllarından." }], kaynak),
      { gecti: true },
    );
  });
});
