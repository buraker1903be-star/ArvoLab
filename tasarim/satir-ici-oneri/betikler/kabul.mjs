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
// Yerel tohum hesabının saatlik asistan hakkı (20): betik bunu aşacak kadar istek gönderiyor; bölüm başlarında sıfırlanır.
const hakSifirla = () => psql(`delete from public.auth_rate_limits where key in ('ai-asistan:${KUL.id}', 'ai-tamamla:${KUL.id}')`);
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
const sonaGit = async (s, icerik) => {
  const hedef = await ed(s, (e, a) => { let h = null; e.state.doc.descendants((n, p) => { if (h === null && n.isTextblock && n.textContent.startsWith(a)) h = p + 1 + n.content.size; }); if (h !== null) { e.commands.focus(); e.commands.setTextSelection(h); } return h; }, icerik);
  if (hedef === null) throw new Error(`"${icerik}" ile başlayan paragraf yok: ${JSON.stringify(await ed(s, (e) => { const l = []; e.state.doc.descendants((n) => { if (n.isTextblock) l.push(n.textContent.slice(0, 50)); }); return l; }))}`);
  await odakBekle(s);
  return hedef;
};
/*
  Tiptap'in focus() komutu odağı BİR SONRAKİ animasyon karesine erteliyor
  (requestAnimationFrame). Sayfa yeni açılmışken ana iş parçacığı meşgulse o
  kare gecikiyor ve hemen ardından basılan Alt+/ editöre değil BODY'ye
  gidiyor: istek hiç gönderilmiyor, sunucuda kayıt yok, bildirim yok. "EN:
  İngilizce belgede İngilizce devam" ve "EN: Tab kabul eder" 20.11.2026'daki
  birleşik koşuda bu yüzden düştü (29/31). Yalnızca EN adımı 30 kez
  koşturulunca editör açıldıktan 300 ms sonra odaklanan denemelerin 4/18'inde
  odak BODY'de kaldı; odağın gelmesi beklenince 8/8 geçti. Kullanıcı editöre
  tıklayarak odaklandığı için (eşzamanlı) ürün tarafında karşılığı yok.
*/
const odakBekle = (s) => s.waitForFunction(() => document.querySelector(".ProseMirror")?.editor?.isFocused === true, null, { timeout: 5000 });
// Sunucunun en az aralığı (3 sn, lib/ai/sinirlar.ts): senaryolar arası istekler bu aralığı gözetir.
let sonIstek = 0;
const altSlash = async (s) => { const bekle = sonIstek + 3300 - Date.now(); if (bekle > 0) await s.waitForTimeout(bekle); sonIstek = Date.now(); await s.keyboard.press("Alt+/"); };
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

  /*
    4a) Sıklık kuralı ve önbellek (21.11.2026, lib/ai/oneri-zamanlama.ts).
    İlk otomatik istekten sonra yeni otomatik istek için en az 40 yeni
    karakter ve son istekten 8 sn gerekir; aynı bağlam önbellekten, istek
    atılmadan ve belgeye girmeden gösterilir.
  */
  hakSifirla();
  const nAz = calismaKayitlari(PR_TR).length;
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" ve", { delay: 40 }); await s.waitForTimeout(2600);
  kayit("otomatik: 40 karakterden az yeni metinle ikinci istek gitmez", calismaKayitlari(PR_TR).length === nAz && !(await oneri(s)), { yeni: calismaKayitlari(PR_TR).length - nAz });
  const UZUN = " öğrencilerin kampüs yaşamına katılımı da bu dönemde belirginleşir";
  await altSlash(s); const tElle = Date.now(); await bekleOneri(s); await s.keyboard.press("Escape");
  const nElle = calismaKayitlari(PR_TR).length;
  await s.keyboard.type(UZUN, { delay: 15 });
  const yazildi = Date.now() - tElle;
  await s.waitForTimeout(Math.max(0, 5_000 - (Date.now() - tElle)));
  const besSn = calismaKayitlari(PR_TR).length - nElle;
  const o8 = await bekleOneri(s, 9_000);
  const sekizSn = calismaKayitlari(PR_TR).length - nElle;
  const gecen = Date.now() - tElle;
  sonIstek = Date.now();
  kayit("otomatik: 40+ karakterle bile son istekten 8 sn dolmadan istek gitmez, dolunca tek istek gider", besSn === 0 && sekizSn === 1 && !!o8 && gecen >= 8_000, { yazildi, besSn, sekizSn, gecen });
  await s.keyboard.press("Escape");
  const nOnb = calismaKayitlari(PR_TR).length; const mOnb = await metin(s);
  await altSlash(s); const oOnb = await bekleOneri(s, 3_000);
  kayit("önbellek: aynı bağlamda istek atılmadan aynı öneri gösterilir, belgeye girmez", oOnb === o8 && calismaKayitlari(PR_TR).length === nOnb && (await metin(s)) === mOnb, { oOnb, o8, yeni: calismaKayitlari(PR_TR).length - nOnb });
  await s.keyboard.press("Escape");
  await s.keyboard.type("x", { delay: 20 }); await altSlash(s); const oFark = await bekleOneri(s);
  kayit("önbellek: bağlam bir harf değişince önbellekteki öneri gösterilmez, sunucuya gidilir", calismaKayitlari(PR_TR).length === nOnb + 1 && oFark !== null, { oFark });
  await s.keyboard.press("Escape");
  for (let i = 0; i < (" ve" + UZUN + "x").length; i++) await s.keyboard.press("Backspace");
  hakSifirla();
  // 4b) SUNUCUDAKİ en az aralık: iki elle istek art arda → ikincisi frene takılır, hak tüketmez, söylenir.
  await s.waitForTimeout(3500);
  await sonaGit(s, "Üniversiteye");
  const hakOnce = Number(psql(`select coalesce((select count from public.auth_rate_limits where key='ai-asistan:${KUL.id}'),0)`));
  // İki istek de YENİ bağlamda: aynı bağlam önbellekten gelir ve sunucuya hiç gitmez (4a). Bu konum 3. adımda istendi.
  await s.keyboard.type("w"); await s.keyboard.press("Alt+/"); await bekleOneri(s); await s.keyboard.press("Escape");
  await s.keyboard.type("q"); await s.keyboard.press("Alt+/"); await s.waitForTimeout(1500); sonIstek = Date.now();
  await s.keyboard.press("Backspace"); await s.keyboard.press("Backspace");
  const hakSonra = Number(psql(`select coalesce((select count from public.auth_rate_limits where key='ai-asistan:${KUL.id}'),0)`));
  const aralikMetni = await s.evaluate(() => document.body.innerText);
  kayit("sunucu en az aralığı: art arda ikinci istek frene takılır, saatlik hak tüketmez ve söylenir", hakSonra - hakOnce === 1 && /çok sık istendi/.test(aralikMetni), { hakOnce, hakSonra });


  hakSifirla();
  // 5) Kısayol (Alt+/) tıklamanın HEMEN ardından: eskiden konum yarışı yüzünden öneri düşüyordu.
  await s.click(".ProseMirror p >> nth=0"); await s.keyboard.press("Control+End"); await sonaGit(s, "Üniversiteye");
  await altSlash(s);
  const o2 = await bekleOneri(s);
  kayit("Alt+/ hemen ardından da öneri gösterir (konum yarışı)", !!o2, { o2 });

  // 6) Yazmak öneriyi geçersiz kılar.
  await s.keyboard.type("x"); await s.waitForTimeout(150);
  kayit("yazmak öneriyi siler", !(await oneri(s)));
  await s.keyboard.press("Backspace");
  // 7) İmleç hareketi siler.
  await altSlash(s); await bekleOneri(s);
  await s.keyboard.press("ArrowLeft"); await s.waitForTimeout(150);
  kayit("imleç hareketi öneriyi siler", !(await oneri(s)));
  await s.keyboard.press("ArrowRight");

  // 8) Tab kabul eder; tek Ctrl+Z yalnızca öneriyi geri alır.
  // İmleç paragraf sonunda olmalı. Dört koşudan ikisinde imleç burada tablo hücresinin başındaydı
  // (önceki adımlardaki programlı seçim ile tarayıcının selectionchange'i yarışıyor); konum açıkça
  // yeniden kurulur ve önceki konum kayda yazılır.
  const konumOnce = (await paragrafMetni(s)).slice(0, 30);
  if (!konumOnce.startsWith("Üniversiteye")) console.log("GÖZLEM: 8. adımdan önce imleç beklenen paragrafta değildi:", konumOnce);
  await sonaGit(s, "Üniversiteye"); await s.waitForTimeout(200);
  await s.keyboard.type(" ayrıca", { delay: 20 }); // hemen öncesinde yazılmış harfler (aynı geçmiş penceresi)
  await altSlash(s); const o3 = await bekleOneri(s);
  const kabulOnce = await metin(s); const pOnce = await paragrafMetni(s);
  await s.keyboard.press("Tab"); await s.waitForTimeout(200);
  kayit("Tab öneriyi asistan iziyle ekler", (await paragrafMetni(s)) === pOnce + o3 && (await s.evaluate((t) => [...document.querySelectorAll(".ProseMirror .asistan-izi")].some((e) => e.textContent === t), o3)), { o3, pOnce: pOnce.slice(-60), pSonra: (await paragrafMetni(s)).slice(-90), izler: await s.evaluate(() => [...document.querySelectorAll(".ProseMirror .asistan-izi")].map((e) => e.textContent)) });
  await s.keyboard.press("Control+z"); await s.waitForTimeout(200);
  kayit("tek Ctrl+Z yalnızca öneriyi geri alır", (await metin(s)) === kabulOnce, { sonra: (await metin(s)).slice(-40) });

  // 9) Geç gelen cevap yanlış yere düşmez.
  await s.keyboard.type(" GECIKME", { delay: 20 }); await altSlash(s); await s.waitForTimeout(900);
  await s.keyboard.type(" devam", { delay: 30 }); await s.waitForTimeout(2600);
  // Otomatik mod açık: " devam"dan sonraki duraksama YENİ konum için meşru bir öneri getirebilir; düşmesi gereken GECİKMELİ cevaptır.
  kayit("geç cevap: yazmaya devam edilince gösterilmez", !((await oneri(s)) ?? "").includes("geç gelen") && !(await metin(s)).includes("geç gelen"), { o: await oneri(s) });
  for (let i = 0; i < " GECIKME devam".length; i++) await s.keyboard.press("Backspace");

  hakSifirla();
  // 10) Dayanaksız sayı: sunucu düşürür, hiçbir şey gösterilmez.
  const nS = calismaKayitlari(PR_TR).length;
  await s.keyboard.type(" SAYI", { delay: 20 }); await altSlash(s); await s.waitForTimeout(2500);
  const sayiKaydi = calismaKayitlari(PR_TR).slice(nS);
  kayit("bağlamda olmayan sayı: öneri düşer", !(await oneri(s)) && sayiKaydi.some((k) => k.startsWith("rejected:uydurma_sayi")), { sayiKaydi });
  for (let i = 0; i < " SAYI".length; i++) await s.keyboard.press("Backspace");

  // 11) Seçim varken istek yok.
  const nSec = calismaKayitlari(PR_TR).length;
  await ed(s, (e) => { let a = null; e.state.doc.descendants((n, p) => { if (a === null && n.isTextblock && n.textContent.startsWith("İkinci")) a = p + 1; }); e.commands.focus(); e.commands.setTextSelection({ from: a, to: a + 6 }); }); await odakBekle(s);
  await altSlash(s); await s.waitForTimeout(1500);
  kayit("seçim varken öneri istenmez", calismaKayitlari(PR_TR).length === nSec && !(await oneri(s)));

  // 12) Tablo: öneri yokken Tab hücre değiştirir; öneri varken kabul eder.
  await sonaGit(s, "Hücre içinde");
  const hucreOnce = await ed(s, (e) => e.state.selection.$head.parent.textContent);
  await s.keyboard.press("Tab"); await s.waitForTimeout(150);
  const hucreSonra = await ed(s, (e) => e.state.selection.$head.parent.textContent);
  kayit("tabloda öneri yokken Tab sonraki hücreye geçer", hucreOnce.startsWith("Hücre içinde") && hucreSonra === "Komşu hücre", { hucreSonra });
  await sonaGit(s, "Hücre içinde"); await altSlash(s); const o4 = await bekleOneri(s);
  await s.keyboard.press("Tab"); await s.waitForTimeout(150);
  const hucreKabul = await ed(s, (e) => e.state.selection.$head.parent.textContent);
  kayit("tabloda öneri varken Tab kabul eder (hücrede kalır)", !!o4 && hucreKabul.endsWith(o4.trim()), { hucreKabul: hucreKabul.slice(-50) });
  await s.screenshot({ path: OUT + "masaustu-tablo.png" });

  // 13b) Saatlik hak dolu: öneri DURAKLATILIR ve bu görünür (düğme yazısı + Alt+/ mesajı); otomatik istek gitmez.
  psql(`insert into public.auth_rate_limits (key, window_start, count) values ('ai-asistan:${KUL.id}', now(), 99) on conflict (key) do update set window_start = now(), count = 99`);
  await s.waitForTimeout(3500);
  // Önceki adımlarda bu konum için öneri önbellekte: sunucunun "hak doldu" cevabını görmek için bağlam değişir.
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type("z"); await altSlash(s); await s.waitForTimeout(1500);
  await s.keyboard.press("Backspace");
  const duraklatma = await dugme.textContent();
  kayit("hak dolunca düğme duraklatıldığını ve kalan süreyi söyler", /Öneri · \d+ dk/.test(duraklatma ?? ""), { duraklatma });
  await s.screenshot({ path: OUT + "masaustu-duraklatildi.png" });
  const nD = calismaKayitlari(PR_TR).length;
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" dur", { delay: 40 }); await s.waitForTimeout(2600);
  kayit("duraklatılmışken otomatik istek gitmez ve öneri görünmez", calismaKayitlari(PR_TR).length === nD && !(await oneri(s)));
  await altSlash(s); await s.waitForTimeout(600);
  kayit("duraklatılmışken Alt+/ nedeni söyler (sessiz değil)", /Saatlik asistan hakkınız doldu/.test(await s.evaluate(() => document.body.innerText)));
  psql(`delete from public.auth_rate_limits where key='ai-asistan:${KUL.id}'`);

  // 14) Kapatınca otomatik istek durur.
  await dugme.click(); await s.waitForTimeout(1500);
  await sonaGit(s, "Üniversiteye"); await s.keyboard.type(" son", { delay: 40 }); const nK = calismaKayitlari(PR_TR).length; await s.waitForTimeout(2600);
  kayit("kapatınca otomatik istek gitmez", calismaKayitlari(PR_TR).length === nK && (await dugme.getAttribute("aria-pressed")) === "false");
  kayit("masaüstü TR: sayfa hatası yok", hatalar.length === 0, { hatalar });
  await c.close();
}

// ── Masaüstü, İngilizce arayüz + İngilizce belge
hakSifirla();
{
  const { c, s, hatalar } = await baglam({ viewport: { width: 1440, height: 900 } }, "en");
  /*
    TANI (21.11.2026): 20.11'deki bir koşuda bu adım öneri almadı ve sunucuda
    o çalışmaya ait HİÇ kayıt yoktu (istem modele de ulaşmamıştı). Düşerse
    nedenini ayırt edebilmek için: istemcinin gönderdiği sunucu işlemleri,
    cevap durumları ve ekrandaki bildirimler kaydedilir.
  */
  const ag = [];
  s.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) ag.push({ t: Date.now(), yon: "istek" }); });
  s.on("response", (r) => { if (r.request().method() === "POST" && r.request().headers()["next-action"]) ag.push({ t: Date.now(), yon: "cevap", durum: r.status() }); });
  await ac(s, PR_EN);
  const kayitOnce = calismaKayitlari(PR_EN).length;
  await sonaGit(s, "First-year"); await altSlash(s);
  const o = await bekleOneri(s);
  const tani = { ag, bildirim: await s.locator(".toast-yigini").innerText().catch(() => ""), kayit: calismaKayitlari(PR_EN).slice(kayitOnce), odak: await s.evaluate(() => document.activeElement?.className ?? null) };
  kayit("EN: İngilizce belgede İngilizce devam", !!o && /which shapes/.test(o), { o, ...(o ? {} : { tani }) });
  const dugme = s.getByRole("button", { name: /Automatic suggestions/ }).first();
  kayit("EN: düğme İngilizce", await dugme.isVisible());
  await s.screenshot({ path: OUT + "masaustu-en.png" });
  await s.keyboard.press("Tab"); await s.waitForTimeout(150);
  kayit("EN: Tab kabul eder", (await metin(s)).includes("which shapes"));
  kayit("EN: sayfa hatası yok", hatalar.length === 0, { hatalar });
  await c.close();
}

hakSifirla();
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
