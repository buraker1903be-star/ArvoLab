// Madde 3: sığdır / yakınlaştır / Pasaja odaklan ölçek ve yazı yüksekliği (üretim derlemesi).
import { chromium, oturum, ac, yaz, H } from "./ortak.mjs";
const CIKTI = process.env.CIKTI ?? ".";
const b = await chromium.launch();
const olc = (s) => s.evaluate(() => {
  const alan = document.querySelector(".kaynak-pdf-paneli .pdf-sayfa-alani").getBoundingClientRect();
  const sp = [...document.querySelectorAll(".pdf-sayfa .textLayer span")].find((x) => x.textContent.length > 20);
  const pas = [...document.querySelectorAll(".pdf-sayfa .textLayer span.pdf-pasaj")];
  const pr = pas[0]?.getBoundingClientRect();
  return { yuzde: document.querySelector(".pdf-yuzde")?.textContent, yaziPx: sp ? Math.round(sp.getBoundingClientRect().height * 10) / 10 : null,
    pasajParca: pas.length, pasajPx: pr ? Math.round(pr.height * 10) / 10 : null,
    pasajGorunur: pr ? pr.top >= alan.top && pr.bottom <= alan.bottom && pr.left >= alan.left - 1 && pr.left < alan.right : null,
    pasajMetin: pas.map((x) => x.textContent).join("").slice(0, 70) };
});
for (const [g, h, adres] of (process.env.ATLA ? [] : [[1440, 900, "?sol=kaynaklar&sag=pdf"], [1280, 800, "?sag=pdf"]])) {
  const { c, s } = await oturum(b, { genislik: g, yukseklik: h });
  await ac(s, `${yaz}${adres}`); await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(1200);
  const satir = [`sığdır ${JSON.stringify(await olc(s))}`];
  for (let i = 1; i <= 4; i++) {
    await s.getByRole("button", { name: /^Yakınlaştır$/ }).first().click(); await s.waitForTimeout(1200);
    const r = await olc(s); satir.push(`+${i} ${r.yuzde} yazı ${r.yaziPx}px`);
  }
  await s.screenshot({ path: `${CIKTI}/yakinlastir-${g}.png` });
  await s.getByRole("button", { name: /^Genişliğe sığdır$/ }).first().click(); await s.waitForTimeout(800);
  console.log(g, adres, "\n  " + satir.join("\n  "));
  await c.close();
}
// Doğrulanmış pasaj: alıntı ekle → atıf kartı → Dayanağa git → Pasaja odaklan (1440, liste + PDF).
{
  const { c, s } = await oturum(b, { genislik: 1440, yukseklik: 900 });
  await ac(s, `${yaz}?sag=pdf`);
  if ((await s.locator(".kaynak-pdf-paneli select").first().inputValue()) !== H.PDF) await s.locator(".kaynak-pdf-paneli select").first().selectOption(H.PDF);
  await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 });
  const bagla = s.locator(".kaynak-pdf-paneli").getByRole("button", { name: /^Kaynağa bağla$/ });
  if (!process.env.ESLESMEYOK && await bagla.count()) { await bagla.first().click(); await s.waitForTimeout(2500); console.log("PDF kaynağa bağlandı"); }
  await s.evaluate(() => { const ed = document.querySelector(".ProseMirror").editor; let hedef = null, say = 0;
    ed.state.doc.descendants((n, pos) => { if (hedef !== null) return false; if (n.type.name === "paragraph" && ++say === 2) hedef = pos + n.nodeSize - 1; }); ed.commands.setTextSelection(hedef); });
  await s.evaluate(() => { const hedef = [...document.querySelectorAll(".pdf-sayfa .textLayer span")].find((x) => x.textContent.includes("The effect was strongest"));
    const r = document.createRange(); r.selectNodeContents(hedef); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); hedef.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
  await s.getByRole("button", { name: /Alıntı ve atıf ekle/ }).click();
  await s.waitForSelector(".kaynak-dogrulandi", { timeout: 60000 });
  await s.locator('input[name="kaynak-aday"]').first().check().catch(() => {});
  await s.locator(".kaynak-onay input[type=checkbox]").first().check().catch(() => {});
  await s.getByRole("button", { name: /^İmlece ekle$/ }).click(); await s.waitForTimeout(2500);
  await s.locator('a[href*="sol=kaynaklar"]').first().click(); await s.waitForTimeout(1500);
  for (let d = 0; d < 4 && !(await s.locator(".atif-karti").count()); d++) {
    const k = await s.evaluate(() => { const y = document.createTreeWalker(document.querySelector(".ProseMirror"), NodeFilter.SHOW_TEXT); let n;
      let son = null; while ((n = y.nextNode())) { const i = n.data.lastIndexOf("sessions.” (Kaya"); if (i >= 0) son = [n, i]; } if (!son) return null; const r = document.createRange(); r.setStart(son[0], son[1] + 12); r.setEnd(son[0], son[1] + 13); const q = r.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    if (!k) { await s.screenshot({ path: `${CIKTI}/atif-yok.png` }); throw new Error("atıf metni bulunamadı"); }
    await s.mouse.click(k.x, k.y); await s.waitForTimeout(1200);
  }
  await s.screenshot({ path: `${CIKTI}/atif-tik.png` }); console.log("kart:", await s.locator(".atif-karti").count());
  if (process.env.ESLESMEYOK) {
    console.log("kart metni:", (await s.locator(".atif-karti").first().innerText()).replace(/\s+/g, " ").slice(0, 200));
    await s.locator(".atif-karti").getByRole("button", { name: /PDF'i aç/ }).first().click(); await s.waitForTimeout(3500);
    await s.waitForSelector(".pdf-sayfa .textLayer span", { timeout: 60000 }); await s.waitForTimeout(800);
    const r = await olc(s); console.log("eşleşme yok → PDF'i aç:", JSON.stringify(r), "odaklan düğmesi:", await s.locator(".pdf-pasaja-odaklan").count(), "eşleşme vurgusu:", await s.locator(".pdf-sayfa .textLayer span.pdf-esles").count());
    await s.screenshot({ path: `${CIKTI}/eslesme-yok-pdf.png` }); await c.close(); await b.close(); process.exit(0);
  }
  await s.getByRole("button", { name: /Dayanağa git/ }).first().click({ timeout: 8000 }); await s.waitForTimeout(3500);
  const once = await olc(s); await s.screenshot({ path: `${CIKTI}/pasaj-dayanak-1440.png` });
  const dugme = s.locator(".pdf-pasaja-odaklan");
  console.log("Dayanağa git (1440, liste + PDF):", JSON.stringify(once), "odaklan düğmesi:", await dugme.count());
  await dugme.first().click(); await s.waitForTimeout(2500);
  const sonra = await olc(s); await s.screenshot({ path: `${CIKTI}/pasaj-odaklan-1440.png` });
  console.log("Pasaja odaklan:", JSON.stringify(sonra));
  await c.close();
}
await b.close();
