import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  crossrefAdresi,
  crossrefKayitlari,
  kayitlariBirlestir,
  literaturAra,
  openAlexAdresi,
  openAlexKayitlari,
  turEslestir,
  type AramaKaydi,
} from "@/lib/literatur-arama";

const openAlexGovde = {
  results: [
    {
      id: "https://openalex.org/W1",
      title: "Harmanlanmış öğrenme ve matematik özyeterliği",
      doi: "https://doi.org/10.1234/ABC",
      publication_year: 2021,
      type: "article",
      cited_by_count: 42,
      authorships: [{ author: { display_name: "Ahmet Yılmaz" } }, { author: { display_name: "Ayşe Demir" } }],
      primary_location: { source: { display_name: "Eğitim Dergisi" }, landing_page_url: "https://dergi.example/1" },
      open_access: { is_oa: true, oa_url: "https://dergi.example/1.pdf" },
    },
    { id: "https://openalex.org/W2", title: "", doi: null },
  ],
};

const crossrefGovde = {
  message: {
    items: [
      {
        DOI: "10.1234/abc",
        title: ["Harmanlanmış öğrenme ve matematik özyeterliği"],
        type: "journal-article",
        "container-title": ["Eğitim Dergisi"],
        issued: { "date-parts": [[2021, 3]] },
        author: [{ given: "Ahmet", family: "Yılmaz" }],
        "is-referenced-by-count": 40,
      },
      {
        DOI: "10.5555/xyz",
        title: ["Yalnızca Crossref'te olan kaynak"],
        type: "book-chapter",
        issued: { "date-parts": [[2019]] },
        author: [{ given: "Mehmet", family: "Kaya" }],
      },
    ],
  },
};

describe("dizin cevaplarının okunması", () => {
  test("OpenAlex kaydı alanlarıyla okunur; başlıksız kayıt atılır", () => {
    const kayitlar = openAlexKayitlari(openAlexGovde);
    assert.equal(kayitlar.length, 1);
    const [kayit] = kayitlar;
    assert.equal(kayit.baslik, "Harmanlanmış öğrenme ve matematik özyeterliği");
    assert.deepEqual(kayit.yazarlar, ["Ahmet Yılmaz", "Ayşe Demir"]);
    assert.equal(kayit.yil, 2021);
    assert.equal(kayit.doi, "10.1234/abc", "DOI adres önekinden arındırılıp küçük harfe indirilmeli");
    assert.equal(kayit.acikErisim, true);
    assert.equal(kayit.dergi, "Eğitim Dergisi");
  });

  test("Crossref kaydı okunur; yıl date-parts'tan gelir", () => {
    const kayitlar = crossrefKayitlari(crossrefGovde);
    assert.equal(kayitlar.length, 2);
    assert.equal(kayitlar[0].yil, 2021);
    assert.equal(kayitlar[1].tur, "chapter");
  });

  test("bozuk ya da beklenmeyen gövde boş liste döndürür (ekran patlamaz)", () => {
    assert.deepEqual(openAlexKayitlari(null), []);
    assert.deepEqual(openAlexKayitlari({ results: "hayır" }), []);
    assert.deepEqual(crossrefKayitlari({}), []);
  });

  test("bilinmeyen tür uydurulmaz, 'other' olur", () => {
    assert.equal(turEslestir("journal-article"), "article");
    assert.equal(turEslestir("dissertation"), "thesis");
    assert.equal(turEslestir("peer-review"), "other");
    assert.equal(turEslestir(undefined), "other");
  });
});

describe("arama adresleri", () => {
  test("yıl aralığı ve açık erişim süzgeci OpenAlex'e geçer", () => {
    const adres = new URL(openAlexAdresi({ sorgu: "harmanlanmış öğrenme", yilDan: 2018, yilaKadar: 2024, yalnizcaAcikErisim: true }));
    assert.equal(adres.searchParams.get("search"), "harmanlanmış öğrenme");
    assert.equal(adres.searchParams.get("filter"), "from_publication_date:2018-01-01,to_publication_date:2024-12-31,is_oa:true");
  });

  test("anlamsız yıl süzgeç olarak gönderilmez", () => {
    const adres = new URL(openAlexAdresi({ sorgu: "x", yilDan: 12, yilaKadar: null }));
    assert.equal(adres.searchParams.get("filter"), null);
  });

  test("Crossref süzgeci kendi alan adlarını kullanır", () => {
    const adres = new URL(crossrefAdresi({ sorgu: "x", yilDan: 2020 }));
    assert.equal(adres.searchParams.get("filter"), "from-pub-date:2020-01-01");
  });
});

describe("iki dizinin birleştirilmesi", () => {
  test("aynı DOI iki kez listelenmez; alanlar birleşir", () => {
    const birlesik = kayitlariBirlestir([crossrefKayitlari(crossrefGovde), openAlexKayitlari(openAlexGovde)]);
    const aynilar = birlesik.filter((kayit) => kayit.doi === "10.1234/abc");
    assert.equal(aynilar.length, 1);
    // Crossref açık erişimi bilmiyor; OpenAlex'ten gelen bilgi korunmalı.
    assert.equal(aynilar[0].acikErisim, true);
    assert.equal(aynilar[0].acikErisimUrl, "https://dergi.example/1.pdf");
  });

  test("DOI'si olmayan kayıtlar başlık ve yıla göre tekilleşir", () => {
    const kayit = (ek: Partial<AramaKaydi>): AramaKaydi => ({
      kimlik: "https://a.example/1",
      baslik: "Aynı Başlık!",
      yazarlar: [],
      yil: 2020,
      tur: "article",
      dergi: null,
      doi: null,
      url: "https://a.example/1",
      atifSayisi: null,
      acikErisim: false,
      acikErisimUrl: null,
      saglayici: "openalex",
      ...ek,
    });
    const birlesik = kayitlariBirlestir([[kayit({})], [kayit({ baslik: "aynı  başlık", saglayici: "crossref" })]]);
    assert.equal(birlesik.length, 1);
  });

  test("listeler harmanlanır: ikinci dizin dibe gömülmez", () => {
    const yap = (baslik: string, saglayici: AramaKaydi["saglayici"]): AramaKaydi => ({
      kimlik: baslik, baslik, yazarlar: [], yil: 2020, tur: "article", dergi: null, doi: null,
      url: `https://x.example/${baslik}`, atifSayisi: null, acikErisim: false, acikErisimUrl: null, saglayici,
    });
    const birlesik = kayitlariBirlestir([
      [yap("o1", "openalex"), yap("o2", "openalex")],
      [yap("c1", "crossref"), yap("c2", "crossref")],
    ]);
    assert.deepEqual(birlesik.map((kayit) => kayit.baslik), ["o1", "c1", "o2", "c2"]);
  });
});

describe("arama akışı", () => {
  test("bir dizin düşse de öbürünün sonuçları gösterilir ve söylenir", async () => {
    const sonuc = await literaturAra({ sorgu: "x" }, async (adres) => {
      if (adres.includes("crossref")) throw new Error("HTTP 503");
      return openAlexGovde;
    });
    assert.equal(sonuc.kayitlar.length, 1);
    assert.deepEqual(sonuc.ulasilamayan, ["crossref"]);
  });

  /*
    Süzgeç eskiden BİRLEŞTİRMEDEN SONRA uygulanıyordu. Birleştirme iki
    dizini harmanlayıp 20'de kesiyor, Crossref ise açık erişimi
    bilmediği için hep `false` — yani 20 satırın yarısı silinecek
    kayıtlarla doluyor, elde 15 açık erişim sonucu varken kullanıcı 10
    tanesini görüyordu. Tuhaf sonucu: Crossref ÇALIŞMADIĞINDA aynı arama
    daha çok sonuç veriyordu.
  */
  test("açık erişim süzgeci sonuç kaybettirmez", async () => {
    const oa = (i: number) => ({
      id: `https://openalex.org/W${i}`,
      title: `Açık erişim çalışması ${i}`,
      doi: `https://doi.org/10.1/oa${i}`,
      publication_year: 2021,
      type: "article",
      open_access: { is_oa: true, oa_url: `https://oa.example/${i}.pdf` },
    });
    const kapali = (i: number) => ({
      DOI: `10.2/cr${i}`,
      title: [`Crossref çalışması ${i}`],
      type: "journal-article",
      issued: { "date-parts": [[2021]] },
    });

    const sonuc = await literaturAra({ sorgu: "x", yalnizcaAcikErisim: true }, async (adres) =>
      adres.includes("crossref")
        ? { message: { items: Array.from({ length: 15 }, (_, i) => kapali(i)) } }
        : { results: Array.from({ length: 15 }, (_, i) => oa(i)) },
    );

    assert.equal(sonuc.kayitlar.length, 15);
    assert.ok(sonuc.kayitlar.every((kayit) => kayit.acikErisim));
  });

  /*
    Yıl süzgeci sonuçta da doğrulanıyor: dizinler tarih alanlarını farklı
    dolduruyor ve aralık dışına düşen bir satır kullanıcının kaynakçasına
    yanlış yıl yazdırıyordu.
  */
  test("aralığın dışındaki yıl listelenmez", async () => {
    const sonuc = await literaturAra({ sorgu: "x", yilDan: 2020 }, async (adres) =>
      adres.includes("crossref")
        ? { message: { items: [{ DOI: "10.3/eski", title: ["Eski çalışma"], issued: { "date-parts": [[2019]] } }] } }
        : { results: [] },
    );
    assert.deepEqual(sonuc.kayitlar, []);
  });

  test("açık erişim istendiğinde Crossref sonuçları da süzülür", async () => {
    // Süzgeç yalnızca OpenAlex'te var; süzülmezse kullanıcı "açık erişim"
    // dediği halde kapalı kaynak görürdü.
    const sonuc = await literaturAra({ sorgu: "x", yalnizcaAcikErisim: true }, async (adres) =>
      adres.includes("crossref") ? crossrefGovde : { results: [] },
    );
    assert.deepEqual(sonuc.kayitlar, []);
  });

  /*
    DOI'li ve DOI'siz kopya eskiden hiç karşılaşmıyordu: anahtar "DOI
    varsa DOI, yoksa başlık" idi. OpenAlex tez ve raporlarda DOI'yi sık
    sık boş bırakıyor, Crossref aynı yayını DOI'yle veriyordu — sonuç,
    listede aynı kaynağın iki kez görünmesi ve kullanıcının ikisini de
    kaynakçasına eklemesiydi.
  */
  test("aynı yayının DOI'li ve DOI'siz kopyası birleşir", () => {
    const temel = (ek: Partial<AramaKaydi>): AramaKaydi => ({
      kimlik: "k", baslik: "Örgütsel Bağlılık Üzerine", yazarlar: [], yil: 2021, tur: "article",
      dergi: null, doi: null, url: "https://a.example/1", atifSayisi: null,
      acikErisim: false, acikErisimUrl: null, saglayici: "openalex", ...ek,
    });
    const birlesik = kayitlariBirlestir([
      [temel({ doi: null, saglayici: "openalex" })],
      [temel({ doi: "10.5555/xyz", dergi: "Dergi", saglayici: "crossref" })],
    ]);
    assert.equal(birlesik.length, 1);
    // Birleşen kayıt DOI'yi ve dergiyi kazanmalı.
    assert.equal(birlesik[0].doi, "10.5555/xyz");
    assert.equal(birlesik[0].dergi, "Dergi");
  });

  /*
    Tek kelimelik başlıklar her sayıda tekrar eder ("Editöryal", "Önsöz");
    onları anahtar saymak iki AYRI yayını tek satırda birleştirir ve
    birinin başlığı diğerinin dergisiyle eşleşirdi.
  */
  test("tek kelimelik başlıklar yanlışlıkla birleştirilmez", () => {
    const yap = (dergi: string, saglayici: AramaKaydi["saglayici"]): AramaKaydi => ({
      kimlik: dergi, baslik: "Editöryal", yazarlar: [], yil: 2020, tur: "article", dergi,
      doi: null, url: `https://x.example/${dergi}`, atifSayisi: null,
      acikErisim: false, acikErisimUrl: null, saglayici,
    });
    const birlesik = kayitlariBirlestir([[yap("A Dergisi", "openalex")], [yap("B Dergisi", "crossref")]]);
    assert.equal(birlesik.length, 2);
  });

  /*
    Crossref'in `issued` alanı çevrim içi ilk yayım tarihini verir,
    OpenAlex'in `publication_year` alanı sayının yılını. Eskiden
    birleştirmede yıla hiç dokunulmuyor, hangi kopya önce geldiyse onun
    yılı kalıyordu: kullanıcı "2020 ve sonrası" süzüp listede 2019
    görebiliyor ve o yılı kaynakçasına kaydediyordu.
  */
  test("yıl uzlaştırılır: sayının yılı (OpenAlex) tercih edilir", () => {
    const yap = (yil: number, saglayici: AramaKaydi["saglayici"]): AramaKaydi => ({
      kimlik: "10.7777/abc", baslik: "Çevrim İçi Önce Yayım", yazarlar: [], yil, tur: "article",
      dergi: null, doi: "10.7777/abc", url: "https://doi.org/10.7777/abc", atifSayisi: null,
      acikErisim: false, acikErisimUrl: null, saglayici,
    });
    // Crossref önce geliyor (listede ilk sırada) ama yıl OpenAlex'ten alınmalı.
    const birlesik = kayitlariBirlestir([[yap(2019, "crossref")], [yap(2020, "openalex")]]);
    assert.equal(birlesik.length, 1);
    assert.equal(birlesik[0].yil, 2020);
  });

  test("kurumsal yazar düşmez (Crossref {name})", () => {
    const kayitlar = crossrefKayitlari({
      message: {
        items: [{
          title: ["Küresel Sağlık Raporu"],
          author: [{ name: "World Health Organization" }],
          DOI: "10.9999/who",
          issued: { "date-parts": [[2021]] },
        }],
      },
    });
    assert.deepEqual(kayitlar[0].yazarlar, ["World Health Organization"]);
  });
});
