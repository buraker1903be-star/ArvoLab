import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { onayUyarisi } from "@/lib/onay-uyarisi";
import type { SubmissionChecklist } from "@/lib/submission-checklist";

const liste = (durumlar: ("ok" | "warning" | "todo")[]): SubmissionChecklist => ({
  items: durumlar.map((status, i) => ({
    id: `m${i}`,
    label: i === 0 ? "Kapak sayfası" : `Madde ${i}`,
    status,
    detail: "",
  })),
  done: durumlar.filter((d) => d === "ok").length,
  total: durumlar.length,
});

const tutarsizlik = (baslik: string) => ({ tur: "atifsiz_kaynak" as const, baslik, aciklama: "" });

describe("onay uyarısı", () => {
  test("temiz onayda uyarı yok", () => {
    // Her onayda bildirim çıkarsa uyarı anlamını yitirir.
    assert.equal(onayUyarisi({ tutarsizliklar: [], hazirlik: liste(["ok", "ok"]) }), null);
    assert.equal(onayUyarisi({ tutarsizliklar: [], hazirlik: null }), null);
  });

  test("tek tutarsızlıkta başlığı geçer", () => {
    const uyari = onayUyarisi({
      tutarsizliklar: [tutarsizlik("2 kaynak metinde atıfsız")],
      hazirlik: liste(["ok"]),
    });
    assert.match(uyari ?? "", /onaylandı, ancak 2 kaynak metinde atıfsız var/);
  });

  test("birden çok tutarsızlıkta sayı verilir", () => {
    const uyari = onayUyarisi({
      tutarsizliklar: [tutarsizlik("A"), tutarsizlik("B")],
      hazirlik: null,
    });
    assert.match(uyari ?? "", /2 tutarsızlık/);
  });

  test("yalnızca eksik (todo) maddeler sayılır, bakılacaklar değil", () => {
    /*
      "warning" maddeleri bakılması iyi olan şeyler; onay anında hepsini
      saymak her onayda uyarı çıkarır.
    */
    assert.equal(onayUyarisi({ tutarsizliklar: [], hazirlik: liste(["warning", "warning"]) }), null);
    const uyari = onayUyarisi({ tutarsizliklar: [], hazirlik: liste(["todo", "warning"]) });
    assert.match(uyari ?? "", /teslim listesinde eksik: kapak sayfası/);
  });

  test("iki kaynak birlikte tek cümlede toplanır", () => {
    const uyari = onayUyarisi({
      tutarsizliklar: [tutarsizlik("A"), tutarsizlik("B")],
      hazirlik: liste(["todo", "todo"]),
    });
    assert.match(uyari ?? "", /2 tutarsızlık ve teslim listesinde 2 eksik madde/);
    assert.match(uyari ?? "", /Çalışma merkezinden inceleyin/);
  });
});
