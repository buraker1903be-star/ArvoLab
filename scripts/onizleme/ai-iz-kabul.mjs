/*
  AI İZİ, YAZARLIK RAPORU VE EKSİK REGRESYONLAR KABULÜ (V4.3-C2-3, C2-7,
  09.11.2026). Gerçek panel ve editör, sahte sağlayıcı.

  C2-3 — asistan izi kullanıcının açık kabul yollarının HEPSİNDE oluşur:
    Kabul et · Düzenleyerek kabul et · Paragrafın altına ekle · Tab
  ve geri alma / yinelemede doğru korunur (geri alınınca iz de gider,
  yinelenince aynı kayıtla geri gelir). Yazarlık raporu ölçmediği şeyi
  iddia etmez: yalnızca ArvoLab'ın izleyebildiği kabul edilen eklemeler;
  kopyala–yapıştır ve dışarıdan gelen metin AI ya da insan diye
  sınıflandırılmaz; izlenen yollar arasında Tab da sayılır.
  C2-7 — kütüphanede olmayan kaynak, uydurma DOI, künye satırı düşer;
    sağlayıcı hatası ve zaman aşımı anlaşılır mesaj verir; hiçbirinde kart,
    belge değişikliği ya da kayıt isteği olmaz. Öneri üretmek ve reddetmek
    kayıt isteği GÖNDERMEZ; kabul etmek tam BİR kayıt isteği gönderir.
  Önizleme: ONIZLEME_YAZ=1 npm run onizleme:ai
    NODE_PATH=$(npm root -g) node scripts/onizleme/ai-iz-kabul.mjs [taban]
  Çıkış: 0 temiz, 1 bir senaryo düştü.
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("ai-iz-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let gecen = 0;
let toplam = 0;
const tarayici = await chromium.launch();

async function senaryo(ad, fn) {
  toplam++;
  try {
    await fn();
    gecen++;
    console.log(`✓ ${ad}`);
  } catch (hata) {
    console.log(`✗ ${ad}\n    ${String(hata?.message ?? hata).split("\n")[0].slice(0, 300)}`);
  }
}
const bekle = (kosul, mesaj) => {
  if (!kosul) throw new Error(mesaj);
};

/* Kayıt isteği: belge içeriğini (doc JSON) taşıyan sunucu işlemi. AI isteği "gorev" taşır, belge taşımaz. */
async function editorAc() {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem("arvolab:inceleme-paneli", "0"));
  const sayfa = await ctx.newPage();
  const kayitlar = [];
  sayfa.on("request", (r) => {
    if (r.method() !== "POST" || !r.headers()["next-action"]) return;
    const govde = r.postData() ?? "";
    if (govde.includes('"type":"doc"') && !govde.includes('"gorev"')) kayitlar.push(Date.now());
  });
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.locator(".ProseMirror").waitFor();
  return { ctx, sayfa, kayitlar };
}
const belgeJson = (s) => s.evaluate(() => JSON.stringify(document.querySelector(".ProseMirror").editor.getJSON()));
const izliMetinler = (s) =>
  s.evaluate(() => {
    const sonuc = [];
    const gez = (d) => {
      if (d.type === "text") {
        const iz = (d.marks ?? []).find((m) => m.type === "asistanIzi");
        if (iz) sonuc.push({ metin: d.text, kayit: iz.attrs?.kayit ?? null });
      }
      (d.content ?? []).forEach(gez);
    };
    gez(document.querySelector(".ProseMirror").editor.getJSON());
    return sonuc;
  });
/* Önizlemenin yazma kipinde önceki senaryonun kabul ettiği metin belleğe kaydedilir; iz beklentisi göreli: yalnızca YENİ izler. */
const yeniIzler = (once, sonra) => {
  const kalan = once.map((i) => i.metin);
  return sonra.filter((i) => {
    const k = kalan.indexOf(i.metin);
    if (k >= 0) {
      kalan.splice(k, 1);
      return false;
    }
    return true;
  });
};
const sec = async (s, n = 0) => {
  await s.evaluate((n) => {
    const par = [...document.querySelectorAll(".ProseMirror p")].filter((e) => e.textContent.trim().length > 60)[n];
    const r = document.createRange();
    r.selectNodeContents(par);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  }, n);
  await s.waitForFunction(() => !document.querySelector(".ProseMirror").editor.state.selection.empty, null, { timeout: 5000 });
};
const imlecSona = (s, n = 0) =>
  s.evaluate((n) => {
    const ed = document.querySelector(".ProseMirror").editor;
    let hedef = 0;
    let say = 0;
    ed.state.doc.descendants((node, pos) => {
      if (hedef || node.type.name !== "paragraph" || node.textContent.length <= 80) return;
      if (say++ === n) hedef = pos + node.nodeSize - 1;
    });
    ed.chain().focus().setTextSelection(hedef).run();
  }, n);
const asistaniAc = async (s) => {
  if (!(await s.locator(".yazim-girdi textarea").isVisible().catch(() => false))) await s.locator("button.yazma-ai").click();
  await s.locator(".yazim-girdi textarea").waitFor();
};
const iste = async (s, metin) => {
  await s.locator(".yazim-girdi textarea").fill(metin);
  await s.locator(".yazim-girdi textarea").press("Enter");
};
const kart = (s) => s.locator(".yazim-oneri").last();
const kartSayisi = (s) => s.locator(".yazim-oneri").count();
const kartBekle = (s, n) => s.waitForFunction((n) => document.querySelectorAll(".yazim-oneri").length >= n, n, { timeout: 30000 });
const asistanMesajiBekle = async (s, onceki) => {
  await s.waitForFunction((n) => document.querySelectorAll(".yazim-mesaj[data-rol='asistan']").length > n, onceki, { timeout: 30000 });
  // Son asistan baloncuğu bir an boş (bekleme) olabilir: metni gelene kadar beklenir.
  await s.waitForFunction(() => {
    const l = [...document.querySelectorAll(".yazim-mesaj[data-rol='asistan']")];
    return (l.at(-1)?.textContent ?? "").trim().length > 0;
  }, null, { timeout: 30000 });
  return s.locator(".yazim-mesaj[data-rol='asistan']").last().innerText();
};
const asistanMesajSayisi = (s) => s.locator(".yazim-mesaj[data-rol='asistan']").count();
const KAYIT_BEKLE = 7000; // otomatik kayıt gecikmesi büyük belgede 4 sn (manuscript-editor.tsx autosaveDelay)

// ---- C2-3 + C2-7/4: Kabul et, iz, geri al / yinele, kayıt isteği sayısı ----
{
  const { ctx, sayfa, kayitlar } = await editorAc();
  const ilk = await belgeJson(sayfa);

  await senaryo("öneri üretmek ve reddetmek kayıt isteği göndermez, belgeyi değiştirmez", async () => {
    await asistaniAc(sayfa);
    await sec(sayfa, 0);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Akademikleştir" }).click();
    await kartBekle(sayfa, 1);
    await sayfa.waitForTimeout(KAYIT_BEKLE);
    bekle(kayitlar.length === 0, `öneri üretilince ${kayitlar.length} kayıt isteği`);
    await kart(sayfa).getByRole("button", { name: "Reddet" }).click();
    await sayfa.waitForTimeout(KAYIT_BEKLE);
    bekle(kayitlar.length === 0, `reddedince ${kayitlar.length} kayıt isteği`);
    bekle((await belgeJson(sayfa)) === ilk, "belge değişti");
  });

  let kabulEdilen = [];
  let izOnce = [];
  await senaryo("Kabul et: eklenen metin asistan izi taşır; tam BİR kayıt isteği", async () => {
    await sec(sayfa, 0);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Akademikleştir" }).click();
    await kartBekle(sayfa, 2);
    const once = kayitlar.length;
    izOnce = await izliMetinler(sayfa);
    await kart(sayfa).getByRole("button", { name: "Kabul et", exact: true }).click();
    await sayfa.waitForTimeout(KAYIT_BEKLE);
    kabulEdilen = await izliMetinler(sayfa);
    // Kayıt kimliği önizlemede boş: çalışma kaydı yönetici istemcisi ister, önizlemede yok (gerçek Supabase'te UNVERIFIED).
    bekle(yeniIzler(izOnce, kabulEdilen).length > 0, `yeni iz yok: ${JSON.stringify(kabulEdilen).slice(0, 160)}`);
    bekle(kayitlar.length - once === 1, `kabulden sonra ${kayitlar.length - once} kayıt isteği (beklenen 1)`);
  });

  await senaryo("Ctrl+Z kabulü izle birlikte geri alır; yineleme aynı kayıtla izi geri getirir", async () => {
    await sayfa.locator(".ProseMirror").first().focus();
    await sayfa.keyboard.press("Control+z");
    await sayfa.waitForTimeout(200);
    bekle(JSON.stringify(await izliMetinler(sayfa)) === JSON.stringify(izOnce), "geri alınca iz kaldı");
    bekle((await belgeJson(sayfa)) === ilk, "geri alma özgün metni getirmedi");
    await sayfa.keyboard.press("Control+Shift+z");
    await sayfa.waitForTimeout(200);
    const yine = await izliMetinler(sayfa);
    bekle(JSON.stringify(yine) === JSON.stringify(kabulEdilen), `yinelemede iz farklı: ${JSON.stringify(yine).slice(0, 160)}`);
  });

  await senaryo("yazarlık raporu yalnızca izlenebilen kabul edilen eklemeleri sayar; kopyala–yapıştırı AI/insan diye sınıflandırmaz", async () => {
    // Panel asistan görünümünde açık: İnceleme sekmesine geçilir (panel düğmesi paneli kapatırdı).
    await sayfa.getByRole("tab", { name: /İnceleme/ }).click();
    await sayfa.locator("button.yan-kutu", { hasText: "Yazarlık" }).click();
    const pencere = sayfa.locator("[role=dialog]", { hasText: "Yazarlık raporu" }).last();
    await pencere.waitFor({ timeout: 10000 });
    const metin = (await pencere.innerText()).replace(/\s+/g, " ");
    bekle(/kabul edilen/i.test(metin), `başlık/açıklama izlenebilir kabulleri söylemiyor: "${metin.slice(0, 200)}"`);
    bekle(/\bTab\b/.test(metin), "Tab ile kabul izlenen yollar arasında sayılmıyor");
    bekle(/sınıflandırılmaz/i.test(metin), "kopyala–yapıştır ve dış metnin sınıflandırılmadığı yazmıyor");
    bekle(/insan yazımı anlamına gelmez/i.test(metin), "yüzdenin geri kalanının insan yazımı sayılmadığı yazmıyor");
    bekle(!/Gövdenin %\d+'i yazım asistanından eklendi/.test(metin), "başlık eski kesin iddiayı taşıyor ('gövdenin %X'i asistandan eklendi')");
    // Yüzde tam sayıya yuvarlanır (15 sözcük / 6.000 → %0); ölçülen asistan sözcük sayısı ayrıca yazıyor.
    const asistanSozcuk = Number((/bunun ([\d.]+) sözcüğü/.exec(metin)?.[1] ?? "0").replace(/\./g, ""));
    bekle(asistanSozcuk > 0, `raporda asistan sözcüğü ${asistanSozcuk}`);
  });
  await ctx.close();
}

// ---- C2-3: Düzenleyerek kabul et, Paragrafın altına ekle, Tab ----
{
  const { ctx, sayfa } = await editorAc();
  await senaryo("Düzenleyerek kabul et: kullanıcının düzenlediği metin asistan izi taşır", async () => {
    await asistaniAc(sayfa);
    await sec(sayfa, 1);
    await sayfa.locator(".yazim-hizli-dugme", { hasText: "Genişlet" }).click();
    await kartBekle(sayfa, 1);
    const izOnce = await izliMetinler(sayfa);
    await kart(sayfa).getByRole("button", { name: "Düzenleyerek kabul et" }).click();
    await kart(sayfa).locator("textarea").fill("ÖĞRENCİNİN DÜZENLEDİĞİ METİN.");
    await kart(sayfa).locator("textarea").press("Control+Enter");
    await sayfa.waitForTimeout(400);
    const iz = yeniIzler(izOnce, await izliMetinler(sayfa));
    bekle(iz.some((i) => i.metin.includes("ÖĞRENCİNİN DÜZENLEDİĞİ METİN.")), `yeni iz yok: ${JSON.stringify(iz).slice(0, 160)}`);
  });
  await senaryo("Paragrafın altına ekle: eklenen paragraf asistan izi taşır", async () => {
    await imlecSona(sayfa, 3);
    await iste(sayfa, "bu bölüm için bir paragraf yaz");
    await kartBekle(sayfa, 2);
    const izOnce = await izliMetinler(sayfa);
    await kart(sayfa).getByRole("button", { name: "Paragrafın altına ekle" }).click();
    await sayfa.waitForTimeout(400);
    const iz = yeniIzler(izOnce, await izliMetinler(sayfa));
    bekle(iz.some((i) => i.metin.includes("kuramsal çerçevesi")), `yeni iz yok: ${JSON.stringify(iz).slice(0, 200)}`);
  });
  await ctx.close();
}
{
  const { ctx, sayfa } = await editorAc();
  await senaryo("Tab ile kabul: iz oluşur; Ctrl+Z yalnızca öneriyi geri alır, yineleme izle geri getirir", async () => {
    await imlecSona(sayfa, 0);
    await sayfa.keyboard.type(" Ayrıca");
    const izOnce = await izliMetinler(sayfa);
    await sayfa.keyboard.press("Alt+/");
    await sayfa.locator(".ProseMirror .satir-ici-oneri").waitFor({ timeout: 20000 });
    await sayfa.keyboard.press("Tab");
    await sayfa.waitForTimeout(200);
    const iz = yeniIzler(izOnce, await izliMetinler(sayfa));
    bekle(iz.some((i) => i.metin.includes("zayıflamaktadır")), `Tab izi yok: ${JSON.stringify(iz)}`);
    await sayfa.keyboard.press("Control+z");
    await sayfa.waitForTimeout(200);
    bekle(JSON.stringify(await izliMetinler(sayfa)) === JSON.stringify(izOnce), "geri alınca iz kaldı");
    bekle((await belgeJson(sayfa)).includes("Ayrıca"), "Ctrl+Z öneriden önce yazılanı da sildi");
    await sayfa.keyboard.press("Control+Shift+z");
    await sayfa.waitForTimeout(200);
    bekle(yeniIzler(izOnce, await izliMetinler(sayfa)).some((i) => i.metin.includes("zayıflamaktadır")), "yinelemede iz yok");
  });
  await ctx.close();
}

// ---- C2-7: reddedilen cevaplar ve sağlayıcı hataları ----
{
  const { ctx, sayfa, kayitlar } = await editorAc();
  const ilk = await belgeJson(sayfa);
  await asistaniAc(sayfa);
  for (const [tetik, desen, ad] of [
    ["UYDURMA_KAYNAK", /kütüphanenizde olmayan bir kaynağa/, "kütüphanede olmayan kaynak"],
    ["UYDURMA_DOI", /kütüphanenizde olmayan bir kaynağa/, "uydurma DOI"],
    ["UYDURMA_KUNYE", /kütüphanenizde olmayan bir kaynağa/, "künye satırı"],
    ["SAGLAYICI_HATASI", /ulaşılamıyor/, "sağlayıcı hatası (HTTP 500)"],
    ["ZAMAN_ASIMI", /zamanında yanıt vermedi/, "zaman aşımı"],
  ]) {
    await senaryo(`${ad}: cevap gösterilmez, anlaşılır mesaj; kart, belge değişikliği ve kayıt isteği yok`, async () => {
      const kartOnce = await kartSayisi(sayfa);
      const mesajOnce = await asistanMesajSayisi(sayfa);
      const kayitOnce = kayitlar.length;
      await imlecSona(sayfa, 2);
      await iste(sayfa, `${tetik} bu bölüm için bir paragraf yaz`);
      const mesaj = await asistanMesajiBekle(sayfa, mesajOnce);
      bekle(desen.test(mesaj), `mesaj: "${mesaj.slice(0, 160)}"`);
      await sayfa.waitForTimeout(1500);
      bekle((await kartSayisi(sayfa)) === kartOnce, "öneri kartı oluştu");
      bekle((await belgeJson(sayfa)) === ilk, "belge değişti");
      bekle(kayitlar.length === kayitOnce, "kayıt isteği gönderildi");
    });
  }
  await ctx.close();
}

await tarayici.close();
console.log(`\n${gecen}/${toplam} senaryo geçti`);
process.exit(gecen === toplam ? 0 : 1);
