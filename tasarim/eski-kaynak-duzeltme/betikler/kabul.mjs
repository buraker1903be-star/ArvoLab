// Eski kaynak düzeltme önerisi kabulü: belirsiz yazar rozeti, dizinden öneri
// (CANLI Crossref, lookupDoi), alan seçimi, yalnızca seçilen alanın yazılması.
// Yerel yığın + `NODE_USE_ENV_PROXY=1 next start -p 3150`. Depo kökünden:
//   node tasarim/eski-kaynak-duzeltme/betikler/kabul.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium } = createRequire(`${KOK}/package.json`)("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/eski-kaynak-kabul").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const KUL = T.hesaplar.bireysel;
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 300)); };

const ek = Date.now().toString(36).slice(-5);
const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis',${q(`Eski kaynak ${ek}`)},'writing') returning id`).split("\n")[0];
// Eski kayıt: yazarlar ad-önce + "and", cilt/sayı/sayfa yok; yayınevini öğrenci elle yazmış.
const KID = psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, doi_or_url, source_type, status, publisher) values ('${KUL.id}','${PR}','Trace-based just-in-time type specialization for dynamic languages','A. Gal and B. Eich','2009','https://doi.org/10.1145/1542476.1542528','article','used','Elle yazılmış yayınevi') returning id`).split("\n")[0];

const b = await chromium.launch();
const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 } });
await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
const s = await c.newPage();
const hatalar = [];
s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
await s.goto(`/dashboard/literature?calisma=${PR}`);
const satir = s.locator(".kaynak-satiri", { hasText: "Trace-based just-in-time" }).first();
await satir.waitFor({ timeout: 60000 });
kayit("belirsiz yazar biçimi rozeti görünür", await satir.getByText(/Yazar biçimi belirsiz/).isVisible());
const once = psql(`select coalesce(authors,'')||'|'||coalesce(volume,'')||'|'||coalesce(publisher,'') from literature_sources where id='${KID}'`);
await satir.getByRole("button", { name: /Dizinden düzeltme öner/ }).click();
await satir.locator(".kaynak-duzeltme-tablo").waitFor({ timeout: 30000 }).catch(() => {});
const tabloVar = await satir.locator(".kaynak-duzeltme-tablo").count();
if (!tabloVar) {
  const metin = await s.evaluate(() => document.body.innerText.slice(0, 4000));
  console.log("DIŞ SERVİS / HATA:", (metin.match(/(DOI[^\n]{0,160}|Crossref[^\n]{0,160}|alınamadı[^\n]{0,120})/) ?? [""])[0]);
  await b.close();
  process.exit(2);
}
const alanlar = await satir.locator(".kaynak-duzeltme-tablo tbody th").allTextContents();
kayit("dizinden öneri: farklı alanlar listelenir, hiçbir alan kendiliğinden değişmez", alanlar.includes("Yazarlar") && psql(`select coalesce(authors,'')||'|'||coalesce(volume,'')||'|'||coalesce(publisher,'') from literature_sources where id='${KID}'`) === once, { alanlar });
kayit("başlangıçta hiçbir alan işaretli değil; uygulama düğmesi kapalı", (await satir.locator(".kaynak-duzeltme input:checked").count()) === 0 && (await satir.getByRole("button", { name: /Seçilenleri uygula/ }).isDisabled()));
await s.screenshot({ path: OUT + "oneri.png" });
await satir.getByRole("checkbox", { name: /Yazarlar/ }).check();
await satir.getByRole("button", { name: /Seçilenleri uygula/ }).click();
await s.waitForTimeout(3000);
const sonra = psql(`select coalesce(authors,'')||'|'||coalesce(volume,'')||'|'||coalesce(publisher,'') from literature_sources where id='${KID}'`).split("|");
const ilk = once.split("|");
kayit("yalnızca seçilen alan (yazarlar) dizindeki değerle yazılır", sonra[0] !== ilk[0] && /^Gal, A\./.test(sonra[0]) && sonra[1] === ilk[1] && sonra[2] === ilk[2], { once, sonra: sonra.join("|") });
kayit("öğrencinin elle yazdığı yayınevi korunur", sonra[2] === "Elle yazılmış yayınevi");
await s.screenshot({ path: OUT + "uygulandi.png" });
kayit("sayfa hatası yok", hatalar.length === 0, { hatalar });
await b.close();
fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuc, null, 2));
const kalan = sonuc.filter((x) => !x.gecti).length;
console.log(`${sonuc.length - kalan}/${sonuc.length} geçti`);
process.exit(kalan ? 1 : 0);
