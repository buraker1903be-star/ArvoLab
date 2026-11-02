import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { belgeleriBirlestir, belgeListesiniTemizle, yonergedenBelgeler } from "@/lib/etik/belgeler";

const YONERGE = `MADDE 7 – Başvuru dosyasında şunlar bulunur. Başvuru Formu eksiksiz doldurulmalıdır.
Katılımcılara uygulanacak Bilgilendirilmiş Onam Formu ve anket formu eklenir.
Başkası tarafından geliştirilen ölçekler için ölçek kullanım izni belgesi sunulur.
Uygulamanın yapılacağı kurumdan alınan izin yazısı başvuruya eklenir. İSTANBUL ÜNİVERSİTESİ.`;

describe("yönergeden belge listesi", () => {
  test("yönergede geçen belgeler kaynak cümlesiyle bulunur", () => {
    const bulunan = yonergedenBelgeler(YONERGE);
    assert.deepEqual(bulunan.map((b) => b.anahtar), ["basvuru_formu", "onam_formu", "veri_toplama_araclari", "olcek_izni", "kurum_izni"]);
    const onam = bulunan.find((b) => b.anahtar === "onam_formu")!;
    assert.match(onam.alinti, /Bilgilendirilmiş Onam Formu/);
  });

  /* Sözlüğün asıl işi: yönergede GEÇMEYEN belge listeye giremez. */
  test("geçmeyen belge listeye girmez", () => {
    const anahtarlar = yonergedenBelgeler(YONERGE).map((b) => b.anahtar);
    for (const yok of ["ozgecmis", "butce", "veli_onami", "taahhutname", "danisman_onayi"]) assert.ok(!anahtarlar.includes(yok), yok);
    assert.deepEqual(yonergedenBelgeler("Bu belge yalnızca genel ilkeleri anlatır."), []);
  });

  test("büyük harf ve ı/i farkı eşleşmeyi bozmaz; İngilizce yönerge de okunur", () => {
    assert.ok(yonergedenBelgeler("ÖZGEÇMİŞLER EKLENİR.").some((b) => b.anahtar === "ozgecmis"));
    const en = yonergedenBelgeler("Attach the informed consent form, the questionnaire and parental consent where minors participate.");
    assert.deepEqual(en.map((b) => b.anahtar), ["onam_formu", "veli_onami", "veri_toplama_araclari"]);
  });
});

describe("listeyi birleştirme ve temizleme", () => {
  test("yeni tarama öğrencinin durumlarını ve elle eklediklerini korur", () => {
    const mevcut = [
      { anahtar: "onam_formu", ad: "Onam formu", durum: "hazir" as const, kaynak: "yonerge" as const, alinti: "eski" },
      { anahtar: "elle-1", ad: "Etik eğitim sertifikası", durum: "hazirlaniyor" as const, kaynak: "elle" as const },
    ];
    const sonuc = belgeleriBirlestir(mevcut, yonergedenBelgeler(YONERGE), "tr");
    assert.equal(sonuc.find((b) => b.anahtar === "onam_formu")?.durum, "hazir");
    assert.match(sonuc.find((b) => b.anahtar === "onam_formu")?.alinti ?? "", /Onam Formu/);
    assert.ok(sonuc.some((b) => b.anahtar === "elle-1"));
    assert.equal(sonuc.find((b) => b.anahtar === "basvuru_formu")?.durum, "eksik");
  });

  test("bozuk satırlar düşer, tekrar eden anahtar tek kalır, durum ve kaynak sınırlı", () => {
    const sonuc = belgeListesiniTemizle([
      { anahtar: "elle-1", ad: "  Sertifika ", durum: "hazir", kaynak: "elle" },
      { anahtar: "elle-1", ad: "Tekrar", durum: "hazir", kaynak: "elle" },
      { anahtar: "KÖTÜ anahtar", ad: "x" },
      { anahtar: "elle-2", ad: "" },
      { anahtar: "elle-3", ad: "Uydurma durum", durum: "onaylandi", kaynak: "baska" },
      null,
    ]);
    assert.deepEqual(sonuc, [
      { anahtar: "elle-1", ad: "Sertifika", durum: "hazir", kaynak: "elle", alinti: null },
      { anahtar: "elle-3", ad: "Uydurma durum", durum: "eksik", kaynak: "elle", alinti: null },
    ]);
    assert.deepEqual(belgeListesiniTemizle("dizi değil"), []);
  });
});
