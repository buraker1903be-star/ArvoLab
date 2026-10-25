import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sistemIstemi } from "@/lib/ai/kaynakca-denetimi";
import { SISTEM_ISTEMI as ANALIZ_ISTEMI } from "@/lib/ai/analiz-yorumu";
import { analizIstemi, bulgulariCozumle, bulgulariDogrula } from "../../lib/ai/analiz-yorumu";
import { jsonOku } from "../../lib/ai/bulgu";
import { saglayiciHatasi } from "../../lib/ai/saglayici";

describe("analiz istemi", () => {
  const girdi = {
    istatistikMetni: "t(28) = 2.45, p = .021",
    apaSatirlari: ["t(28) = 2.45, p = .021"],
    arastirmaSorusu: "İki grup arasında fark var mı?",
  };

  test("sistem istemi ve bağlam ayrı mesajlar", () => {
    const { mesajlar, kaynak } = analizIstemi(girdi);
    assert.equal(mesajlar.length, 2);
    assert.equal(mesajlar[0].rol, "sistem");
    assert.ok(mesajlar[0].metin.includes("denetçisi"));
    assert.ok(kaynak.includes("t(28) = 2.45"));
    assert.ok(kaynak.includes("İki grup arasında fark var mı?"));
  });

  test("bütçe dolunca analiz çıktısı korunur", () => {
    const { kaynak, kirpilanlar } = analizIstemi({ ...girdi, yontem: "y".repeat(20000) }, 900);
    assert.ok(kaynak.includes("t(28) = 2.45"));
    assert.deepEqual(kirpilanlar, ["Yöntem notu"]);
  });
});

describe("yanıt çözümleme", () => {
  test("kod çiti ve fazladan cümle cevabı çöpe atmaz", () => {
    const ham = 'İşte sonuç:\n```json\n{"bulgular":[{"tur":"uyari","baslik":"Etki büyüklüğü yok","aciklama":"Çıktıda etki büyüklüğü görünmüyor."}]}\n```';
    assert.deepEqual(bulgulariCozumle(ham), [
      { tur: "uyari", baslik: "Etki büyüklüğü yok", aciklama: "Çıktıda etki büyüklüğü görünmüyor." },
    ]);
  });

  test("tanınmayan tür bilgiye düşer, boş satır atılır", () => {
    const ham = '{"bulgular":[{"tur":"felaket","baslik":"A","aciklama":"B"},{"tur":"oneri","baslik":"","aciklama":"C"}]}';
    assert.deepEqual(bulgulariCozumle(ham), [{ tur: "bilgi", baslik: "A", aciklama: "B" }]);
  });

  test("bozuk ya da beklenmedik yanıt boş liste verir", () => {
    assert.deepEqual(bulgulariCozumle("Üzgünüm, yardımcı olamam."), []);
    assert.deepEqual(bulgulariCozumle('{"bulgular":"yok"}'), []);
    assert.deepEqual(bulgulariCozumle('{"bulgular":[{'), []);
  });
});

describe("uydurma sayı denetimi", () => {
  const kaynak = "### Analiz çıktısı\nt(28) = 2.45, p = .021";

  test("yalnızca verilen sayıları kullanan bulgu geçer", () => {
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"uyari","baslik":"Etki büyüklüğü eksik","aciklama":"t(28) = 2.45 raporlanmış ama etki büyüklüğü yok."}]}',
    );
    assert.deepEqual(bulgulariDogrula(bulgular, kaynak), { gecti: true });
  });

  test("hesaplanmış bir değer uydurma sayılır", () => {
    // Model \"yardımcı olmak\" için etki büyüklüğünü hesaplayıp yazabiliyor;
    // akademik metinde uydurma bir sayı yanlış cümleden ağırdır.
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"oneri","baslik":"Etki büyüklüğü","aciklama":"Bu değerlerle d = 0.92 olur."}]}',
    );
    assert.deepEqual(bulgulariDogrula(bulgular, kaynak), { gecti: false, uydurulan: [".92"] });
  });

  test("doğrulanmış APA satırındaki sayılar uydurma sayılmaz", () => {
    const bulgular = bulgulariCozumle(
      '{"bulgular":[{"tur":"bilgi","baslik":"Serbestlik derecesi","aciklama":"F(2, 57) = 4.31 satırında df eksiksiz."}]}',
    );
    assert.deepEqual(bulgulariDogrula(bulgular, kaynak, { ekKaynaklar: ["F(2, 57) = 4.31, p = .018"] }), { gecti: true });
  });
});

describe("sunucu hata metni", () => {
  test("kullanıcıya İngilizce gövde değil, nedeni gösterilir", () => {
    // Gövde anahtar parçası ve kuruluş kimliği içerebiliyor; kullanıcıya
    // hiç gösterilmiyor. Metinlerde sağlayıcı markası da geçmez.
    assert.match(saglayiciHatasi(401, "Incorrect API key provided: sk-..."), /isteği reddetti/);
    assert.match(saglayiciHatasi(429, ""), /sınırladı/);
    assert.match(saglayiciHatasi(404, ""), /model bulunamadı/);
    assert.match(saglayiciHatasi(503, ""), /ulaşılamıyor/);
    assert.match(saglayiciHatasi(400, "maximum context length is 128000 tokens"), /sınırını aştı/);
    assert.match(saglayiciHatasi(418, ""), /HTTP 418/);
  });

  test("hata metinlerinde marka adı geçmez", () => {
    for (const durum of [401, 404, 429, 500, 418])
      assert.doesNotMatch(saglayiciHatasi(durum, ""), /openai|gpt|claude|gemini/i);
  });
});

describe("kesik yanıt kurtarma", () => {
  // Canlıda (20.09.2026) claude-sonnet-5 üç bulgunun ikisini eksiksiz yazdı,
  // üçüncüsünün ortasında jeton sınırına takıldı. JSON kapanmadığı için üçü
  // birden atılıyor ve kullanıcı "denetlenebilir bir yapı bulamadı" görüyordu.
  const kesik =
    '{"bulgular":[' +
    '{"tur":"uyari","baslik":"Etki büyüklüğü yok","aciklama":"Raporlanmamış."},' +
    '{"tur":"uyari","baslik":"Tasarım belirsiz","aciklama":"Grup sayısı anlaşılmıyor."},' +
    '{"tur":"uyari","baslik":"Test türü","aciklama":"t testinin bağımsız mı eşleş';

  test("tamamlanmış bulgular kurtarılır, yarım kalan atılır", () => {
    const bulgular = bulgulariCozumle(kesik);
    assert.equal(bulgular.length, 2);
    assert.deepEqual(bulgular.map((b) => b.baslik), ["Etki büyüklüğü yok", "Tasarım belirsiz"]);
  });

  test("sağlam yanıt aynen okunur", () => {
    assert.deepEqual(jsonOku('{"bulgular":[]}'), { bulgular: [] });
  });

  test("hiç tam nesne yoksa boş döner", () => {
    assert.deepEqual(bulgulariCozumle('{"bulgular":[{"tur":"uyari","baslik":"Yarım'), []);
  });
});

/*
  SİSTEM İSTEMİ ATIF SİSTEMİNİ ADIYLA SÖYLER (25.10.2026).

  Önceden sabitti: "Sen APA 7 kaynakça denetçisisin". Atıf sistemi
  kılavuzdan geliyor ve beş seçenek var; kılavuzu IEEE diyen
  öğrencinin kaynakçası APA kurallarına göre denetleniyor ve
  asistan onun kılavuzunda hata olmayan bir şey için "APA 7 biçim
  hatası" yazıyordu.

  Çalışma bağlamında stil zaten yazılıydı ama sistem istemi modelin
  KİMLİĞİNİ belirliyor; bağlamdaki bir not onu ezmiyor.
*/
describe("kaynakça denetçisinin kimliği", () => {
  test("stil verilince adıyla geçiyor", () => {
    assert.match(sistemIstemi("ieee"), /Sen IEEE kaynakça denetçisisin/);
    assert.match(sistemIstemi("ieee"), /IEEE biçim hatalarını grupla/);
    assert.doesNotMatch(sistemIstemi("ieee"), /APA/);
  });

  test("her stil kendi adını alıyor", () => {
    for (const [stil, ad] of [["apa7", "APA 7"], ["mla", "MLA 9"], ["vancouver", "Vancouver"]] as const) {
      assert.ok(sistemIstemi(stil).includes(`Sen ${ad} kaynakça denetçisisin`), stil);
    }
  });

  test("STİL BİLİNMİYORSA sistem adı HİÇ geçmiyor", () => {
    /* Yanlış sistemle denetlemek, denetlememekten kötüdür: modele
       açıkça "bir sistem varsayma" deniyor. */
    const istem = sistemIstemi(null);
    assert.doesNotMatch(istem, /APA 7 kaynakça denetçisisin/);
    assert.match(istem, /atıf sistemi BİLİNMİYOR/);
    assert.match(istem, /varsayma/);
  });

  test("ortak kurallar her stilde duruyor", () => {
    /* Kimlik değişiyor, denetimin kendisi değişmiyor: düzeltilmiş
       künye yazmama ve sayı uydurmama kuralları her stilde geçerli. */
    for (const stil of ["apa7", "ieee", null]) {
      const istem = sistemIstemi(stil);
      assert.match(istem, /Düzeltilmiş kaynakça satırı YAZMA/);
      assert.match(istem, /UYDURMA/);
    }
  });
});

describe("analiz yorumu kılavuz varsaymıyor", () => {
  test('istem "APA zorunlu tutar" DEMİYOR', () => {
    /* Raporlama biçimi üniversiteden üniversiteye değişiyor;
       eksiklik istatistiksel gerekçesiyle söylenmeli. */
    assert.doesNotMatch(ANALIZ_ISTEMI, /APA 7 bunu zorunlu tutar/);
    assert.match(ANALIZ_ISTEMI, /Hangi kılavuzun istediğini VARSAYMA/);
  });
});
