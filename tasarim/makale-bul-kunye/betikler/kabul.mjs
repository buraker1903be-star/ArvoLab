// MAKALE BUL OTOMATİK KÜNYE KONTROLÜ KABULÜ (20.11.2026). Yalnızca 127.0.0.1, sentetik hesap.
// Arama ve künye kontrolü GERÇEK Crossref/OpenAlex'e gider (ağda api.crossref.org, api.openalex.org açık).
// İki aşama, aralarında sunucu yeniden başlatılır:
//   ASAMA=normal node tasarim/makale-bul-kunye/betikler/kabul.mjs
//     → sonuçlar beklemeden, rozetler arkada; ≤3 eşzamanlı; görünürler önce; eski arama yeni listeyi
//       değiştirmez; önbellek; eklenen kaynak kontrol edilmiş bilgiyle
//   (sunucuyu HTTPS_PROXY=http://127.0.0.1:9 ile, yani dizinlere ULAŞAMAZ hâlde yeniden başlat)
//   ASAMA=ariza node tasarim/makale-bul-kunye/betikler/kabul.mjs
//     → aynı sonuçlar oturumdan döner, kontroller servis arızası alır: "Kontrol edilemedi",
//       nötr ton, "yanlış kaynak" denmez
// Durum $CIKTI/durum.json'da taşınır. Çıkış: 0 hepsi geçti, 1 en az biri düştü.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium, devices } = createRequire(`${KOK}/package.json`)("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/makale-bul-kunye").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const AŞAMA = process.env.ASAMA ?? "normal";
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const KUL = T.hesaplar.bireysel;
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };
const DURUM = `${OUT}durum.json`;

const b = await chromium.launch();
async function giris(secenek = {}) {
  const c = await b.newContext({ baseURL: U, viewport: { width: 1440, height: 900 }, ...secenek });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: U }]);
  const s = await c.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hatalar };
}
/* Künye kontrolü sunucu işlemi çağrıları: aynı anda uçuştaki sayı ve toplam. Arama isteği ayrı sayılır (gövdesinde "sorgu" var). */
function istekSayaci(s) {
  const d = { ucusta: 0, enCok: 0, toplam: 0, aramalar: 0, iptal: 0, basliklar: [], govdeler: [] };
  const kunyeMi = (r) => r.method() === "POST" && r.url().includes("/api/kunye-kontrol");
  s.on("request", (r) => { if (r.method() === "POST" && /"sorgu"/.test(r.postData() ?? "")) d.aramalar += 1; if (kunyeMi(r)) { d.govdeler.push(r.postData() ?? ""); d.basliklar.push((/"baslik":"([^"]{0,50})/.exec(r.postData() ?? "") ?? [])[1]); d.ucusta += 1; d.toplam += 1; d.enCok = Math.max(d.enCok, d.ucusta); } });
  const bitti = (r) => { if (kunyeMi(r)) d.ucusta -= 1; };
  s.on("requestfinished", bitti);
  s.on("requestfailed", (r) => { if (kunyeMi(r)) d.iptal += 1; bitti(r); });
  return d;
}
const rozetler = (s) => s.evaluate(() => [...document.querySelectorAll("li[data-kunye-anahtari]")].map((li) => ({ baslik: li.querySelector("strong")?.textContent ?? "", durum: li.querySelector("[data-kunye-durumu]")?.getAttribute("data-kunye-durumu"), metin: li.querySelector("[data-kunye-durumu]")?.textContent ?? "", ton: li.querySelector("[data-kunye-durumu]")?.getAttribute("data-tone"), neden: li.querySelector("[data-kunye-nedeni]")?.textContent ?? "" })));
const bekleBitis = (s, sure = 90000) => s.waitForFunction(() => { const r = [...document.querySelectorAll("[data-kunye-durumu]")]; return r.length > 0 && r.every((x) => x.getAttribute("data-kunye-durumu") !== "kontrol_ediliyor"); }, null, { timeout: sure }).then(() => true).catch(() => false);
const ara = async (s, sorgu) => {
  const alan = s.locator('input[type="search"]').first();
  await alan.fill(sorgu);
  await s.getByRole("button", { name: /^Ara$/ }).first().click();
};

if (AŞAMA === "normal") {
  const ek = Date.now().toString(36).slice(-5);
  const PR = psql(`insert into public.academic_projects (owner_id, project_type, title, status) values ('${KUL.id}','thesis',${q(`Künye kontrolü ${ek}`)},'writing') returning id`).split("\n")[0];
  psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${PR}', ${q(JSON.stringify({ type: "doc", content: [{ type: "paragraph", attrs: {}, content: [{ type: "text", text: "Giriş." }] }] }))}::jsonb, 'x') on conflict (project_id) do update set content = excluded.content`);
  psql(`delete from public.auth_rate_limits where key like '%${KUL.id}%'`);
  // Sentetik hesabın önceki koşulardan kalan TraceMonkey kaydı: "Listeme ekle" yeniden görünsün.
  psql(`delete from public.literature_sources where owner_id='${KUL.id}' and title ilike 'Trace-based just-in-time%'`);
  const { c, s, hatalar } = await giris();
  const sayac = istekSayaci(s);
  await s.goto(`/dashboard/editor/${PR}/write?sol=arama`);
  await s.locator('input[type="search"]').first().waitFor({ timeout: 60000 });

  // 1) Sonuçlar bekletilmeden; rozetler arkada.
  const t0 = Date.now();
  await ara(s, "trace-based just-in-time type specialization dynamic languages");
  await s.waitForSelector("li[data-kunye-anahtari]", { timeout: 60000 });
  const listeSure = Date.now() - t0;
  const ilk = await rozetler(s);
  kayit("sonuçlar künye kontrolünü beklemeden listelenir (ilk anda en az bir rozet 'kontrol ediliyor')", ilk.length > 0 && ilk.some((r) => r.durum === "kontrol_ediliyor"), { listeSure, n: ilk.length, durumlar: ilk.map((r) => r.durum) });
  await s.screenshot({ path: `${OUT}1-ilk-an.png` });
  const bitti = await bekleBitis(s);
  const son = await rozetler(s);
  const bitisSure = Date.now() - t0;
  kayit("rozetler arkada güncellenir; hepsi beş durumdan biriyle sonuçlanır", bitti && son.every((r) => ["eslesti", "eksik", "belirsiz", "kontrol_edilemedi"].includes(r.durum)), { bitisSure, sayim: son.reduce((o, r) => ({ ...o, [r.durum]: (o[r.durum] ?? 0) + 1 }), {}) });
  const tm = son.find((r) => /trace-based just-in-time/i.test(r.baslik));
  /*
    TraceMonkey'in iki sürümü var (PLDI bildirisi ve SIGPLAN Notices, iki DOI). Dizinlerin o
    anki sıralamasına göre ya tek sürüm gelir ("eşleşti") ya da birleştirme iki sürümü tek kayda
    katar ve kontrol bunu "belirsiz · başka bir sürümü" diye söyler. İkisi de doğru davranış;
    yanlış olan "kontrol edilemedi" ya da sebepsiz "belirsiz" olurdu.
  */
  kayit("TraceMonkey: eşleşti (dizin adıyla) ya da iki sürüm için sürüm uyarısı", Boolean(tm && ((tm.durum === "eslesti" && /Crossref|OpenAlex/.test(tm.metin)) || (tm.durum === "belirsiz" && /başka bir sürümü/.test(tm.neden)))), tm);
  kayit("sonuçların çoğu öteki dizinle eşleşti", son.filter((r) => r.durum === "eslesti").length >= son.length / 2, { eslesti: son.filter((r) => r.durum === "eslesti").length, n: son.length });
  kayit("'Kontrol edilemedi' ve 'Belirsiz' tehlike tonunda değil", son.every((r) => r.ton !== "danger"), {});
  kayit("kontroller paralel gider ama en çok 3 eşzamanlı", sayac.enCok >= 2 && sayac.enCok <= 3, { enCok: sayac.enCok, toplam: sayac.toplam });
  await s.screenshot({ path: `${OUT}2-tamamlandi.png` });

  // 2) Önbellek: aynı arama yeniden → künye isteği yok, rozetler hemen son hâlinde.
  const once = sayac.toplam;
  await ara(s, "trace-based just-in-time type specialization dynamic languages ");
  await s.waitForTimeout(800);
  await s.waitForSelector("li[data-kunye-anahtari]", { timeout: 60000 });
  await s.waitForTimeout(1500);
  const tekrar = await rozetler(s);
  kayit("önbellek: aynı sonuçlar yeniden sorulmaz", sayac.toplam === once && tekrar.every((r) => r.durum !== "kontrol_ediliyor"), { yeniIstek: sayac.toplam - once });

  // 3) Eski arama yeni listeyi değiştirmez: A'nın listesi gelir gelmez B; A'nın bekleyenleri atılır,
  //    B'nin her kaydı TAM bir kez sorulur, ekrandaki rozetler B'nin kayıtlarına ait.
  const onceAB = sayac.toplam;
  /* Yavaş dizin taklidi: künye istekleri tarayıcıda 1,2 sn bekletilir (sunucu önbelleği sıcakken de A yarıda kalsın). */
  const iptalOnce = sayac.iptal;
  await s.route("**/api/kunye-kontrol", async (route) => {
    await new Promise((x) => setTimeout(x, 1200));
    await route.continue().catch(() => {});
  });
  await ara(s, "peer mentoring first year university students transition");
  await s.waitForSelector("li[data-kunye-anahtari]", { timeout: 60000 });
  await s.waitForFunction(() => [...document.querySelectorAll("li[data-kunye-anahtari] strong")].some((x) => /mentor/i.test(x.textContent ?? "")), null, { timeout: 60000 });
  const aBasliklar = (await rozetler(s)).map((r) => r.baslik);
  await ara(s, "seasonal influenza vaccination effectiveness elderly");
  await s.waitForFunction(() => { const l = [...document.querySelectorAll("li[data-kunye-anahtari] strong")].map((x) => x.textContent ?? ""); return l.length > 0 && l.every((x) => !/mentor/i.test(x)); }, null, { timeout: 60000 });
  const bBitti = await bekleBitis(s);
  const bRozet = await rozetler(s);
  await s.unroute("**/api/kunye-kontrol");
  const govde = sayac.govdeler.slice(onceAB);
  const icinde = (baslik) => govde.filter((g) => g.includes(JSON.stringify(baslik).slice(1, -1))).length;
  const aSorulan = aBasliklar.filter((x) => icinde(x) > 0).length;
  const bSayim = bRozet.map((r) => icinde(r.baslik));
  kayit("ikinci arama: eski aramanın bekleyen kontrolleri atıldı, uçuştakiler iptal edildi", aSorulan < aBasliklar.length && sayac.iptal > iptalOnce, { aSorulan, aSayisi: aBasliklar.length, iptal: sayac.iptal - iptalOnce });
  kayit("ikinci arama: yeni listenin her kaydı en çok bir kez soruldu (iki listede ortak olan önbellekten)", bBitti && bSayim.every((n) => n <= 1) && bSayim.filter((n) => n === 1).length >= bSayim.length - 1, { bSayim });
  kayit("ikinci arama: listede yalnızca yeni aramanın kayıtları, hepsinin rozeti sonuçlandı", bRozet.every((r) => r.durum !== "kontrol_ediliyor") && bRozet.every((r) => !/mentor/i.test(r.baslik)), { ornek: bRozet.slice(0, 2) });

  // 4) Ekleme kontrol edilmiş bilgiyle: TraceMonkey'i ekle, satırdaki yıl/DOI öteki dizinle tutarlı.
  await ara(s, "trace-based just-in-time type specialization dynamic languages");
  await s.waitForSelector("li[data-kunye-anahtari]", { timeout: 60000 });
  await bekleBitis(s);
  const satir = s.locator("li[data-kunye-anahtari]").filter({ hasText: /Trace-based just-in-time/i }).filter({ has: s.locator('[data-kunye-durumu="eslesti"]') }).first();
  await satir.getByRole("button", { name: /Listeme ekle/ }).click();
  await s.waitForTimeout(2500);
  const eklenen = psql(`select coalesce(year,'') || '|' || coalesce(doi_or_url,'') from public.literature_sources where owner_id='${KUL.id}' and title ilike 'Trace-based just-in-time%' order by created_at desc limit 1`);
  kayit("eklenen kaynak: yıl 2009 ve DOI (öteki dizinle teyitli bilgi)", /^2009\|https:\/\/doi\.org\/10\.1145\//.test(eklenen), { eklenen });
  await s.screenshot({ path: `${OUT}3-eklendi.png` });

  // Koyu tema ve telefon görüntüleri.
  await s.emulateMedia({ colorScheme: "dark" });
  await s.screenshot({ path: `${OUT}4-koyu.png` });
  kayit("normal aşama: sayfa hatası yok", hatalar.length === 0, hatalar);
  const yanitHam = await s.evaluate((pr) => sessionStorage.getItem(`arvolab.sol.${pr}.arama.yanit`), PR);
  fs.writeFileSync(`${OUT}yanit.json`, yanitHam ?? "null");
  kayit("arama sonuçları oturumda saklandı (arıza aşaması için)", Boolean(yanitHam && JSON.parse(yanitHam)?.kayitlar?.length), {});
  fs.writeFileSync(DURUM, JSON.stringify({ PR }));
  await c.close();

  const tel = await giris({ ...devices["iPhone 13"] });
  await tel.s.goto(`/dashboard/editor/${PR}/write?sol=arama`);
  await tel.s.locator('input[type="search"]').first().waitFor({ timeout: 60000 });
  await ara(tel.s, "trace-based just-in-time type specialization dynamic languages");
  await tel.s.waitForSelector("li[data-kunye-anahtari]", { timeout: 60000 });
  const telBitti = await bekleBitis(tel.s);
  const telRozet = await rozetler(tel.s);
  kayit("telefon: aynı rozetler (sunucu önbelleğinden)", telBitti && telRozet.length > 0 && telRozet.every((r) => r.durum && r.durum !== "kontrol_ediliyor"), { n: telRozet.length });
  await tel.s.screenshot({ path: `${OUT}5-telefon.png` });
  await tel.s.emulateMedia({ colorScheme: "dark" });
  await tel.s.screenshot({ path: `${OUT}5-telefon-koyu.png` });
  await tel.c.close();
} else {
  // ARIZA: sunucu dizinlere ulaşamıyor. Oturumdaki arama sonuçları korunur, künye kayıtları silinir → yeniden sorulur.
  const { PR } = JSON.parse(fs.readFileSync(DURUM, "utf8"));
  // Yeni giriş: tek oturum kuralı telefondaki girişten sonra eski oturumu kapatıyor ("başka cihaz").
  const { c, s, hatalar } = await giris();
  // Oturum durumu sessionStorage'da; storageState onu taşımadığı için arama burada yeniden yapılamaz (dizin yok).
  // Bunun yerine sonuçlar sayfa açılmadan önce enjekte edilir: aynı biçim, gerçek önceki yanıt.
  const yanit = JSON.parse(fs.readFileSync(`${OUT}yanit.json`, "utf8"));
  await s.addInitScript(([pr, y]) => { try { sessionStorage.setItem(`arvolab.sol.${pr}.arama.yanit`, JSON.stringify(y)); sessionStorage.removeItem(`arvolab.sol.${pr}.arama.kunye`); } catch {} }, [PR, yanit]);
  await s.goto(`/dashboard/editor/${PR}/write?sol=arama`);
  await s.waitForSelector("li[data-kunye-anahtari]", { timeout: 60000 }).catch(async () => {
    await s.screenshot({ path: `${OUT}6-ariza-hata.png` });
    console.log("adres:", s.url(), "depo:", await s.evaluate(() => Object.keys(sessionStorage)));
  });
  const bitti = await bekleBitis(s, 120000);
  const r = await rozetler(s);
  kayit("dizinlere ulaşılamıyor: sonuçlar yine listelenir", r.length > 0, { n: r.length });
  kayit("servis arızası → 'Kontrol edilemedi' (nötr ton)", bitti && r.length > 0 && r.every((x) => x.durum === "kontrol_edilemedi" && x.ton === "neutral"), { ornek: r.slice(0, 2) });
  kayit("servis arızası 'yanlış kaynak' demez, ulaşılamadığını söyler", r.length > 0 && r.every((x) => /ulaşılamadı/.test(x.neden) && /yanlış olduğu anlamına gelmez/.test(x.neden)), { neden: r[0]?.neden });
  kayit("arıza aşaması: ekleme düğmeleri hâlâ kullanılabilir", (await s.getByRole("button", { name: /Listeme ekle/ }).count()) > 0, {});
  await s.screenshot({ path: `${OUT}6-ariza.png` });
  kayit("arıza aşaması: sayfa hatası yok", hatalar.length === 0, hatalar);
  await c.close();
}

await b.close();
const dosya = `${OUT}sonuc-${AŞAMA}.json`;
fs.writeFileSync(dosya, JSON.stringify(sonuc, null, 2));
const gecen = sonuc.filter((x) => x.gecti).length;
console.log(`${gecen}/${sonuc.length} geçti`);
process.exit(gecen === sonuc.length ? 0 : 1);
