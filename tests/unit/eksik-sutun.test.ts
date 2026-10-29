import { test } from "node:test";
import assert from "node:assert/strict";
import { eksikSutunAdi } from "@/lib/eksik-sutun";

test("eksik sütunun adı iki hata biçiminden de okunur", () => {
  assert.equal(eksikSutunAdi({ code: "PGRST204", message: "Could not find the 'page_size' column of 'project_manuscripts' in the schema cache" }), "page_size");
  assert.equal(eksikSutunAdi({ code: "42703", message: 'column "include_toc" of relation "project_manuscripts" does not exist' }), "include_toc");
  assert.equal(eksikSutunAdi({ code: "42703", message: "başka bir şey" }), null);
  assert.equal(eksikSutunAdi(null), null);
});
