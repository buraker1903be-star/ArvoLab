import { test } from "node:test";
import assert from "node:assert/strict";
import { denemeHakki, DENEME_ASISTAN_HAKKI } from "@/lib/ai/deneme-hakki";

test("denemedeki bireysel abone 2 tamamlanmış çalışmadan sonra durur", () => {
  assert.deepEqual(denemeHakki({ tur: "individual", durum: "trialing", kullanilan: 0 }), { denemede: true, kalan: 2, engel: null });
  assert.deepEqual(denemeHakki({ tur: "individual", durum: "trialing", kullanilan: 1 }), { denemede: true, kalan: 1, engel: null });
  const bitti = denemeHakki({ tur: "individual", durum: "trialing", kullanilan: DENEME_ASISTAN_HAKKI });
  assert.ok(bitti.denemede && bitti.kalan === 0 && bitti.engel?.includes("aboneliğinizi başlatın"));
  const asti = denemeHakki({ tur: "individual", durum: "trialing", kullanilan: 7 }, "en");
  assert.ok(asti.denemede && asti.kalan === 0 && asti.engel?.startsWith("You've used"));
});

test("ödeyen abone, kurum üyesi ve iç ekip deneme kuralının dışında", () => {
  for (const [tur, durum] of [["individual", "active"], ["individual", "past_due"], ["organization", "trialing"], ["staff", "internal"]]) {
    assert.deepEqual(denemeHakki({ tur, durum, kullanilan: 99 }), { denemede: false }, `${tur}/${durum}`);
  }
});

/* AGENTS.md: kapıyı yalnızca net bir "hayır" kapatır. */
test("sayı okunamazsa engel yok", () => {
  assert.deepEqual(denemeHakki({ tur: "individual", durum: "trialing", kullanilan: null }), { denemede: true, kalan: DENEME_ASISTAN_HAKKI, engel: null });
});
