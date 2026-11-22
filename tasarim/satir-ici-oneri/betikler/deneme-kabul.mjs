// Deneme hesabında satır içi öneri (21.11.2026). Yerel yığın + model taklidi.
// Deneme durumu ArvoOS köprüsünden gelir (lib/subscription.ts: ensure); yerel
// yığında köprü yok, bu yüzden betik kendi köprü TAKLİDİNİ açar (54902) ve
// uygulama ona bağlı ayrı bir portta başlatılır:
//   ARVOOS_BRIDGE_URL=http://127.0.0.1:54902 PRODUCT_BRIDGE_SECRET=yerel-kopru \
//     npx next start -p 3151
//   URL=http://localhost:3151 node tasarim/satir-ici-oneri/betikler/deneme-kabul.mjs
// Taklit yalnızca bu betiğin açtığı hesaba "trialing" der, ötekilere "active".
// Betik YEREL yığında geçici, sentetik bir deneme hesabı açar ve sonunda
// siler. Model taklit; GERÇEK MODEL DEĞİL.
//
// Sınanan kural: denemede otomatik öneri kapalı başlar (abonenin aynı
// tarayıcıdaki tercihi taşınmaz), açmak iki adımlıdır ve ilk adım her öneri
// isteğinin 2 deneme hakkından birini kullandığını söyler; Alt+/ da aynı
// haktan düşer; hak bitince öneri duraklar ve nedeni görünür.
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium } = createRequire(`${KOK}/package.json`)("playwright");
const U = process.env.URL ?? "http://localhost:3151";
const OUT = (process.env.CIKTI ?? "/tmp/satir-ici-oneri-deneme").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const GECIT = "http://127.0.0.1:54401", SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`; return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`; };
const SERVIS = imzala({ role: "service_role" });
const auth = async (yol, govde, yontem = "POST") => { const r = await fetch(`${GECIT}/auth/v1${yol}`, { method: yontem, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" }, body: govde ? JSON.stringify(govde) : undefined }); return r.json().catch(() => ({})); };
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };

// ── Geçici deneme hesabı (yalnızca yerel yığın)
const ek = crypto.randomBytes(3).toString("hex");
const adres = `deneme-oneri-${ek}@yerel.test`;
// ArvoOS köprüsü taklidi: abonelik durumunu ArvoOS'un cevap biçiminde verir.
const kopru = http.createServer((istek, cevap) => {
  let govde = "";
  istek.on("data", (p) => { govde += p; });
  istek.on("end", () => {
    if (istek.headers["x-arvo-bridge-secret"] !== "yerel-kopru") { cevap.writeHead(401).end("unauthorized"); return; }
    const g = JSON.parse(govde || "{}");
    const deneme = String(g.email ?? "").startsWith("deneme-oneri-");
    cevap.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
      status: deneme ? "trialing" : "active", access: true,
      trialEndsAt: deneme ? new Date(Date.now() + 3 * 864e5).toISOString() : null,
      currentPeriodEnd: deneme ? null : new Date(Date.now() + 30 * 864e5).toISOString(),
      plans: [], cardStorage: false,
    }));
  });
});
await new Promise((r) => kopru.listen(54902, "127.0.0.1", r));
const parola = `Dn7!${crypto.randomBytes(9).toString("base64url")}`;
const u = await auth("/admin/users", { email: adres, password: parola, email_confirm: true, user_metadata: { full_name: "Deniz Deneme" } });
if (!u.id) throw new Error(`hesap açılamadı: ${JSON.stringify(u)}`);
await auth(`/admin/users/${u.id}`, { password: parola }, "PUT");
const SURUM = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
psql(`update public.profiles set role = 'client', full_name = 'Deniz Deneme', organization_id = null where id = '${u.id}'`);
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi) values ('${u.id}','kullanim_sozlesmesi','${SURUM}','tr','${"0".repeat(64)}','giris',true)`);
psql(`insert into public.individual_subscriptions (user_id, status, trial_ends_at) values ('${u.id}', 'trialing', now() + interval '3 days') on conflict (user_id) do update set status = 'trialing', trial_ends_at = excluded.trial_ends_at`);
const P = (metin) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text: metin }] });
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${u.id}','thesis','Deneme tezi ${ek}','writing') returning id`).split("\n")[0];
const belge = { type: "doc", content: [P("Üniversiteye yeni başlayan öğrencilerin akademik uyum süreci, ilk dönemdeki destek ağlarıyla yakından ilişkilidir")] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify(belge))}::jsonb, 'x')`);
const kosular = () => Number(psql(`select count(*) from public.ai_assistant_runs where user_id='${u.id}' and status='completed' and capability <> 'kilavuz'`));
const tumKayitlar = () => Number(psql(`select count(*) from public.ai_assistant_runs where user_id='${u.id}'`));

const b = await chromium.launch();
const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
// Aynı tarayıcıda daha önce ABONE olarak açılmış öneri tercihi: denemeye taşınmamalı.
await c.addInitScript(() => { try { localStorage.setItem("arvolab:otomatik-oneri", "1"); } catch {} });
const s = await c.newPage();
const hatalar = [];
s.on("pageerror", (e) => hatalar.push(`${s.url()} :: ${String(e).slice(0, 200)}`));
try {
  await s.goto("/"); await s.fill('input[name="email"]', adres); await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  const ac = async () => { await s.goto(`/dashboard/editor/${PR}/write`); await s.waitForSelector(".ProseMirror"); await s.waitForTimeout(1200); };
  const ed = (fn) => s.evaluate((f) => new Function("e", `return (${f})(e)`)(document.querySelector(".ProseMirror").editor), fn.toString());
  const sonaGit = async () => { await s.locator(".ProseMirror").first().click(); await ed((e) => { e.commands.focus("end"); return true; }); await s.waitForFunction(() => document.querySelector(".ProseMirror")?.editor?.isFocused === true, null, { timeout: 5000 }); };
  const oneri = () => s.evaluate(() => document.querySelector(".satir-ici-oneri")?.textContent ?? null);
  const bildirim = () => s.evaluate(() => [...document.querySelectorAll("[role=status], .toast, [data-toast], .toast-yigini")].map((e) => e.textContent).join(" | "));
  await ac();
  const dugme = s.getByRole("button", { name: /Otomatik öneri/ }).first();

  // 1) Başlangıçta kapalı; abonenin tarayıcıdaki "açık" tercihi taşınmadı.
  const etiket0 = (await dugme.getAttribute("aria-label")) ?? "";
  kayit("denemede otomatik öneri kapalı başlar (abone tercihi taşınmaz)", (await dugme.getAttribute("aria-pressed")) === "false", { basili: await dugme.getAttribute("aria-pressed") });
  kayit("ipucu bedeli açmadan önce söyler: 2 deneme hakkı, kalan 2, Alt+/ dahil", /2 deneme hakkınızdan/.test(etiket0) && /kalan: 2/.test(etiket0) && /Alt\+\//.test(etiket0), { etiket0: etiket0.slice(0, 200) });
  const n0 = tumKayitlar();
  await sonaGit(); await s.keyboard.type(" ve", { delay: 40 }); await s.waitForTimeout(2600);
  kayit("kapalıyken duraksama istek göndermez", tumKayitlar() === n0 && !(await oneri()));

  // 2) İlk tıklama açmaz, bedeli söyler.
  await dugme.click(); await s.waitForTimeout(300);
  const b1 = await bildirim();
  kayit("ilk tıklama açmaz; uyarı her isteğin bir deneme hakkı kullandığını söyler", (await dugme.getAttribute("aria-pressed")) === "false" && /Deneme hesabı/.test(b1) && /kalan: 2/.test(b1) && /bir kez daha/.test(b1), { b1: b1.slice(0, 220) });
  kayit("düğme onay beklediğini gösterir", /Öneri · onayla/.test((await dugme.textContent()) ?? ""), { metin: await dugme.textContent() });
  await s.screenshot({ path: OUT + "deneme-onay.png" });
  await s.waitForTimeout(2600);
  kayit("onay beklerken istek gitmez", tumKayitlar() === n0);

  // 3) İkinci tıklama açar.
  await dugme.click(); await s.waitForTimeout(300);
  const b2 = await bildirim();
  kayit("ikinci tıklama açar; bildirim hak kullanımını yineler", (await dugme.getAttribute("aria-pressed")) === "true" && /bir deneme hakkı/.test(b2), { b2: b2.slice(0, 220) });

  // 4) Otomatik istek bir deneme hakkı yer; kabul (Tab) ek hak yemez.
  const k0 = kosular();
  await sonaGit(); await s.keyboard.type(" çok", { delay: 40 });
  let o = null; for (let i = 0; i < 40 && !o; i++) { await s.waitForTimeout(200); o = await oneri(); }
  const k1 = kosular();
  kayit("otomatik öneri geldi ve bir deneme hakkı kullanıldı", !!o && k1 === k0 + 1, { o, once: k0, sonra: k1 });
  await s.keyboard.press("Tab"); await s.waitForTimeout(800);
  kayit("Tab ile kabul ek hak kullanmaz", kosular() === k1, { sonra: kosular() });

  // 5) Yeniden yükleme: ipucu kalan hakkı günceller, tercih (açık) korunur.
  // Kabulden hemen sonra yüklenince otomatik kayıt bitmemiş olabilir: editör
  // yerel taslağı sorar ve karar verilene kadar salt okunur kalır (ürünün
  // bilinçli davranışı). Taslak geri yüklenir.
  await ac();
  const geriYukle = s.getByRole("button", { name: "Geri yükle" });
  if (await geriYukle.isVisible().catch(() => false)) { await geriYukle.click(); await s.waitForTimeout(800); }
  const etiket1 = (await dugme.getAttribute("aria-label")) ?? "";
  kayit("yeniden açınca kalan hak 1 görünür, öneri açık kalır", /kalan: 1/.test(etiket1) && (await dugme.getAttribute("aria-pressed")) === "true", { etiket1: etiket1.slice(0, 160) });
  // Otomatik isteği kapatıp Alt+/ ile iste: aynı haktan düşmeli.
  await dugme.click(); await s.waitForTimeout(300);
  kayit("kapatmak tek tıklama", (await dugme.getAttribute("aria-pressed")) === "false");
  await s.waitForTimeout(3300);
  await sonaGit(); await s.keyboard.type(" de"); await s.keyboard.press("Alt+/");
  o = null; for (let i = 0; i < 40 && !o; i++) { await s.waitForTimeout(200); o = await oneri(); }
  const k2 = kosular();
  kayit("Alt+/ de deneme hakkından düşer", !!o && k2 === k1 + 1, { o, once: k1, sonra: k2 });
  await s.keyboard.press("Escape");

  // 6) Hak bitti: Alt+/ istek üretmez, nedeni görünür.
  await s.waitForTimeout(3300);
  const nB = tumKayitlar();
  await sonaGit(); await s.keyboard.type(" x"); await s.keyboard.press("Alt+/"); await s.waitForTimeout(1500);
  const govde = await s.evaluate(() => document.body.innerText);
  kayit("hak bitince istek gitmez ve nedeni söylenir", tumKayitlar() === nB && !(await oneri()) && /deneme/i.test(govde) && /abonel/i.test(govde), { yeni: tumKayitlar() - nB });
  await s.screenshot({ path: OUT + "deneme-hak-bitti.png" });
  kayit("sayfa hatası yok", hatalar.length === 0, { hatalar });
} finally {
  await b.close();
  kopru.close();
  // Temizlik: yalnızca bu betiğin açtığı yerel hesap ve verisi.
  try {
    psql(`delete from public.project_manuscripts where project_id='${PR}'`);
    psql(`delete from public.academic_projects where id='${PR}'`);
    psql(`delete from public.individual_subscriptions where user_id='${u.id}'`);
  } catch (h) { console.log("temizlik uyarısı:", String(h).slice(0, 200)); }
}
fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuc, null, 2));
const kalan = sonuc.filter((x) => !x.gecti).length;
console.log(`${sonuc.length - kalan}/${sonuc.length} geçti`);
process.exit(kalan ? 1 : 0);
