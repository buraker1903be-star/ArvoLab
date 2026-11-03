import assert from "node:assert/strict";
import test from "node:test";
import { kutuphaneSatiri, paragraflara, yazimCozumle, yazimDenetle, yazimIstemi, type KutuphaneKaydi } from "@/lib/ai/yazim-asistani";

/*
  Yazım asistanı (03.11.2026): asistan sohbette yazar, ekleme kullanıcının.
  Değişmeyen iki kural: atıf yalnızca öğrencinin kütüphanesinden, sayı
  yalnızca bağlamdan. İkisinden biri çiğnenirse cevabın tamamı düşer.
*/
const KUTUPHANE: KutuphaneKaydi[] = [
  { yazarlar: "Phillips, A. W.", yil: "1958", baslik: "The relation between unemployment and money wage rates" },
  { yazarlar: "Engle, R. F.; Granger, C. W. J.", yil: "1987", baslik: "Co-integration and error correction" },
  { yazarlar: "Staiger, D.; Stock, J. H.; Watson, M. W.", yil: "1997", baslik: "The NAIRU" },
];
const BAGLAM = ["2025 yılında TÜFE yıllık %30,89 artmıştır; işsizlik %8,3'tür.", KUTUPHANE.map((k, i) => kutuphaneSatiri(k, i + 1)).join("\n")];

test("kütüphanedeki kaynağa yapılan atıf geçer", () => {
  const metin = "Phillips (1958) enflasyon ile işsizlik arasında ters yönlü bir ilişki bulmuştur. Bu ilişki uzun dönemde tartışmalıdır (Engle ve Granger, 1987; Staiger vd., 1997).";
  assert.deepEqual(yazimDenetle(metin, KUTUPHANE, BAGLAM), { gecti: true });
});

test("kütüphanede olmayan atıf cevabı düşürür (anlatı da parantez içi de)", () => {
  assert.deepEqual(yazimDenetle("Friedman (1968) beklentileri vurgulamıştır.", KUTUPHANE, BAGLAM), {
    gecti: false,
    neden: "kunye",
    ayrinti: ["Friedman (1968)"],
  });
  const parantez = yazimDenetle("Bu görüş yaygındır (Friedman, 1968).", KUTUPHANE, BAGLAM);
  assert.equal(parantez.gecti, false);
  // Doğru yazar, yanlış yıl da uydurmadır.
  assert.equal(yazimDenetle("Phillips (1960) bunu göstermiştir.", KUTUPHANE, BAGLAM).gecti, false);
});

test("kaynakça satırı ve DOI üretilemez", () => {
  const sonuc = yazimDenetle("Phillips, A. W. (1958). The relation… Economica.", KUTUPHANE, BAGLAM);
  assert.equal(sonuc.gecti, false);
  assert.equal(sonuc.gecti === false && sonuc.neden, "kunye");
  assert.equal(yazimDenetle("Ayrıntı için 10.1111/j.1468-0335.1958.tb00003.x", KUTUPHANE, BAGLAM).gecti, false);
});

test("bağlamda olmayan sayı cevabı düşürür; bağlamdaki sayı geçer", () => {
  assert.deepEqual(yazimDenetle("2025 yılında enflasyon %30,89 olmuştur.", KUTUPHANE, BAGLAM), { gecti: true });
  assert.deepEqual(yazimDenetle("Örneklem 250 katılımcıdan oluşmaktadır.", KUTUPHANE, BAGLAM), {
    gecti: false,
    neden: "uydurma_sayi",
    ayrinti: ["250"],
  });
});

test("çözümleme: JSON, kod çiti ve boş cevap", () => {
  assert.deepEqual(yazimCozumle('{"yanit":"Giriş için bir paragraf.","metin":"Birinci.\\n\\nİkinci."}'), {
    yanit: "Giriş için bir paragraf.",
    metin: "Birinci.\n\nİkinci.",
  });
  assert.deepEqual(yazimCozumle('```json\n{"yanit":"Soru?","metin":""}\n```'), { yanit: "Soru?", metin: "" });
  assert.equal(yazimCozumle("düz metin"), null);
  assert.equal(yazimCozumle('{"yanit":"","metin":""}'), null);
  assert.deepEqual(paragraflara("Bir\nsatır.\n\n  İki.  \n\n"), ["Bir satır.", "İki."]);
});

test("istem: kütüphane, belge ve görev bağlama girer; geçmiş kırpılır", () => {
  const { mesajlar, kaynak } = yazimIstemi({
    calisma: "Tez: Enflasyon ve işsizlik",
    belgeDili: "tr",
    atifStili: "APA 7",
    bolum: "Giriş",
    oncesi: "Fiyat istikrarı makroekonominin temel hedefidir.",
    secim: null,
    kutuphane: KUTUPHANE,
    gecmis: Array.from({ length: 12 }, (_, i) => ({ rol: i % 2 ? "asistan" : "kullanici", metin: `m${i}` })),
    istek: "Giriş için bir paragraf yaz",
    gorev: "paragraf",
  });
  assert.match(kaynak, /KÜTÜPHANE[\s\S]*Phillips \(1958\)/);
  assert.match(kaynak, /Engle ve Granger \(1987\)/);
  assert.match(kaynak, /Staiger vd\. \(1997\)/);
  assert.match(kaynak, /İMLECİN BULUNDUĞU BÖLÜM: Giriş/);
  // sistem istemi + bağlam + 8 geçmiş + istek
  assert.equal(mesajlar.length, 11);
  assert.equal(mesajlar.at(-1)?.metin, "Giriş için bir paragraf yaz");
});
