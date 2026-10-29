import { test } from "node:test";
import assert from "node:assert/strict";
import { yasalAdres } from "@/lib/yasal-baglantilar";

test("yasal metin kullanıcının dilinde açılır", () => {
  assert.equal(yasalAdres("gizlilik", "en"), "https://arvo-os.com/privacy");
  assert.equal(yasalAdres("gizlilik", "tr"), "https://arvo-os.com/tr/gizlilik");
  assert.equal(yasalAdres("mesafeli-satis", "en"), "https://arvo-os.com/distance-sales-agreement");
  assert.equal(yasalAdres("iptal-iade", "tr"), "https://arvo-os.com/tr/iptal-ve-iade");
});
