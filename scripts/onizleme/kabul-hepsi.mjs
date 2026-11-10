/*
  TEK KABUL KOŞTURUCUSU (G1 Aşama 5, 10.11.2026): `npm run kabul:hepsi`.

  Her kabul betiğinin her kipini (scripts/onizleme/kabul-katalogu.mjs) KENDİ
  bayraklarıyla başlatılmış YENİ bir önizleme sunucusunda koşar ve sonucu
  PASS / FAIL / BLOCKED olarak yazar. Neden: ön koşullar dosya başlarında
  yazılıydı ve elle koşulurken atlanıyordu; 10.11.2026'da yazma kipi kapalı
  bir sunucuya karşı otomatik kayıt kabulü bir ürün hatası gibi göründü,
  sekiz betik daha eksik bayrak ya da argümanla "düşüyor" sanıldı.

  Yalıtım:
    - Her kip yeni bir `next dev` süreci: sahte istemcinin bellekteki
      verisi (ONIZLEME_YAZ) bir kipten ötekine taşınmaz.
    - Çağıranın ortamındaki önizleme bayrakları temizlenir; sunucu YALNIZCA
      kataloğun istediği bayraklarla açılır. Açıldıktan sonra beyanı
      (x-arvolab-onizleme) kipin ön koşuluyla karşılaştırılır; uyuşmazsa
      kip koşulmaz, BLOCKED yazılır.
    - .next önbelleği koşu boyunca KORUNUR: sunucu eylemi kimlikleri
      önbelleğe bağlı ve ai-yetki zincirinin oynatma kipleri, ilk kipin
      yakaladığı kimliği kullanır (önbellek silinince 404). İsteyen
      --temiz-onbellek ile yalnızca koşunun BAŞINDA sildirir.
    - Aynı çalışma kopyasında ikinci bir koşturucu kilit dosyasıyla
      reddedilir (aynı .next'i iki sunucu paylaşamaz).
    - Zincirde bir halka PASS değilse sonrakiler koşulmaz, BLOCKED olur.
  Kayıt: her kip için sunucu günlüğü ve betik çıktısı --cikti dizinine
  (varsayılan: işletim sisteminin geçici dizini); özet ozet.txt ve
  ozet.json. Ortam değişkenlerinin değeri yazılmaz, yalnızca bayraklar.

  Kullanım:
    npm run kabul:hepsi -- [--port=3150] [--yalniz=kayit-kabul,odak-esc-kabul/ai]
                           [--tekrar=N] [--cikti=<dizin>] [--temiz-onbellek]
                           [--zaman-asimi=<dk>] [--liste]
  Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 FAIL yok ama BLOCKED var
  (ya da koşturucunun kendisi başlatılamadı).
*/
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, rmSync, writeFileSync, readFileSync, closeSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { KATALOG, beyaniCoz, eksikler, sunucuOrtami } from "./kabul-katalogu.mjs";

const KOK = resolve(new URL("../..", import.meta.url).pathname);
const arg = process.argv.slice(2);
const secenek = (ad, varsayilan) => arg.find((a) => a.startsWith(`--${ad}=`))?.slice(ad.length + 3) ?? varsayilan;
const PORT = Number(secenek("port", "3150"));
const TEKRAR = Math.max(1, Number(secenek("tekrar", "1")));
const ZAMAN_ASIMI_MS = Number(secenek("zaman-asimi", "20")) * 60_000;
const YALNIZ = (secenek("yalniz", "") || "").split(",").filter(Boolean);
const CIKTI = resolve(secenek("cikti", join(tmpdir(), `arvolab-kabul-${new Date().toISOString().replace(/[:.]/g, "-")}`)));
const TABAN = `http://localhost:${PORT}`;

/* ---------- iş listesi ---------- */
function isler() {
  const liste = [];
  for (const betik of Object.keys(KATALOG).sort()) {
    for (const [kip, tanim] of Object.entries(KATALOG[betik].kipler)) {
      const ad = `${betik}/${kip}`;
      if (YALNIZ.length && !YALNIZ.some((y) => y === betik || y === ad)) continue;
      liste.push({ betik, kip, tanim, ad });
    }
  }
  // Zincir halkalarından biri seçildiyse zincirin tamamı gerekir (oynatma yakalamaya muhtaç).
  for (const is of [...liste]) {
    if (!is.tanim.zincir) continue;
    for (const [kip, tanim] of Object.entries(KATALOG[is.betik].kipler)) {
      if (tanim.zincir === is.tanim.zincir && !liste.some((x) => x.betik === is.betik && x.kip === kip)) {
        liste.push({ betik: is.betik, kip, tanim, ad: `${is.betik}/${kip}` });
      }
    }
  }
  // Zincir sırası katalogdaki sıradır.
  return liste.sort((a, b) => {
    if (a.betik !== b.betik) return a.betik < b.betik ? -1 : 1;
    const kipler = Object.keys(KATALOG[a.betik].kipler);
    return kipler.indexOf(a.kip) - kipler.indexOf(b.kip);
  });
}

/* ---------- sunucu ---------- */
const portAcikMi = () =>
  new Promise((coz) => {
    const s = createConnection({ port: PORT, host: "127.0.0.1" });
    s.once("connect", () => (s.destroy(), coz(true)));
    s.once("error", () => coz(false));
  });
const uyu = (ms) => new Promise((coz) => setTimeout(coz, ms));

function temizOrtam(ek) {
  const ortam = {};
  for (const [a, d] of Object.entries(process.env)) {
    // Çağıranın önizleme bayrakları sızmasın: sunucu yalnızca kataloğun istediğiyle açılır.
    if (/^(ARVOLAB_ONIZLEME|ONIZLEME_|AI_ANAHTAR$)/.test(a)) continue;
    ortam[a] = d;
  }
  return { ...ortam, ...ek };
}

async function sunucuAc(tanim, gunluk) {
  const fd = openSync(gunluk, "w");
  const surec = spawn("npx", ["next", "dev", "-p", String(PORT)], {
    cwd: KOK,
    env: temizOrtam(sunucuOrtami(tanim)),
    stdio: ["ignore", fd, fd],
    detached: true,
  });
  closeSync(fd);
  const bas = Date.now();
  let son = "";
  while (Date.now() - bas < 240_000) {
    if (surec.exitCode !== null) return { surec, hata: `sunucu süreci kapandı (çıkış ${surec.exitCode})` };
    try {
      const y = await fetch(`${TABAN}/`, { signal: AbortSignal.timeout(60_000) });
      const beyan = y.headers.get("x-arvolab-onizleme");
      if (y.ok && beyan) {
        const eksik = eksikler(tanim, beyaniCoz(beyan));
        if (eksik.length) return { surec, hata: `sunucu beklenen bayraklarla açılmadı: ${beyan}` };
        return { surec, beyan };
      }
      son = `HTTP ${y.status}${beyan ? "" : ", beyan yok"}`;
    } catch (h) {
      son = String(h?.cause?.code ?? h?.message ?? h);
    }
    await uyu(1500);
  }
  return { surec, hata: `sunucu 240 sn içinde hazır olmadı (${son})` };
}

async function sunucuKapat(surec) {
  if (!surec || surec.exitCode !== null) return;
  try {
    process.kill(-surec.pid, "SIGTERM");
  } catch {
    /* süreç grubu zaten yok */
  }
  for (let i = 0; i < 40 && surec.exitCode === null; i++) await uyu(250);
  if (surec.exitCode === null) {
    try {
      process.kill(-surec.pid, "SIGKILL");
    } catch {
      /* zaten kapandı */
    }
  }
  for (let i = 0; i < 40 && (await portAcikMi()); i++) await uyu(250);
}

/* ---------- betik ---------- */
function betikKos(is, yer, cikti) {
  return new Promise((coz) => {
    const argumanlar = is.tanim.arg.map((a) => a.replace("{taban}", TABAN).replace("{gunluk}", yer.gunluk).replace("{yakalama}", yer.yakalama));
    const fd = openSync(cikti, "w");
    const p = spawn(process.execPath, [join("scripts/onizleme", `${is.betik}.mjs`), ...argumanlar], {
      cwd: KOK,
      env: { ...temizOrtam({}), NODE_PATH: [NODE_PATH_GLOBAL, process.env.NODE_PATH].filter(Boolean).join(":") },
      stdio: ["ignore", fd, fd],
    });
    closeSync(fd);
    const zamanlayici = setTimeout(() => {
      p.kill("SIGKILL");
      coz({ kod: null, zamanAsimi: true });
    }, ZAMAN_ASIMI_MS);
    p.on("exit", (kod) => {
      clearTimeout(zamanlayici);
      coz({ kod, zamanAsimi: false });
    });
  });
}

const sonucAdi = (kod) => (kod === 0 ? "PASS" : kod === 2 ? "BLOCKED" : "FAIL");

/** Çıktının son anlamlı satırı ve düşen denetimler (rapor için). */
function ciktiOzeti(dosya) {
  const satirlar = readFileSync(dosya, "utf8").split("\n").map((s) => s.trimEnd()).filter(Boolean);
  const dusen = satirlar.filter((s) => /^\s*✗|ÖNKOŞUL YOK/.test(s)).slice(0, 4);
  return { son: satirlar.at(-1) ?? "", dusen };
}

/* ---------- ana akış ---------- */
const plan = isler();
if (arg.includes("--liste")) {
  for (const is of plan) console.log(`${is.ad.padEnd(40)} ${Object.entries(sunucuOrtami(is.tanim)).map(([a, d]) => `${a}=${d}`).join(" ")}`);
  process.exit(0);
}
if (!plan.length) {
  console.log(`--yalniz=${YALNIZ.join(",")} hiçbir kiple eşleşmedi.`);
  process.exit(2);
}
if (await portAcikMi()) {
  console.log(`Port ${PORT} dolu: başka bir sunucu çalışıyor. Kapatın ya da --port ile başka bir port verin.`);
  process.exit(2);
}
mkdirSync(join(KOK, ".next"), { recursive: true });
const KILIT = join(KOK, ".next", "kabul-hepsi.kilit");
if (existsSync(KILIT)) {
  const pid = Number(readFileSync(KILIT, "utf8"));
  let yasiyor = false;
  try {
    process.kill(pid, 0);
    yasiyor = true;
  } catch {
    /* eski kilit */
  }
  if (yasiyor) {
    console.log(`Bu çalışma kopyasında başka bir kabul koşturucusu çalışıyor (pid ${pid}).`);
    process.exit(2);
  }
}
writeFileSync(KILIT, String(process.pid));
let aktifSurec = null;
const kilidiBirak = () => {
  try {
    rmSync(KILIT, { force: true });
  } catch {
    /* zaten yok */
  }
};
for (const sinyal of ["SIGINT", "SIGTERM"]) {
  process.on(sinyal, async () => {
    await sunucuKapat(aktifSurec);
    kilidiBirak();
    process.exit(130);
  });
}
const NODE_PATH_GLOBAL = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
if (arg.includes("--temiz-onbellek")) rmSync(join(KOK, ".next", "dev"), { recursive: true, force: true });
mkdirSync(CIKTI, { recursive: true });
console.log(`Kabul koşusu: ${plan.length} kip × ${TEKRAR} tur, port ${PORT}, çıktı ${CIKTI}\n`);

const sonuclar = [];
for (let tur = 1; tur <= TEKRAR; tur++) {
  const zincirDurumu = {};
  for (const is of plan) {
    const ek = TEKRAR > 1 ? `__t${tur}` : "";
    const temel = join(CIKTI, `${is.betik}__${is.kip}${ek}`);
    const yer = {
      gunluk: `${temel}.sunucu.log`,
      yakalama: join(CIKTI, `${is.betik}__${is.tanim.zincir ?? is.kip}${ek}.yakalama.json`),
    };
    const kayit = { ad: is.ad, tur, sonuc: "BLOCKED", sure: 0, neden: "", dusen: [] };
    const bas = Date.now();
    if (is.tanim.zincir && zincirDurumu[is.tanim.zincir] && zincirDurumu[is.tanim.zincir] !== "PASS") {
      kayit.neden = `zincirin önceki halkası ${zincirDurumu[is.tanim.zincir]}`;
    } else {
      const { surec, hata } = await sunucuAc(is.tanim, yer.gunluk);
      aktifSurec = surec;
      if (hata) {
        kayit.neden = hata;
      } else {
        const { kod, zamanAsimi } = await betikKos(is, yer, `${temel}.cikti.txt`);
        const o = ciktiOzeti(`${temel}.cikti.txt`);
        // Zaman aşımı FAIL: bir kilitlenme gerçek bir hata olabilir; BLOCKED demek onu gizlerdi.
        kayit.sonuc = zamanAsimi ? "FAIL" : sonucAdi(kod);
        kayit.neden = zamanAsimi ? `zaman aşımı (${ZAMAN_ASIMI_MS / 60000} dk)` : o.son;
        kayit.dusen = o.dusen;
      }
      await sunucuKapat(surec);
      aktifSurec = null;
    }
    if (is.tanim.zincir) zincirDurumu[is.tanim.zincir] = kayit.sonuc;
    kayit.sure = Math.round((Date.now() - bas) / 1000);
    sonuclar.push(kayit);
    console.log(`${kayit.sonuc.padEnd(8)} ${is.ad}${TEKRAR > 1 ? ` (tur ${tur})` : ""}  ${kayit.sure} sn  ${kayit.neden.slice(0, 140)}`);
    for (const d of kayit.dusen) console.log(`           ${d.trim().slice(0, 200)}`);
  }
}
kilidiBirak();

const say = (s) => sonuclar.filter((k) => k.sonuc === s).length;
const ozet = `\nPASS ${say("PASS")} · FAIL ${say("FAIL")} · BLOCKED ${say("BLOCKED")} (toplam ${sonuclar.length})\nÇıktılar: ${CIKTI}`;
console.log(ozet);
writeFileSync(join(CIKTI, "ozet.json"), JSON.stringify({ port: PORT, tekrar: TEKRAR, sonuclar }, null, 2));
writeFileSync(
  join(CIKTI, "ozet.txt"),
  sonuclar.map((k) => `${k.sonuc.padEnd(8)} ${k.ad}${TEKRAR > 1 ? ` (tur ${k.tur})` : ""}  ${k.sure} sn  ${k.neden}`).join("\n") + ozet + "\n",
);
process.exit(say("FAIL") ? 1 : say("BLOCKED") ? 2 : 0);
