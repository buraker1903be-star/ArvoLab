// M10 kabulü: satır içi öneri (otomatik cümle tamamlama) gerçek uygulamada.
// Yerel yığın + model taklidi (scripts/yerel-yigin/model-taklidi.mjs) +
// AI_TABAN_URL=http://127.0.0.1:54900/v1 ile `next start -p 3150`. Depo kökünden:
//   node tasarim/satir-ici-oneri/betikler/kabul.mjs
// Model taklidi: imleçten önceki metin "SAYI" ile biterse bağlamda olmayan
// sayı, "GECIKME" ile biterse 2,5 sn geç cevap döner. GERÇEK MODEL DEĞİL.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const KOK = process.env.KOK ?? process.cwd();
const { chromium, devices } = createRequire(`${KOK}/package.json`)("playwright");
const U = "http://localhost:3150";
const OUT = (process.env.CIKTI ?? "/tmp/satir-ici-oneri-kabul").replace(/\/?$/, "/");
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(`${KOK}/tasarim/tek-deneyim/betikler/tohum.json`, "utf8"));
const KUL = T.hesaplar.bireysel;
const psql = (sql) => execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sonuc = [];
const kayit = (ad, gecti, ayrinti = {}) => { sonuc.push({ ad, gecti, ayrinti }); console.log(gecti ? "PASS" : "FAIL", ad, JSON.stringify(ayrinti).slice(0, 400)); };

// Yerel yığında saatlik asistan hakkı (20) art arda koşularda doluyor: betik ~13 istek atıyor.
// Yalnızca YEREL tohum hesabının sayacı sıfırlanır; canlıya hiçbir şey gitmez.
psql(`delete from public.auth_rate_limits where key = 'ai-asistan:${KUL.id}'`);
const ek = Date.now().toString(36).slice(-5);
const P = (metin) => ({ type: "paragraph", attrs: {}, content: [{ type: "text", text: metin }] });
function calisma(ad, dil, icerik) {
  const id = psql(`insert into public.academic_projects (owner_id, project_type, title, status${dil ? ", belge_dili" : ""}) values ('${KUL.id}','thesis',${q(`${ad} ${ek}`)},'writing'${dil ? `, '${dil}'` : ""}) returning id`).split("\n")[0];
  const belge = { type: "doc", content: icerik };
  psql(`insert into public.project_manuscripts (project_id, content, plain_text) values ('${id}', ${q(JSON.stringify(belge))}::jsonb, 'x') on conflict (project_id) do update set content = excluded.content`);
  return id;
}
const TR = "Üniversiteye yeni başlayan öğrencilerin uyum süreci, akademik başarılarını ve sosyal ilişkilerini birlikte belirler";
const PR_TR = calisma("Öneri TR", null, [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giriş" }] }, P(TR), P("İkinci paragraf burada duruyor ve seçim sınaması için kullanılır."),
  { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [P("Hücre içinde yazılan açıklama metni öğrencinin")] }, { type: "tableCell", content: [P("Komşu hücre")] }] }] }]);
const PR_EN = calisma("Suggest EN", "en", [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Introduction" }] }, P("First-year students who join peer study groups report a different experience of their first semester")]);
const calismaKayitlari = (pr) => psql(`select status || ':' || coalesce(findings->>'neden', reject_reason, '') from public.ai_assistant_runs where project_id = '${pr}' and capability = 'yazim' order by created_at`).split("\n").filter(Boolean);

const b = await chromium.launch();
async function baglam(secenek, dil = "tr") {
  const c = await b.newContext({ baseURL: U, ...secenek });
  await c.addCookies([{ name: "arvolab_dil", value: dil, url: U }]);
  const s = await c.newPage();
  const hatalar = [];
  s.on("pageerror", (e) => hatalar.push(String(e).slice(0, 200)));
  await s.goto("/"); await s.fill('input[name="email"]', KUL.adres); await s.fill('input[name="password"]', T.parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { c, s, hatalar };
}
const ac = async (s, pr) => { await s.goto(`/dashboard/editor/${pr}/write`); await s.waitForSelector(".ProseMirror"); await s.waitForTimeout(1200); };
const ed = (s, fn, arg) => s.evaluate(([f, a]) => new Function("e", "a", `return (${f})(e, a)`)(document.querySelector(".ProseMirror").editor, a), [fn.toString(), arg]);
const oneri = (s) => s.evaluate(() => document.querySelector(".satir-ici-oneri")?.textContent ?? null);
const metin = (s) => ed(s, (e) => e.state.doc.textContent);
// İmlecin bulunduğu paragrafın metni: öneri oraya girer, belgenin sonuna değil.
const paragrafMetni = (s) => ed(s, (e) => e.state.selection.$head.parent.textContent);
// İmleci paragrafın SONUNA koy (End görsel satırın sonuna gider; satır kayınca paragraf sonu değildir).
const sonaGit = (s, icerik) => ed(s, (e, a) => { let hedef = null; e.state.doc.descendants((n, p) => { if (hedef === null && n.isTextblock && n.textContent.startsWith(a)) hedef = p + 1 + n.content.size; }); e.commands.focus(); e.commands.setTextSelection(hedef); return hedef; }, icerik);
const bekleOneri = async (s, ms = 6000) => { const son = Date.now() + ms; while (Date.now() < son) { const o = await oneri(s); if (o) return o; await s.waitForTimeout(150); } return null; };
// Durum çubuğu ve sayfa tahmini aynı sayaçtan okur (characterCount); gösterilen kutu panele göre değişiyor.
const kelime = (s) => ed(s, (e) => e.storage.characterCount.words());

// ── Masaüstü, Türkçe
{
  const { c, s, hatalar } = await baglam({ viewport: { width: 1440, height: 900 } });
  await ac(s, PR_TR);
  const ilkKayit = calismaKayitlari(PR_TR).length;

  // 1) Kapalıyken yazıp durmak istek göndermez.
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" ve", { delay: 40 }); await s.waitForTimeout(2600);
  kayit("kapalıyken duraksama istek göndermez", calismaKayitlari(PR_TR).length === ilkKayit && !(await oneri(s)), { kayit: calismaKayitlari(PR_TR).length - ilkKayit });

  // 2) Düğme: açar, geri bildirim verir.
  const dugme = s.getByRole("button", { name: /Otomatik öneri/ }).first();
  await dugme.click(); await s.waitForTimeout(300);
  const bildirim = await s.evaluate(() => [...document.querySelectorAll("[role=status], .toast, [data-toast]")].map((e) => e.textContent).join(" | "));
  kayit("Öneri düğmesi açınca ne olacağını söyler", /Otomatik öneri açık/.test(bildirim) && (await dugme.getAttribute("aria-pressed")) === "true", { bildirim: bildirim.slice(0, 120), basili: await dugme.getAttribute("aria-pressed") });

  // 3) Otomatik: tuş başına istek yok, duraksamada TEK istek, tek cümlelik gri devam.
  const once = metin(s); const kelimeOnce = await kelime(s);
  await sonaGit(s, "Üniversiteye"); const n0 = calismaKayitlari(PR_TR).length;
  await s.keyboard.type(" ve bu süreçte", { delay: 70 });
  const yazarken = calismaKayitlari(PR_TR).length - n0;
  const o1 = await bekleOneri(s);
  const sonraKayit = calismaKayitlari(PR_TR).length - n0;
  kayit("otomatik: yazarken istek yok, duraksamada tek istek", yazarken === 0 && sonraKayit === 1, { yazarken, sonraKayit });
  kayit("otomatik: gri devam görünür, tek cümle, belgeye girmez", !!o1 && (o1.match(/[.!?]/g) ?? []).length <= 1 && !(await metin(s)).includes(o1.trim()), { o1 });
  await s.screenshot({ path: OUT + "masaustu-oneri.png" });
  const k1 = await kelime(s);
  kayit("görünen öneri kelime sayısına girmez", k1 - kelimeOnce === 3, { kelimeOnce, k1, oneriSozcuk: o1?.trim().split(/\s+/).length });
  await s.waitForTimeout(3500); // otomatik kayıt
  const kayitli = psql(`select content::text from public.project_manuscripts where project_id='${PR_TR}'`);
  kayit("görünen öneri kaydedilen belgeye girmez", kayitli.includes("bu süreçte") && !kayitli.includes("çalışma planlarını"), {});
  void once;

  // 4) Esc kapatır, belge değişmez.
  const escOnce = await metin(s); await s.keyboard.press("Escape"); await s.waitForTimeout(200);
  kayit("Esc öneriyi kapatır, belge değişmez", !(await oneri(s)) && (await metin(s)) === escOnce);
  // 4b) Otomatik yolun sıklık sınırı: 12 sn dolmadan ikinci otomatik istek gitmez.
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" yeni", { delay: 40 }); const nA = calismaKayitlari(PR_TR).length; await s.waitForTimeout(2600);
  kayit("otomatik: 12 sn içinde ikinci otomatik istek gitmez", calismaKayitlari(PR_TR).length === nA, {});


  // 5) Kısayol (Alt+/) tıklamanın HEMEN ardından: eskiden konum yarışı yüzünden öneri düşüyordu.
  await s.click(".ProseMirror p >> nth=0"); await s.keyboard.press("Control+End"); await sonaGit(s, "Üniversiteye");
  await s.keyboard.press("Alt+/");
  const o2 = await bekleOneri(s);
  kayit("Alt+/ hemen ardından da öneri gösterir (konum yarışı)", !!o2, { o2 });

  // 6) Yazmak öneriyi geçersiz kılar.
  await s.keyboard.type("x"); await s.waitForTimeout(150);
  kayit("yazmak öneriyi siler", !(await oneri(s)));
  await s.keyboard.press("Backspace");
  // 7) İmleç hareketi siler.
  await s.keyboard.press("Alt+/"); await bekleOneri(s);
  await s.keyboard.press("ArrowLeft"); await s.waitForTimeout(150);
  kayit("imleç hareketi öneriyi siler", !(await oneri(s)));
  await s.keyboard.press("ArrowRight");

  // 8) Tab kabul eder; tek Ctrl+Z yalnızca öneriyi geri alır.
  await s.keyboard.type(" ayrıca", { delay: 20 }); // hemen öncesinde yazılmış harfler (aynı geçmiş penceresi)
  await s.keyboard.press("Alt+/"); const o3 = await bekleOneri(s);
  const kabulOnce = await metin(s); const pOnce = await paragrafMetni(s);
  await s.keyboard.press("Tab"); await s.waitForTimeout(200);
  kayit("Tab öneriyi asistan iziyle ekler", (await paragrafMetni(s)) === pOnce + o3 && (await s.evaluate((t) => [...document.querySelectorAll(".ProseMirror .asistan-izi")].some((e) => e.textContent === t), o3)), { o3 });
  await s.keyboard.press("Control+z"); await s.waitForTimeout(200);
  kayit("tek Ctrl+Z yalnızca öneriyi geri alır", (await metin(s)) === kabulOnce, { sonra: (await metin(s)).slice(-40) });

  // 9) Geç gelen cevap yanlış yere düşmez.
  await s.keyboard.type(" GECIKME", { delay: 20 }); await s.keyboard.press("Alt+/"); await s.waitForTimeout(900);
  await s.keyboard.type(" devam", { delay: 30 }); await s.waitForTimeout(2600);
  kayit("geç cevap: yazmaya devam edilince gösterilmez", !(await oneri(s)) && !(await metin(s)).includes("geç gelen"), { o: await oneri(s) });
  for (let i = 0; i < " GECIKME devam".length; i++) await s.keyboard.press("Backspace");

  // 10) Dayanaksız sayı: sunucu düşürür, hiçbir şey gösterilmez.
  const nS = calismaKayitlari(PR_TR).length;
  await s.keyboard.type(" SAYI", { delay: 20 }); await s.keyboard.press("Alt+/"); await s.waitForTimeout(2500);
  const sayiKaydi = calismaKayitlari(PR_TR).slice(nS);
  kayit("bağlamda olmayan sayı: öneri düşer", !(await oneri(s)) && sayiKaydi.some((k) => k.startsWith("rejected:uydurma_sayi")), { sayiKaydi });
  for (let i = 0; i < " SAYI".length; i++) await s.keyboard.press("Backspace");

  // 11) Seçim varken istek yok.
  const nSec = calismaKayitlari(PR_TR).length;
  await ed(s, (e) => { let a = null; e.state.doc.descendants((n, p) => { if (a === null && n.isTextblock && n.textContent.startsWith("İkinci")) a = p + 1; }); e.commands.focus(); e.commands.setTextSelection({ from: a, to: a + 6 }); });
  await s.keyboard.press("Alt+/"); await s.waitForTimeout(1500);
  kayit("seçim varken öneri istenmez", calismaKayitlari(PR_TR).length === nSec && !(await oneri(s)));

  // 12) Tablo: öneri yokken Tab hücre değiştirir; öneri varken kabul eder.
  await sonaGit(s, "Hücre içinde");
  const hucreOnce = await ed(s, (e) => e.state.selection.$head.parent.textContent);
  await s.keyboard.press("Tab"); await s.waitForTimeout(150);
  const hucreSonra = await ed(s, (e) => e.state.selection.$head.parent.textContent);
  kayit("tabloda öneri yokken Tab sonraki hücreye geçer", hucreOnce.startsWith("Hücre içinde") && hucreSonra === "Komşu hücre", { hucreSonra });
  await sonaGit(s, "Hücre içinde"); await s.keyboard.press("Alt+/"); const o4 = await bekleOneri(s);
  await s.keyboard.press("Tab"); await s.waitForTimeout(150);
  const hucreKabul = await ed(s, (e) => e.state.selection.$head.parent.textContent);
  kayit("tabloda öneri varken Tab kabul eder (hücrede kalır)", !!o4 && hucreKabul.endsWith(o4.trim()), { hucreKabul: hucreKabul.slice(-50) });
  await s.screenshot({ path: OUT + "masaustu-tablo.png" });

  // 14) Kapatınca otomatik istek durur.
  await dugme.click(); await s.waitForTimeout(13000);
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" son", { delay: 40 }); const nK = calismaKayitlari(PR_TR).length; await s.waitForTimeout(2600);
  kayit("kapatınca otomatik istek gitmez", calismaKayitlari(PR_TR).length === nK && (await dugme.getAttribute("aria-pressed")) === "false");
  kayit("masaüstü TR: sayfa hatası yok", hatalar.length === 0, { hatalar });
  await c.close();
}

// ── Masaüstü, İngilizce arayüz + İngilizce belge
{
  const { c, s, hatalar } = await baglam({ viewport: { width: 1440, height: 900 } }, "en");
  await ac(s, PR_EN);
  await sonaGit(s, "First-year"); await s.keyboard.press("Alt+/");
  const o = await bekleOneri(s);
  kayit("EN: İngilizce belgede İngilizce devam", !!o && /which shapes/.test(o), { o });
  const dugme = s.getByRole("button", { name: /Automatic suggestions/ }).first();
  kayit("EN: düğme İngilizce", await dugme.isVisible());
  await s.screenshot({ path: OUT + "masaustu-en.png" });
  await s.keyboard.press("Tab"); await s.waitForTimeout(150);
  kayit("EN: Tab kabul eder", (await metin(s)).includes("which shapes"));
  kayit("EN: sayfa hatası yok", hatalar.length === 0, { hatalar });
  await c.close();
}

// ── Telefon: dokunarak kabul + klavye açıkken (görünüm yüksekliği daraltılarak taklit)
{
  const { c, s, hatalar } = await baglam({ ...devices["iPhone 13"] });
  await ac(s, PR_TR);
  const tDugme = s.getByRole("button", { name: /Otomatik öneri/ }).first();
  kayit("telefon: Öneri düğmesi araç çubuğunda görünür", await tDugme.isVisible());
  await tDugme.tap(); await s.waitForTimeout(300);
  await s.setViewportSize({ width: 390, height: 460 }); // ekran klavyesi açık gibi (taklit)
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" ve", { delay: 60 });
  const o = await bekleOneri(s, 7000);
  const dugmeKutusu = await s.evaluate(() => { const d = document.querySelector(".satir-ici-oneri-ekle"); if (!d || !d.checkVisibility()) return null; const r = d.getBoundingClientRect(); return { y: Math.round(r.y), alt: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), ekran: innerHeight }; });
  kayit("telefon: otomatik öneri + görünür “Ekle” düğmesi", !!o && !!dugmeKutusu && dugmeKutusu.h >= 32, { o, dugmeKutusu });
  await s.screenshot({ path: OUT + "telefon-oneri.png" });
  const once = await paragrafMetni(s);
  await s.locator(".satir-ici-oneri-ekle").tap(); await s.waitForTimeout(250);
  kayit("telefon: “Ekle”ye dokunmak kabul eder, odak editörde kalır", (await paragrafMetni(s)) === once + o && (await s.evaluate(() => document.activeElement?.classList.contains("ProseMirror"))), {});
  kayit("telefon: sayfa hatası yok", hatalar.length === 0, { hatalar });
  await c.close();
}
await b.close();
fs.writeFileSync(OUT + "sonuc.json", JSON.stringify(sonuc, null, 2));
const kalan = sonuc.filter((x) => !x.gecti).length;
console.log(`${sonuc.length - kalan}/${sonuc.length} geçti`);
process.exit(kalan ? 1 : 0);
