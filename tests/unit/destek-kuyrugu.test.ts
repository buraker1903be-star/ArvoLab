import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { acikKuyruk, KUYRUK_ETIKETI, KUYRUK_ETIKETI_METIN, kuyrukAdresi, kuyrukEtiketi, seciliKayit } from "@/lib/destek-kuyrugu";

describe("destek kuyrukları", () => {
  test("istenen kuyruk erişilebilirse açılır, değilse işi olan ilk kuyruk", () => {
    const sayilar: Record<string, number> = { "uzman-acik": 0, "uzman-bana": 2, destek: 5, "geri-bildirim": 1 };
    const sayi = (t: string) => sayilar[t] ?? 0;
    assert.equal(acikKuyruk(["uzman-acik", "uzman-bana", "destek"], "destek", sayi), "destek");
    assert.equal(acikKuyruk(["uzman-acik", "uzman-bana", "destek"], null, sayi), "uzman-bana");
    // Yetkisi olmayan kuyruk adres satırından açılamaz.
    assert.equal(acikKuyruk(["uzman-acik", "uzman-bana"], "destek", sayi), "uzman-bana");
    assert.equal(acikKuyruk(["geri-bildirim"], "korsan", () => 0), "geri-bildirim");
    assert.equal(acikKuyruk([], null, sayi), null);
  });

  test("seçim listede yoksa ilk kayıt; adres kuyruğu ve seçimi taşır", () => {
    assert.equal(seciliKayit(["a", "b"], "b"), "b");
    assert.equal(seciliKayit(["a", "b"], "silinmis"), "a");
    assert.equal(seciliKayit([], "a"), null);
    assert.equal(kuyrukAdresi("destek", "x1"), "/dashboard/expert-requests?kuyruk=destek&sec=x1");
  });
});

test("kuyruk etiketleri iki dilde; eski harita Türkçe", () => {
  assert.equal(kuyrukEtiketi("uzman-bana", "en"), "Assigned to me");
  assert.equal(kuyrukEtiketi("uzman-bana"), "Bana atanan");
  for (const [tur, metin] of Object.entries(KUYRUK_ETIKETI_METIN)) assert.equal(KUYRUK_ETIKETI[tur as keyof typeof KUYRUK_ETIKETI], metin.tr);
});
