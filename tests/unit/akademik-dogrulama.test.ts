import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ParsedReference } from "@/lib/apa7";
import { verifyAcademicReferences } from "@/lib/academic-reference-verification";

/*
  Dizin eşleştirmesinin doğruluğu. İki yön de tehlikeli:

    - YANLIŞ "doğrulandı": öğrenciye hatalı künyesinin teyit edildiği
      söylenir. Akademik denetim aracında bundan kötüsü yok.
    - YANLIŞ "bulunamadı": doğru yazılmış künye şüpheli gösterilir,
      kullanıcı aracı kullanmayı bırakır.

  İkisi de 23.09.2026'da canlı ekranda aynı anda görüldü.
*/

const kunye = (parca: Partial<ParsedReference> & { raw: string }): ParsedReference => ({
  authors: null,
  year: null,
  title: null,
  issues: [],
  ...parca,
});

type CrossrefOgesi = Record<string, unknown>;

const gercekFetch = globalThis.fetch;
let crossrefOgeleri: CrossrefOgesi[] = [];

beforeEach(() => {
  crossrefOgeleri = [];
  globalThis.fetch = (async (adres: string) => {
    const govde = String(adres).includes("crossref")
      ? { message: { items: crossrefOgeleri } }
      : { results: [] };
    return new Response(JSON.stringify(govde), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = gercekFetch;
});

const dogrula = async (ref: ParsedReference) => (await verifyAcademicReferences([ref]))[0];

describe("akademik kayıt eşleştirmesi", () => {
  /*
    Canlıda görülen hata: aynı kelimeler ters sırada yazıldığı için başlık
    benzerliği 1,0 çıkıyor, yıl farkı 3 olduğu için yıl puanı 0 kalıyor ve
    toplam 0,82 ile "doğrulandı" eşiğini (0,78) aşıyordu. Yazarlar hiç
    okunmuyordu.
  */
  test("farklı yazarın çalışması 'doğrulandı' sayılmaz", async () => {
    crossrefOgeleri = [{
      DOI: "10.14527/9786052410196.16",
      title: ["İş doyumu ve örgütsel bağlılık"],
      author: [{ given: "Ali", family: "Taş" }],
      issued: { "date-parts": [[2017]] },
    }];

    const sonuc = await dogrula(kunye({
      raw: "Yılmaz, A. (2020). Örgütsel bağlılık ve iş doyumu. Eğitim Dergisi, 12(3), 45-60.",
      authors: ["Yılmaz, A."],
      year: "2020",
      title: "Örgütsel bağlılık ve iş doyumu",
    }));

    assert.equal(sonuc.status, "possible_match");
    // Bulduğumuz şey duruyor; kalkan yalnızca KESİNLİK iddiası.
    assert.equal(sonuc.bestMatch?.title, "İş doyumu ve örgütsel bağlılık");
  });

  /*
    Ters yön: dizindeki kayıt alt başlık taşıyor, öğrencinin yazdığı kısa
    başlık uzun tarafa bölününce 0,44'te kalıyor ve toplam 0,54 ile
    "bulunamadı" oluyordu. Deci & Ryan (2000) Crossref'te kesinlikle var.
  */
  test("alt başlıklı kayıt, kısa yazılmış künyeyi düşürmez", async () => {
    crossrefOgeleri = [{
      DOI: "10.1207/s15327965pli1104_01",
      title: ['The "What" and "Why" of Goal Pursuits: Human Needs and the Self-Determination of Behavior'],
      author: [{ given: "Edward L.", family: "Deci" }, { given: "Richard M.", family: "Ryan" }],
      issued: { "date-parts": [[2000]] },
    }];

    const sonuc = await dogrula(kunye({
      raw: 'Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal pursuits. Psychological Inquiry, 11(4), 227-268.',
      authors: ["Deci, E. L.", "Ryan, R. M."],
      year: "2000",
      title: 'The "what" and "why" of goal pursuits',
    }));

    assert.equal(sonuc.status, "verified");
  });

  test("yazar ve yıl tutan kayıt eskisi gibi doğrulanır", async () => {
    crossrefOgeleri = [{
      DOI: "10.1234/abc",
      title: ["Harmanlanmış öğrenme ve matematik özyeterliği"],
      author: [{ given: "Ahmet", family: "Yılmaz" }],
      issued: { "date-parts": [[2021]] },
    }];

    const sonuc = await dogrula(kunye({
      raw: "Yılmaz, A. (2021). Harmanlanmış öğrenme ve matematik özyeterliği. Eğitim Dergisi, 10(2), 1-20.",
      authors: ["Yılmaz, A."],
      year: "2021",
      title: "Harmanlanmış öğrenme ve matematik özyeterliği",
    }));

    assert.equal(sonuc.status, "verified");
  });

  /*
    Kapı YALNIZCA iki tarafta da yazar varken işler. Dizin yazar
    bildirmiyorsa bu "uyuşmuyor" değil "bilinmiyor"dur; bilgisizlikle
    kapı kapatmak bu projede yasak.
  */
  test("adayda yazar yoksa kapı çalışmaz", async () => {
    crossrefOgeleri = [{
      DOI: "10.1234/xyz",
      title: ["Harmanlanmış öğrenme ve matematik özyeterliği"],
      issued: { "date-parts": [[2021]] },
    }];

    const sonuc = await dogrula(kunye({
      raw: "Yılmaz, A. (2021). Harmanlanmış öğrenme ve matematik özyeterliği. Eğitim Dergisi, 10(2), 1-20.",
      authors: ["Yılmaz, A."],
      year: "2021",
      title: "Harmanlanmış öğrenme ve matematik özyeterliği",
    }));

    assert.equal(sonuc.status, "verified");
  });

  /*
    Kısa başlıkta kapsama uygulanmıyor: "İş Doyumu" iki kelime ve içinde
    o kelimeler geçen her yayına tam puan almamalı.
  */
  test("iki kelimelik başlık uzun bir yayına tam puan almaz", async () => {
    crossrefOgeleri = [{
      DOI: "10.1234/uzun",
      title: ["İş doyumu üzerine kapsamlı bir meta analiz çalışması ve sonuçları"],
      author: [{ given: "Ayşe", family: "Demir" }],
      issued: { "date-parts": [[2020]] },
    }];

    const sonuc = await dogrula(kunye({
      raw: "Demir, A. (2020). İş doyumu. Ankara Üniversitesi Yayınları.",
      authors: ["Demir, A."],
      year: "2020",
      title: "İş doyumu",
    }));

    assert.notEqual(sonuc.status, "verified");
  });
});
