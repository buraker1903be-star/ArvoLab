import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { describe } from "node:test";
import { calismaResimKlasorleri, isWriterImagePath, storagePathFromUrl } from "@/lib/editor-resim-yolu";

/*
  EDİTÖR RESMİ İMZALAMA (Security Hardening S1.1, 06.11.2026). İmzalama
  yönetici istemcisiyle (RLS'siz) yapılıyor; hangi yolun imzalanacağına
  yalnızca bu kararlar bakıyor. Eskiden atanan kişinin klasörü de kabul
  ediliyordu: sahibin assignee_id'yi yazabildiği bir veritabanında A, B'yi
  kendi çalışmasına atayıp B'nin editor-images dosyalarını imzalatabilirdi.
*/
const CALISMA = "11111111-1111-4111-8111-111111111111";
const SAHIP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATANAN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BASKA_CALISMA = "22222222-2222-4222-8222-222222222222";

describe("calismaResimKlasorleri", () => {
  test("yalnızca çalışma ve sahip; atanan kişi nesnede olsa da listeye girmez", () => {
    const calisma = { id: CALISMA, owner_id: SAHIP_A, assignee_id: ATANAN_B };
    assert.deepEqual(calismaResimKlasorleri(calisma), [CALISMA, SAHIP_A]);
  });
  test("eksik sahip güvenli tarafa düşer", () => {
    assert.deepEqual(calismaResimKlasorleri({ id: CALISMA, owner_id: null }), [CALISMA]);
    assert.deepEqual(calismaResimKlasorleri({ id: CALISMA, owner_id: "" }), [CALISMA]);
  });
});

describe("isWriterImagePath: atama zinciri kapalı", () => {
  const klasorler = calismaResimKlasorleri({ id: CALISMA, owner_id: SAHIP_A });
  test("meşru: çalışma klasörü (yeni yol) ve sahibin klasörü (eski yol)", () => {
    assert.equal(isWriterImagePath(`${CALISMA}/editor-images/1730000000000-sekil.png`, klasorler), true);
    assert.equal(isWriterImagePath(`${SAHIP_A}/editor-images/eski.png`, klasorler), true);
    assert.equal(isWriterImagePath(`${CALISMA.toUpperCase()}/editor-images/x.png`, klasorler), true);
  });
  test("atanan kişinin (B) klasörü REDDEDİLİR", () => {
    assert.equal(isWriterImagePath(`${ATANAN_B}/editor-images/1730000000000-gizli.png`, klasorler), false);
  });
  test("başka çalışmanın klasörü reddedilir", () => {
    assert.equal(isWriterImagePath(`${BASKA_CALISMA}/editor-images/x.png`, klasorler), false);
  });
  test("editor-images dışındaki dosyalar (Word çıktısı, belgeler, PDF) reddedilir", () => {
    for (const yol of [`${CALISMA}/exports/x.docx`, `${SAHIP_A}/documents/tez.pdf`, `${CALISMA}/kaynak-pdf/a.pdf`, `${CALISMA}/editor-images/alt/x.png`]) {
      assert.equal(isWriterImagePath(yol, klasorler), false, yol);
    }
  });
  test("klasörden çıkma denemeleri reddedilir", () => {
    for (const yol of [`${CALISMA}/editor-images/..`, `${CALISMA}/editor-images/.`, `${CALISMA}/editor-images/../../${ATANAN_B}/editor-images/x.png`, `../${CALISMA}/editor-images/x.png`]) {
      assert.equal(isWriterImagePath(yol, klasorler), false, yol);
    }
  });
});

describe("storagePathFromUrl", () => {
  const onceki = process.env.NEXT_PUBLIC_SUPABASE_URL;
  test("yalnızca kendi Supabase adresimizin project-files yolları; kodlanmış '/' klasör değiştiremez", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ornekornekornekornek.supabase.co";
    const taban = "https://ornekornekornekornek.supabase.co/storage/v1/object/sign/project-files/";
    assert.equal(storagePathFromUrl(`${taban}${CALISMA}/editor-images/x.png?token=t`), `${CALISMA}/editor-images/x.png`);
    assert.equal(storagePathFromUrl(`https://kotu.example.com/storage/v1/object/sign/project-files/${CALISMA}/editor-images/x.png`), null);
    const kodlu = storagePathFromUrl(`${taban}${CALISMA}/editor-images/..%2F..%2F${ATANAN_B}%2Feditor-images%2Fx.png`);
    assert.equal(isWriterImagePath(kodlu ?? "", calismaResimKlasorleri({ id: CALISMA, owner_id: SAHIP_A })), false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = onceki;
  });
});

describe("dört imzalama noktası aynı listeyi kullanıyor", () => {
  const dosyalar = [
    "app/share/[token]/page.tsx",
    "app/api/manuscripts/[projectId]/export/route.ts",
    "app/dashboard/editor/[id]/write/page.tsx",
    "app/print/manuscript/[id]/page.tsx",
  ];
  for (const dosya of dosyalar) {
    test(dosya, () => {
      const kaynak = readFileSync(dosya, "utf8");
      assert.match(kaynak, /calismaResimKlasorleri\(/, "yardımcı kullanılmıyor");
      /* Eski kalıp: [project.id, project.owner_id, project.assignee_id] — bir değişkenin .assignee_id alanı imzalama listesinde. */
      assert.doesNotMatch(kaynak, /\[[^\]\n]*\.owner_id,\s*[\w.]*\.assignee_id\s*\]/, "elle yazılmış, atanan kişiyi içeren klasör listesi geri gelmiş");
    });
  }
  test("depoda refreshImageUrls/downloadWriterImage çağıran başka dosya yok", async () => {
    const { execSync } = await import("node:child_process");
    const cikti = execSync("grep -rlE 'refreshImageUrls\\(|downloadWriterImage\\(' app lib --include=*.ts --include=*.tsx", { encoding: "utf8" });
    const bulunan = cikti.trim().split("\n").filter((f) => f !== "lib/manuscript-images.ts").sort();
    assert.deepEqual(bulunan, [...dosyalar].sort());
  });
});
