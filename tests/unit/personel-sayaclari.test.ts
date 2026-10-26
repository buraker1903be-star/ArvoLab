import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { personelSayaclari } from "@/lib/personel-sayaclari";
import { applyProjectFilters, DEFAULT_PROJECT_FILTERS, parseProjectFilters } from "@/lib/project-filters";
import { PROJECT_STATUSES } from "@/lib/project-labels";

describe("personel sayaçları", () => {
  test("her sayacın sayısı, adresinin açtığı listenin uzunluğu", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    const c = (id: string, ek: Record<string, unknown>) => ({
      id, title: id, university: null, status: "in_progress", due_date: null, created_at: "2026-10-01T00:00:00Z",
      assignee_id: null, assignee_name: null, controller_approved_at: null, ...ek,
    });
    const calismalar = [
      c("a", { status: "ready" }),
      c("b", { status: "ready", controller_approved_at: "2026-10-20T00:00:00Z", assignee_id: "p1" }),
      c("c", { due_date: "2026-10-20", assignee_id: "p1" }),
      c("d", { due_date: "2026-10-29" }),
      c("e", { status: "delivered", assignee_name: "Eski" }),
    ];
    const baglam = { lastEdited: () => undefined, openComments: (id: string) => (id === "d" ? 2 : 0), userId: "p1", canFilterAssignee: true, now };
    const sayaclar = personelSayaclari(calismalar, DEFAULT_PROJECT_FILTERS, baglam);
    const sayi = Object.fromEntries(sayaclar.map((s) => [s.anahtar, s.sayi]));
    assert.deepEqual(sayi, { aktif: 4, onay: 1, atanmamis: 2, gecikmis: 1, yaklasan: 1, yorum: 1 });
    for (const s of sayaclar) {
      const params = Object.fromEntries(new URL(s.href, "https://x").searchParams);
      const liste = applyProjectFilters(calismalar, parseProjectFilters(params, PROJECT_STATUSES), baglam);
      assert.equal(liste.length, s.sayi, s.anahtar);
    }
  });

  test("seçili sayaç işaretlenir ve tekrar basınca filtreyi kaldırır", () => {
    const filtre = { ...DEFAULT_PROJECT_FILTERS, approval: "bekliyor" as const, q: "tez" };
    const sayaclar = personelSayaclari([], filtre, { lastEdited: () => undefined, canFilterAssignee: true });
    const onay = sayaclar.find((s) => s.anahtar === "onay")!;
    assert.equal(onay.secili, true);
    assert.equal(onay.href, "/dashboard/editor");
    assert.equal(sayaclar.filter((s) => s.secili).length, 1);
  });
});
