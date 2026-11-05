import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { hedefKarari, hedefKimligi, kaynakHedefi } from "@/lib/kaynak-hedefi";

/*
  KAYNAĞIN HEDEF ÇALIŞMASI (Signature OS 4.3.5, B6). Eskiden elle ekleme,
  atıf penceresi ve literatür araması istemcinin gönderdiği çalışma
  kimliğini olduğu gibi yazıyordu; başkasının çalışmasına sahibinin
  göremeyeceği kaynak bağlanabiliyordu.
*/

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";
const TEZ_A = "00000000-0000-4000-8000-0000000000b1";
const TEZ_B = "00000000-0000-4000-8000-0000000000b9";

/** Sahte istemci: yalnızca academic_projects.select("id").eq("id").eq("owner_id").maybeSingle(). */
function istemci(projeler: { id: string; owner_id: string }[], hata = false) {
  const sorgular: Record<string, string>[] = [];
  return {
    sorgular,
    from: () => ({
      select: () => ({
        eq: (_s1: string, id: string) => ({
          eq: (_s2: string, sahip: string) => ({
            maybeSingle: async () => {
              sorgular.push({ id, sahip });
              if (hata) return { data: null, error: { message: "ağ" } };
              const p = projeler.find((x) => x.id === id && x.owner_id === sahip);
              return { data: p ? { id: p.id } : null, error: null };
            },
          }),
        }),
      }),
    }),
  };
}
const PROJELER = [
  { id: TEZ_A, owner_id: A },
  { id: TEZ_B, owner_id: B },
];

test("kendi çalışması: kabul; kimlik küçük harfe indirgenir", async () => {
  assert.deepEqual(await kaynakHedefi(istemci(PROJELER), A, TEZ_A.toUpperCase()), { durum: "tamam", projectId: TEZ_A });
});

test("başkasının çalışması: reddedilir, başka çalışmaya YÖNLENDİRİLMEZ", async () => {
  assert.deepEqual(await kaynakHedefi(istemci(PROJELER), A, TEZ_B), { durum: "yetkisiz" });
});

test("var olmayan çalışma, yetkisizle AYNI cevap (varlık sızdırılmaz)", async () => {
  const yok = await kaynakHedefi(istemci(PROJELER), A, "00000000-0000-4000-8000-0000000000ff");
  const yabanci = await kaynakHedefi(istemci(PROJELER), A, TEZ_B);
  assert.deepEqual(yok, yabanci);
});

test("geçersiz kimlik veritabanına sorulmaz; boş değer çalışmasız kaynaktır", async () => {
  const c = istemci(PROJELER);
  assert.deepEqual(await kaynakHedefi(c, A, "'; drop table x; --"), { durum: "yetkisiz" });
  assert.deepEqual(await kaynakHedefi(c, A, "  "), { durum: "bagsiz" });
  assert.deepEqual(await kaynakHedefi(c, A, null), { durum: "bagsiz" });
  assert.equal(c.sorgular.length, 0);
});

test("okunamazsa 'okunamadı' (geçici arıza yetkisiz sayılmaz, kaynak da eklenmez)", async () => {
  assert.deepEqual(await kaynakHedefi(istemci(PROJELER, true), A, TEZ_A), { durum: "okunamadi" });
  assert.deepEqual(hedefKarari(TEZ_A, { data: null, error: { code: "x" } }), { durum: "okunamadi" });
});

test("hedefKimligi: biçim", () => {
  assert.deepEqual(hedefKimligi(undefined), { tur: "bos" });
  assert.deepEqual(hedefKimligi("abc"), { tur: "gecersiz" });
  assert.equal(hedefKimligi(` ${TEZ_A} `).tur, "kimlik");
});

test("kaynak oluşturan HER sunucu yolu hedefi doğrular (yeni bir yol eklenirse bu test hatırlatır)", () => {
  const yollar = readdirSync("app/actions").filter((ad) => ad.endsWith(".ts")).map((ad) => `app/actions/${ad}`);
  let denetlenen = 0;
  for (const yol of yollar) {
    const kod = readFileSync(yol, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const ekleme = (kod.match(/from\("literature_sources"\)\s*\.insert\(/g) ?? []).length;
    if (!ekleme) continue;
    denetlenen++;
    assert.ok(kod.includes("kaynakHedefi("), `${yol}: kaynak ekliyor ama hedef çalışmayı doğrulamıyor`);
    // İstemciden gelen kimlik doğrudan satıra yazılmaz.
    assert.equal(/project_id:\s*(String\(|text\()/.test(kod), false, `${yol}: project_id istemciden doğrudan yazılıyor`);
  }
  assert.ok(denetlenen >= 3, "kaynak ekleyen yollar bulunamadı; test kör kaldı");
});
