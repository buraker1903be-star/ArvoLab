import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { bildirimBasligi, bildirimGovdesi } from "@/lib/bildirim-metni";

describe("bildirim metni", () => {
  test("İngilizce arayüzde bilinen bildirimler çevrilir", () => {
    assert.equal(bildirimBasligi("Yeni yorum: Tezim", "en"), "New comment: Tezim");
    assert.equal(bildirimBasligi("Çalışmanızın durumu: İncelemede", "en"), "Your work's status: In review");
    assert.equal(bildirimBasligi("Çalışmanıza uzman atandı", "en"), "An expert was assigned to your work");
    assert.equal(bildirimGovdesi("Bir ekip üyesi: güzel olmuş", "en"), "A team member: güzel olmuş");
    assert.equal(
      bildirimGovdesi("Tezim — Atıf sisteminiz APA 7 → IEEE olarak güncellendi; kaynakça denetimi artık bu sisteme göre çalışır.", "en"),
      "Tezim — Your citation style changed from APA 7 to IEEE; the reference check now follows this style.",
    );
  });

  test("Türkçe arayüz ve tanınmayan metin olduğu gibi kalır", () => {
    assert.equal(bildirimBasligi("Yeni yorum: Tezim", "tr"), "Yeni yorum: Tezim");
    assert.equal(bildirimBasligi("Paylaşım bağlantınız açıldı", "en"), "Paylaşım bağlantınız açıldı");
  });

  /*
    Kalıplar tetikleyici metinleriyle birebir olmalı. Bir migration metni
    değiştirirse bu test, çevirinin sessizce düşmesini yakalar.
  */
  test("tetikleyicilerin yazdığı sabit başlıkların hepsi çeviride var", () => {
    const klasor = "supabase/migrations";
    const sql = readdirSync(klasor).map((f) => readFileSync(`${klasor}/${f}`, "utf8")).join("\n");
    const basliklar = new Set(
      [...sql.matchAll(/notify\([^;]*?'(?:comment|assignment|status|approval|guideline_update)',\s*'([^']+)'/g)].map((m) => m[1]),
    );
    assert.ok(basliklar.size >= 5, [...basliklar].join(" | "));
    for (const b of basliklar) {
      assert.notEqual(bildirimBasligi(b.endsWith(": ") ? `${b}X` : b, "en"), b.endsWith(": ") ? `${b}X` : b, `Çevrilmeyen: ${b}`);
    }
  });
});
