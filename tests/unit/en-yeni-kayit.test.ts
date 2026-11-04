import test from "node:test";
import assert from "node:assert/strict";
import { belgeBasinaEnYeni } from "@/lib/en-yeni-kayit";

test("belge başına en yeni kayıt, sıradan bağımsız", () => {
  const sonuc = belgeBasinaEnYeni([
    { id: "a1", document_id: "A", created_at: "2026-11-01T10:00:00Z" },
    { id: "b1", document_id: "B", created_at: "2026-11-03T10:00:00Z" },
    { id: "a2", document_id: "A", created_at: "2026-11-04T09:00:00Z" },
    { id: "a0", document_id: "A", created_at: "2026-10-01T10:00:00Z" },
  ]);
  assert.deepEqual(Object.fromEntries(sonuc), { A: "a2", B: "b1" });
});

test("kaydı olmayan belge haritada yok; boş girdi boş harita", () => {
  assert.equal(belgeBasinaEnYeni([]).size, 0);
  assert.equal(belgeBasinaEnYeni([{ id: "x", document_id: "X", created_at: "2026-01-01T00:00:00Z" }]).has("Y"), false);
});

test("eşit zamanda ilk görülen kalır", () => {
  const sonuc = belgeBasinaEnYeni([
    { id: "ilk", document_id: "A", created_at: "2026-11-04T09:00:00Z" },
    { id: "ikinci", document_id: "A", created_at: "2026-11-04T09:00:00Z" },
  ]);
  assert.equal(sonuc.get("A"), "ilk");
});
