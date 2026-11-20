// Tek ana deneyim kabulü, ikinci tur (PR #113 incelemesi). YEREL, SENTETİK veri (tohum.mjs).
// Bu tur GERÇEKTEN kayıt oluşturur: dört hesap türünde çalışma, Word içe aktarma, doçentlik dosyası;
// Yönetim'de onay / onayı geri alma / bilgileri düzenleme / silme sonrası kartların ve sayaçların
// sayfa YENİLENMEDEN güncellendiği ölçülür (istemci gezinmesi; page.reload yalnızca kalıcılık için).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const D = new URL(".", import.meta.url).pathname;
const URL0 = process.argv[2] ?? "http://localhost:3150";
const DOCX = process.argv[3]; // örnek .docx (docx-ornek.mjs ile üretilir)
const T = JSON.parse(fs.readFileSync(`${D}tohum.json`, "utf8"));
const G = `${D}../gorseller2`; fs.mkdirSync(G, { recursive: true });
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ek = Date.now().toString(36).slice(-5);
const sonuc = []; const kayit = (ad, gecti, ayrinti) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 300)); };
const bekle = async (kosul, ms = 20000) => { const son = Date.now() + ms; while (Date.now() < son) { if (await kosul()) return true; await new Promise((r) => setTimeout(r, 400)); } return false; };
const b = await chromium.launch();

async function baglam(anahtar) {
  const c = await b.newContext({ baseURL: URL0, viewport: { width: 1440, height: 900 } });
  await c.addCookies([{ name: "arvolab_dil", value: "tr", url: URL0 }]);
  const s = await c.newPage(); const hata = []; s.on("pageerror", (e) => hata.push(String(e).slice(0, 160)));
  await s.goto("/"); await s.fill('input[name="email"]', T.hesaplar[anahtar].adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hata };
}
const yeniCalisma = async (s, baslik, cikis = "yaz") => {
  await s.goto("/dashboard/editor"); await s.waitForLoadState("networkidle").catch(() => {});
  await s.locator("button:visible", { hasText: /^\s*Yeni çalışma\s*$/ }).first().click();
  const f = s.locator(".yeni-calisma-formu"); await f.waitFor({ state: "visible" });
  await f.locator('input[name="title"]').fill(baslik);
  await Promise.all([s.waitForURL(/\/dashboard\/editor\/[0-9a-f-]{36}\/write/, { timeout: 60000 }), f.locator(`button[value="${cikis}"]`).click()]);
  return s.url().match(/editor\/([0-9a-f-]{36})/)[1];
};
// Panelin loading.tsx iskeleti de bir <main aria-busy="true">; sayım ve görüntü ondan ÖNCE alınırsa
// "şerit yok" boş iskelette doğru çıkar ve hiçbir şey ölçmez.
const yuklendi = async (s) => { await s.locator('main[aria-busy="true"]').first().waitFor({ state: "detached", timeout: 30000 }).catch(() => {}); await s.locator("main").first().waitFor({ timeout: 30000 }); };
const editorMetni = (s) => s.locator(".ProseMirror").first().innerText();
const metinKaydedildi = (id, parca) => bekle(async () => (psql(`select coalesce(plain_text,'') from public.project_manuscripts where project_id='${id}'`) || "").includes(parca));

// 1) Dört hesap türünde gerçek oluşturma: sahiplik, editör, yeniden yüklemede kalıcılık
for (const rol of ["kurucu", "personel", "kurumlu", "bireysel"]) {
  const { c, s, hata } = await baglam(rol);
  const baslik = `TEK-YENI-${rol}-${ek}`;
  const id = await yeniCalisma(s, baslik);
  await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  const [sahip, tur, org] = psql(`select owner_id, project_type, coalesce(organization_id::text,'') from public.academic_projects where id='${id}'`).split("|");
  const cumle = `Kalıcılık cümlesi ${rol} ${ek}.`;
  await s.locator(".ProseMirror").first().click(); await s.keyboard.type(cumle);
  const kaydedildi = await metinKaydedildi(id, cumle);
  await s.reload(); await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  const kalici = (await editorMetni(s)).includes(cumle);
  await s.goto("/dashboard/editor"); const listede = (await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(baslik);
  const beklenenOrg = T.hesaplar[rol].org ?? "";
  kayit(`${rol}: Yeni çalışma oluşturuldu, sahibi kendisi, editör açıldı, yeniden yüklemede kalıcı, kişisel listede`, sahip === T.hesaplar[rol].id && tur === "thesis" && org === beklenenOrg && kaydedildi && kalici && listede && hata.length === 0, { id, sahipDogru: sahip === T.hesaplar[rol].id, tur, org: org || null, kaydedildi, kalici, listede, hata });
  if (rol === "kurumlu") T.yeniKurumlu = id;
  await c.close();
}

// 2) Word'den içe aktar (bireysel hesap, örnek .docx)
{
  const { c, s, hata } = await baglam("bireysel");
  const id = await yeniCalisma(s, `TEK-WORD-${ek}`, "word");
  const iceAcik = new URL(s.url()).searchParams.get("ice") === "1";
  // Kullanıcının yolu: pencerenin düğmesi → dosya seçici. Sayfada başka gizli .docx girdileri de var; seçici doğrudan aranırsa yanlışına gidiyor.
  const [secici] = await Promise.all([s.waitForEvent("filechooser", { timeout: 30000 }), s.getByRole("button", { name: /Word dosyası seç/ }).click()]);
  await secici.setFiles(DOCX);
  const geldi = await bekle(async () => (await editorMetni(s).catch(() => "")).includes("TEK-WORD-7F3"), 30000);
  const kaydedildi = await metinKaydedildi(id, "TEK-WORD-7F3", 30000);
  await s.screenshot({ path: `${G}/word-ice-aktarma.png`, animations: "disabled" });
  await s.reload(); await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  const metin = await editorMetni(s);
  const basliklar = await s.locator(".ProseMirror h1, .ProseMirror h2").allInnerTexts();
  kayit("bireysel: Word'den içe aktar — örnek .docx editöre geldi, kaydedildi, yeniden yüklemede kalıcı", iceAcik && geldi && kaydedildi && metin.includes("TEK-WORD-7F3") && basliklar.some((x) => x.includes("Giriş")) && hata.length === 0, { iceAcik, geldi, kaydedildi, basliklar, hata });
  await c.close();
}

// 3) Kurum seçili kurucu: seçim yalnızca Yönetim'de; kişisel listeler seçimden bağımsız
{
  const { c, s, hata } = await baglam("kurucu");
  await s.goto("/dashboard"); await yuklendi(s); const menuKurum = await s.evaluate(() => /Bütün kurumlar|Kurum\b/.test(document.querySelector(".os-kullanici-menu")?.textContent ?? ""));
  const anaSeritOnce = await s.locator(".kurum-seridi").count();
  await s.goto("/dashboard/yonetim"); await s.locator(".kurum-seridi select").waitFor({ timeout: 15000 });
  const deger = T.kurumlar.A;
  await s.locator(".kurum-seridi select").selectOption(T.kurumlar.A);
  await s.locator(".kurum-seridi button[type=submit]").click();
  const secildi = await bekle(async () => /Yalnızca/.test(await s.locator(".kurum-seridi").innerText().catch(() => "")));
  // Görüntü yeniden yüklemeden sonra: bildirim balonu şeridi örtmesin, seçimin çerezde kaldığı da görünsün.
  await s.reload(); await yuklendi(s); await s.locator(".kurum-seridi", { hasText: "Yalnızca" }).waitFor({ timeout: 15000 });
  await s.screenshot({ path: `${G}/kurucu-yonetim-kurum-secili.png`, animations: "disabled" });
  const yonetimYazi = await s.locator("main:not([aria-busy=\"true\"])").first().innerText();
  await s.goto("/dashboard"); await yuklendi(s);
  const anaSerit = await s.locator(".kurum-seridi").count();
  const anaYazi = await s.locator("main:not([aria-busy=\"true\"])").first().innerText();
  await s.screenshot({ path: `${G}/kurucu-ana-kurum-secili.png`, animations: "disabled" });
  await s.goto("/dashboard/editor"); await yuklendi(s); const listeYazi = await s.locator("main:not([aria-busy=\"true\"])").first().innerText(); const listeSerit = await s.locator(".kurum-seridi").count();
  const secimdeYeni = await yeniCalisma(s, `TEK-SECIMDE-kurucu-${ek}`);
  await s.goto("/dashboard/editor"); await yuklendi(s); const secimdeListede = (await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(`TEK-SECIMDE-kurucu-${ek}`);
  await s.screenshot({ path: `${G}/kurucu-calismalarim-kurum-secili.png`, animations: "disabled" });
  const kendi = ["Kurucunun kendi tezi", `TEK-YENI-kurucu-${ek}`];
  kayit("kurucu: kurum seçimi hesap menüsünde yok, kişisel ekranlarda şerit yok", !menuKurum && anaSeritOnce === 0, { menuKurum, anaSeritOnce });
  kayit("kurucu: Kurum A seçiliyken Yönetim şeridi 'Yalnızca' diyor ve listede B kurumu yok", secildi && !yonetimYazi.includes("B kurumundaki öğrencinin tezi") && yonetimYazi.includes("Kurumlu öğrencinin tezi"), { secildi, deger });
  // Ana Sayfa kendi çalışmalarından birini gösterir ("Kaldığınız yer" en son yazılan); hangisi olduğu değil, yalnızca kendi çalışması olması aranır.
  const anaKendi = kendi.some((k) => anaYazi.includes(k)) && !anaYazi.includes("Kurumlu öğrencinin tezi");
  kayit("kurucu: Kurum A seçiliyken kendi çalışmaları Ana Sayfa ve Çalışmalarım'da, şerit yok; seçimdeyken açılan çalışma da kişisel listede", anaSerit === 0 && listeSerit === 0 && anaKendi && kendi.every((k) => listeYazi.includes(k)) && secimdeListede, { anaSerit, listeSerit, anaKendi, listedeKendi: kendi.map((k) => listeYazi.includes(k)), secimdeYeni, secimdeListede });
  // Seçimi geri al
  await s.goto("/dashboard/yonetim"); await s.locator(".kurum-seridi select").selectOption(""); await s.locator(".kurum-seridi button[type=submit]").click();
  await bekle(async () => /Bütün kurumlar gösteriliyor/.test(await s.locator(".kurum-seridi").innerText().catch(() => "")));
  kayit("kurucu: sayfa hatası yok (kurum seçimi)", hata.length === 0, hata);
  await c.close();
}

// 4) Doçentlik dosyası: yalnızca modülde ve personelde; ortak pencere üç seçenekli
{
  const { c, s, hata } = await baglam("personel");
  await s.goto("/dashboard/associate-professorship"); await s.waitForLoadState("networkidle").catch(() => {});
  await s.getByRole("button", { name: /Doçentlik dosyası oluştur/ }).click();
  const baslik = `TEK-DOCENTLIK-${ek}`;
  await s.locator('input[name="title"]:visible').fill(baslik);
  await Promise.all([s.waitForURL(/\/dashboard\/editor\/[0-9a-f-]{36}\/write/, { timeout: 60000 }), s.getByRole("button", { name: /^Oluştur ve yaz$/ }).click()]);
  const id = s.url().match(/editor\/([0-9a-f-]{36})/)[1];
  await s.locator(".ProseMirror").first().waitFor({ state: "visible", timeout: 60000 });
  const [sahip, tur] = psql(`select owner_id, project_type from public.academic_projects where id='${id}'`).split("|");
  await s.goto("/dashboard/editor"); const listede = (await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(baslik);
  await s.getByRole("button", { name: /^Yeni çalışma$/ }).first().click();
  const turSayisi = await s.locator(".yeni-calisma-formu .analiz-karti").count();
  kayit("personel: doçentlik dosyası modülden oluşturuldu (tür associate-professorship), kişisel listede; ortak pencere 3 seçenekli", sahip === T.hesaplar.personel.id && tur === "associate-professorship" && listede && turSayisi === 3 && hata.length === 0, { tur, listede, turSayisi, hata });
  await c.close();
  const o = await baglam("kurumlu");
  await o.s.goto("/dashboard/associate-professorship"); await o.s.waitForLoadState("networkidle").catch(() => {});
  const dugme = await o.s.getByRole("button", { name: /Doçentlik dosyası oluştur/ }).count();
  kayit("kurumlu öğrenci: doçentlik dosyası düğmesi yok", dugme === 0, { dugme });
  await o.c.close();
}

// 5) Kayıt sonrası yenileme: Yönetim kartları ve sayaçları elle yenilemeden güncellenir
psql(`update public.academic_projects set status='ready', controller_approved_at=null, controller_approved_by=null where id='${T.calismalar.kurumlu}'`);
const silinecek = psql(`insert into public.academic_projects (owner_id, organization_id, project_type, title, status) values ('${T.hesaplar.kurumlu.id}', '${T.kurumlar.A}', 'project', ${q(`TEK-SILINECEK-${ek}`)}, 'writing') returning id`).split("\n")[0];
const sayac = (s, etiket) => s.evaluate((e) => { const k = [...document.querySelectorAll(".personel-sayac")].find((x) => x.querySelector("span")?.textContent?.trim() === e); return k ? Number(k.querySelector("b")?.textContent) : null; }, etiket);
const menudenYonetim = async (s) => { await s.locator(".os-kullanici > summary").filter({ visible: true }).first().click(); await s.locator('.os-kullanici-menu a[href="/dashboard/yonetim"]').filter({ visible: true }).first().click(); await s.locator("main h1", { hasText: "Yönetim · genel bakış" }).waitFor({ timeout: 20000 }); };
const genelBakistanListe = async (s, sec) => { await s.locator(`main a[href="/dashboard/yonetim/calismalar"]`).first().click(); await s.locator("main h1", { hasText: "Yönetim · çalışmalar" }).waitFor({ timeout: 20000 }); if (sec) { await s.locator(`a[href*="sec=${sec}"]`).first().click(); await s.waitForURL(new RegExp(`sec=${sec}`)); } };
{
  const { c, s, hata } = await baglam("personel");
  let yuklemeSayisi = 0; s.on("load", () => yuklemeSayisi++);
  await s.goto(`/dashboard/yonetim/calismalar?sec=${T.calismalar.kurumlu}`); await s.waitForLoadState("networkidle").catch(() => {});
  const yuklemeTabani = yuklemeSayisi;
  const onayOnce = await sayac(s, "Onay bekliyor");
  await s.locator("main button", { hasText: /^\s*Onayla\s*$/ }).first().click();
  const onaySonra = await bekle(async () => (await sayac(s, "Onay bekliyor")) === onayOnce - 1);
  // "Onayı geri al" kartın "diğer işlemler" menüsünde; menü açılmadan görünmez.
  await s.locator(".kart-menu > summary").first().click();
  const geriAlGorundu = await bekle(async () => s.locator(".kart-menu button", { hasText: /Onayı geri al/ }).first().isVisible().catch(() => false));
  await s.locator(".kart-menu > summary").first().click();
  await menudenYonetim(s);
  const genelOnay = await sayac(s, "Onay bekliyor");
  kayit("personel: Onayla → Yönetim listesi ve genel bakış sayacı yenilemeden düştü", onaySonra && geriAlGorundu && genelOnay === onayOnce - 1 && yuklemeSayisi === yuklemeTabani, { onayOnce, genelOnay, geriAlGorundu, tamYukleme: yuklemeSayisi - yuklemeTabani });
  await genelBakistanListe(s, T.calismalar.kurumlu);
  await s.locator(".kart-menu > summary").first().click();
  await s.locator(".kart-menu button", { hasText: /Onayı geri al/ }).first().click();
  // Onay penceresinin tehlike düğmesi (ActionForm → PanelDrawer, .onay-eylemleri).
  await s.locator(".onay-eylemleri .button-danger", { hasText: /Onayı geri al/ }).filter({ visible: true }).first().click();
  // Onayı geri almak çalışmayı "Onay bekliyor"a değil "Revizyonda"ya döndürür (revokeApproval: status='revision'):
  // öğrenci düzeltip yeniden teslime hazır işaretleyene kadar onay kuyruğuna girmez. Ölçülen: kart rozeti ve
  // "Onayla" düğmesi yenilemeden döndü, kuyruk büyümedi, genel bakış aynı sayıyı gösteriyor, veritabanı aynı şeyi söylüyor.
  const geriAlindi = await bekle(async () => (await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes("Revizyonda") && (await s.locator("main button", { hasText: /^\s*Onayla\s*$/ }).filter({ visible: true }).count()) > 0);
  const kuyrukListe = await sayac(s, "Onay bekliyor");
  const dbGeri = psql(`select status || '|' || (controller_approved_at is null) from public.academic_projects where id='${T.calismalar.kurumlu}'`);
  await menudenYonetim(s); const genelOnay2 = await sayac(s, "Onay bekliyor");
  kayit("personel: Onayı geri al → kart 'Revizyonda' ve 'Onayla' yenilemeden döndü; onay kuyruğu büyümedi (liste ve genel bakış); veritabanında onay silindi", geriAlindi && kuyrukListe === onayOnce - 1 && genelOnay2 === onayOnce - 1 && dbGeri === "revision|true" && yuklemeSayisi === yuklemeTabani, { geriAlindi, kuyrukListe, genelOnay2, dbGeri, tamYukleme: yuklemeSayisi - yuklemeTabani });
  // Bilgileri düzenle → başlık listede ve genel bakışta
  await genelBakistanListe(s, T.calismalar.kurumlu);
  const yeniBaslik = `Kurumlu öğrencinin tezi (düzenlendi ${ek})`;
  await s.locator(".kart-menu > summary").first().click();
  await s.getByRole("button", { name: /Bilgileri düzenle/ }).first().click();
  const baslikAlani = s.locator('input[name="title"]:visible').last();
  await baslikAlani.waitFor({ timeout: 20000 }); await baslikAlani.fill(yeniBaslik);
  await s.getByRole("button", { name: /Değişiklikleri kaydet/ }).last().click();
  const listedeYeni = await bekle(async () => (await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(yeniBaslik));
  await menudenYonetim(s); const genelYeni = (await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(yeniBaslik);
  kayit("personel: Bilgileri düzenle → yeni başlık listede ve genel bakışta, yenilemeden", listedeYeni && genelYeni && yuklemeSayisi === yuklemeTabani, { listedeYeni, genelYeni, tamYukleme: yuklemeSayisi - yuklemeTabani });
  kayit("personel: sayfa hatası yok (yenileme akışı)", hata.length === 0, hata);
  psql(`update public.academic_projects set title='Kurumlu öğrencinin tezi' where id='${T.calismalar.kurumlu}'`);
  await c.close();
}
{
  const { c, s, hata } = await baglam("kurucu");
  let yuklemeSayisi = 0; s.on("load", () => yuklemeSayisi++);
  await s.goto(`/dashboard/yonetim/calismalar?sec=${silinecek}`); await s.waitForLoadState("networkidle").catch(() => {});
  const taban = yuklemeSayisi;
  const aktifOnce = await sayac(s, "Aktif çalışma");
  await s.locator(".kart-menu > summary").first().click();
  await s.getByRole("button", { name: /Çalışmayı sil/ }).first().click();
  await s.getByRole("button", { name: /Evet, sil/ }).last().click();
  const silindi = await bekle(async () => !(await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(`TEK-SILINECEK-${ek}`) && (await sayac(s, "Aktif çalışma")) === aktifOnce - 1);
  await menudenYonetim(s);
  const genelYok = !(await s.locator("main:not([aria-busy=\"true\"])").first().innerText()).includes(`TEK-SILINECEK-${ek}`);
  const dbYok = psql(`select count(*) from public.academic_projects where id='${silinecek}'`) === "0";
  kayit("kurucu: Çalışmayı sil → listeden ve sayaçtan yenilemeden düştü, genel bakışta yok, veritabanında yok", silindi && genelYok && dbYok && yuklemeSayisi === taban && hata.length === 0, { aktifOnce, silindi, genelYok, dbYok, tamYukleme: yuklemeSayisi - taban, hata });
  await c.close();
}

fs.writeFileSync(`${D}../kabul2-sonucu.json`, JSON.stringify(sonuc, null, 2));
console.log(`\nTOPLAM ${sonuc.filter((x) => x.gecti).length}/${sonuc.length}`);
await b.close();
