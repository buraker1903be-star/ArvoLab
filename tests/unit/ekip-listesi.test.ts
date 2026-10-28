import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { basHarfler, ekipAdresi, ekipFiltresiOku, ekipSayaclari, ekipSuz, VARSAYILAN_EKIP_FILTRESI } from "@/lib/ekip-listesi";

const u = (id: string, ek: Record<string, unknown> = {}) => ({
  id, full_name: null, email: null, role: "client", organization_id: "k1", disabled: false, pendingInvite: false, ...ek,
});
const uyeler = [
  u("a", { full_name: "Ayşe Yılmaz", email: "ayse@x.co", role: "expert" }),
  u("b", { full_name: "İlker Demir", email: "ilker@x.co", pendingInvite: true }),
  u("c", { email: "c@x.co", organization_id: null }),
  u("d", { full_name: "Durdurulan", role: "controller", disabled: true }),
];

describe("ekip listesi", () => {
  test("arama ad ve e-postada, Türkçe harfle; rol ve kurum süzgeci", () => {
    const f = (ek: object) => ekipSuz(uyeler, { ...VARSAYILAN_EKIP_FILTRESI, ...ek }).map((x) => x.id);
    assert.deepEqual(f({ q: "İLKER" }), ["b"]);
    assert.deepEqual(f({ q: "c@x" }), ["c"]);
    assert.deepEqual(f({ rol: "expert" }), ["a"]);
    assert.deepEqual(f({ kurum: "k1" }), ["a", "b", "d"]);
  });

  test("her sayacın sayısı, adresinin açtığı listenin uzunluğu", () => {
    const sayaclar = ekipSayaclari(uyeler, VARSAYILAN_EKIP_FILTRESI);
    assert.deepEqual(Object.fromEntries(sayaclar.map((s) => [s.durum, s.sayi])), {
      tumu: 4, personel: 2, uye: 2, davet: 1, kurumsuz: 1, durdurulmus: 1,
    });
    for (const s of sayaclar) {
      const params = Object.fromEntries(new URL(s.href, "https://x").searchParams);
      assert.equal(ekipSuz(uyeler, ekipFiltresiOku(params, ["client", "expert"])).length, s.sayi, s.durum);
    }
  });

  test("seçili sayaç yeniden basınca kalkar; geçersiz değerler varsayılana döner", () => {
    const davet = ekipSayaclari(uyeler, { ...VARSAYILAN_EKIP_FILTRESI, durum: "davet" }).find((s) => s.durum === "davet")!;
    assert.equal(davet.secili, true);
    assert.equal(davet.href, "/dashboard/team");
    assert.deepEqual(ekipFiltresiOku({ rol: "korsan", durum: "hepsi" }, ["client"]), VARSAYILAN_EKIP_FILTRESI);
    assert.equal(ekipAdresi({ ...VARSAYILAN_EKIP_FILTRESI, rol: "expert" }, "a"), "/dashboard/team?rol=expert&sec=a");
  });

  test("baş harfler addan, yoksa e-postadan", () => {
    assert.equal(basHarfler("ilker demir", null), "İD");
    assert.equal(basHarfler(null, "mehmet.kaya@x.co"), "MK");
    assert.equal(basHarfler(null, null), "?");
  });
});

test("İngilizce sayaç etiketleri", () => {
  const sayaclar = ekipSayaclari([], VARSAYILAN_EKIP_FILTRESI, "en");
  assert.equal(sayaclar[0].etiket, "All users");
  assert.equal(sayaclar[3].etiket, "Invitation pending");
});
