#!/usr/bin/env node
/*
  G1 AŞAMA 8.6 — TEST AUTH YARDIMCISI (U1). 11.11.2026.
  BU BETİK HENÜZ GERÇEK KİPTE ÇALIŞTIRILMADI. Varsayılan KURU: hiçbir
  yere bağlanmaz, anahtar okumaz, tarayıcı açmaz; yalnızca planı yazar.
  Gerçek işlem yalnızca `--calistir` ile ve ayrıca onaylandıktan sonra.

  NEDEN: Preview'da e-posta altyapısı yok (RESEND_API_KEY tanımlı değil);
  kayıt ve kurtarma bağlantısı kimseye ulaşmıyor. Gerçek GoTrue akışını
  (onay → şifresiz ara durum → R1 kurtarma → ilk şifre) sınamak için
  bağlantının, uygulamanın kendi kullandığı yönetim çağrısıyla
  (auth.admin.generateLink) üretilmesi gerekiyor. Uygulamanın kayıt
  FORMU kullanılmıyor: form, silinemeyen bir sözleşme onay kaydına test
  edenin IP ve konumunu yazıyor (G1 Aşama 8.6A.1). Kullanıcı aynı GoTrue
  çağrısıyla, aynı biçimde oluşturuluyor; onaydan sonraki her adım gerçek.

  İŞLEMLER (başka hiçbir yönetim çağrısı yok):
    olustur    Önce niyeti deftere yazar, sonra U1'i oluşturur ve kayıt
               doğrulama bağlantısını tarayıcıda açar
    olustur --u2  G1-B: U2'yi BİLİNEN bir test şifresiyle oluşturur; bağlantıyı
               AÇMAZ, onay öncesi giriş denemesi için "devam" yazılmasını
               bekler, sonra AYNI kayıt bağlantısını açar (yeniden üretmez)
    uzlastir   Yarım kalan bir oluşturmayı çözer; HİÇBİR ŞEY SİLMEZ
    dogrulama  U1 onaysızsa yeni kayıt doğrulama bağlantısı açar
    kurtarma   U1 onaylıysa kurtarma (recovery) bağlantısı açar
    durum      U1'in onay durumunu okur; şifre durumu için salt okunur SQL yazar
    temizle    YALNIZCA kayıt defterindeki U1'i siler
  `plan` (varsayılan) ve `--calistir` verilmeyen her işlem KURU kiptir.

  G1-B KABUL PROSEDÜRÜ (U2; betik ekrana da yazar):
    B0  `olustur --u2 --calistir` U2'yi oluşturur ve BEKLER. Onaydan ÖNCE salt
        okunur SQL ile `sifre_yok = false` görülmeli (bilinen şifre gerçekten
        konmuş). Sorguyu betik U2 kimliğiyle yazar.
    B1  Karşıt giriş denemesi (uygulamanın giriş formu, aynı U2 e-postası):
        B1a YANLIŞ şifre → "E-posta adresi veya şifre hatalı." (invalid-credentials)
        B1b DOĞRU şifre  → "E-posta adresiniz henüz doğrulanmadı." (email-not-confirmed)
        Kanıt değeri: iki sonucun FARKLI olması GoTrue'nun şifreyi denetlediğini
        ve bilinen şifrenin geçerli olduğunu gösterir. İkisi aynıysa B1 kanıt
        sayılmaz.
        B0 ya da B1 tutmazsa "devam" YAZILMAZ: "iptal" yazılır, test BLOCKED
        olarak kaydedilir ve U2 `temizle --calistir` ile silinir.
    B2  "devam" → AYNI kayıt bağlantısı açılır (yeniden üretilmez). Beklenen:
        ilk şifre ekranı (/reset-password?ilk=1). ŞİFRE BELİRLENMEZ; "Çıkış
        yap" kullanılır. Şifre NULL olduğu sürece ilk şifre kapısı panele
        geçirmez, yani sözleşme penceresine gelinmez; sözleşme KABUL EDİLMEZ.
    B3  Gizli pencerede aynı eski şifreyle giriş → "E-posta adresi veya şifre
        hatalı." (invalid-credentials). Giriş başarılıysa kritik FAIL.
    B4  `durum --calistir` + salt okunur SQL: `onayli = true`, `sifre_yok = true`.
    B5  Sözleşme sayıları değişmemiş (toplam, sahipsiz, G1 sentetik).
    B6  `temizle --calistir`; son denetim: kullanıcı sayısı ve kimlik kümesi
        özeti başlangıçla aynı, G1 hesap 0, kayıt defteri arşivlenmiş.

  KURTARMA PROSEDÜRÜ (yarım kalan ya da belirsiz koşu):
    1. `uzlastir --calistir`. Sonuç üç türlüdür:
       - "oluşmamış"   → defter arşivlenir, yeniden `olustur` güvenli.
       - "bağlandı"    → U1 bulunup deftere bağlandı; `temizle --calistir`.
       - "belirsiz"    → hiçbir şey değişmez. 2. adıma geçin.
    2. Belirsizde OTOMATİK SİLME YOK. Test projesinde salt okunur SQL ile
       niyetteki e-postayı (defterde yazılı, arvolab-g1-86-u1-…) arayın:
       select id, created_at, raw_user_meta_data->>'g1_86' from auth.users
       where email = '<defterdeki e-posta>';
       Yalnızca bu sentetik e-postaya sahip, g1_86 işaretli ve niyet
       zamanından sonra oluşmuş kullanıcı bu betiğindir. Silme kararı ve
       işlemi ayrıca onaylanır (Supabase panelinden tek kullanıcı); mevcut
       kullanıcılara hiçbir koşulda dokunulmaz.
    3. Defter elle düzeltilmez: imza bozulur ve betik durur. Çözüldükten
       sonra defter arşive taşınır (yeniden adlandırılır, silinmez).

  HEDEF KAPILARI (hepsi ağsız, anahtar okunmadan ve yönetim istemcisi
  kurulmadan ÖNCE):
    1. Adres yalnızca Test projesi: https://kyvjftrsweqjlgjeobnq.supabase.co.
       Kimlik koda gömülü; ortam değişkeni değiştiremez.
    2. Kodda sabit üretim kimliği (zpfpocyajnxcketdjbxm) adreste ya da
       ARVOLAB_TEST_SUPABASE_REF'te geçerse ret.
    3. ARVOLAB_TEK_PROJE hiçbir koşulda okunmaz; hiçbir kapıyı açmaz.
    4. ARVOLAB_TEST_SUPABASE_REF tanımlıysa Test kimliğine eşit olmalı.
    5. Açılacak bağlantının kökü yalnızca izinli listeden (entegrasyon
       Preview'ı ya da localhost:3000).
    6. Sentetik adres yalnızca arvolab-g1-86-u1-<YYYYMMDDHHmm>@example.com.

  MEVCUT KULLANICI KORUMASI: `olustur`, kullanıcıyı açmadan önce projedeki
  bütün kullanıcı kimliklerinin SHA-256 özetini kayıt defterine yazar
  (e-posta yazılmaz). Sonraki her bağlantı ve silme işlemi hedef kimliği
  bu listeyle karşılaştırır; listede olan bir kimliğe hiçbir işlem
  yapılmaz. Hedef ayrıca: kayıt defterindeki kimlik VE e-posta, sentetik
  desen, `user_metadata.g1_86 = true` ve oluşturulma zamanı ile eşleşmeli.

  GİZLİLİK:
    - Anahtar yalnızca SUPABASE_SECRET_KEY ortam değişkeninden, yalnızca
      gerçek kipte ve kapılardan sonra okunur. Argüman, dosya ya da URL
      olarak alınmaz; hiçbir çıktıya yazılmaz. Kabuk geçmişine girmemesi
      için değeri komut satırına yazmayın (`read -s` ile okutun).
    - token, hashed_token, action_link ve bağlantı hiçbir çıktıya ve
      dosyaya yazılmaz. Bağlantı tarayıcıya 127.0.0.1 üzerindeki TEK
      KULLANIMLIK bir yönlendirmeyle verilir: işlem listesinde yalnızca
      rastgele, bir kez çalışan yerel bir adres görünür. Tarayıcı
      geçmişinde son adres kalır; belirteç tek kullanımlık olduğu için
      açıldıktan sonra işe yaramaz.
    - Hata çıktısı yalnızca hata kodu ve HTTP durumudur; Supabase'in yanıt
      gövdesi ve mesajı yazılmaz.

  ORTAM (yalnızca kendi terminalinizde):
    NEXT_PUBLIC_SUPABASE_URL=https://kyvjftrsweqjlgjeobnq.supabase.co
    SUPABASE_SECRET_KEY        (yalnızca --calistir; Test projesinin)
    G1_86_KAYIT                (isteğe bağlı; kayıt defteri yolu,
                                varsayılan ~/.arvolab-g1-86/kayit.json)

  Kullanım:
    node scripts/test-ortami/g1-86-baglanti.mjs [plan|olustur|uzlastir|dogrulama|kurtarma|durum|temizle] [--u2] [--origin=<izinli kök>] [--calistir]
  U2 (G1-B) ek ortam: G1_86_U2_SIFRE (yalnızca `olustur --u2 --calistir`; yalnızca
  bu test için yeni bir şifre, Read-Host -AsSecureString ile girilir).
  Çıkış: 0 tamam, 1 işlem sırasında hata (güvenli durdu), 2 kapı reddetti
  (hiçbir işlem yapılmadı).
*/
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { anahtarProjesi, projeKimligi, SABIT_URETIM_SUPABASE_REF, uretimProjesiniGosteriyor } from "../../lib/supabase/ortam-guvenligi.ts";
import { authConfirmLink } from "../../lib/auth-link.ts";
import { ILK_SIFRE_YOLU } from "../../lib/ilk-sifre.ts";

/* Test projesinin kimliği BİLEREK koda gömülü: ortam değişkeni yanlış girilse de hedef değişmez. */
export const TEST_REF = "kyvjftrsweqjlgjeobnq";
export const URETIM_REF = SABIT_URETIM_SUPABASE_REF;
export const IZINLI_KOKLER = ["https://arvo-lab-git-entegrasyon-g1-tasarim-arvo-os.vercel.app", "http://localhost:3000"];
export const VARSAYILAN_KOK = IZINLI_KOKLER[0];
export const EPOSTA_DESENI = /^arvolab-g1-86-(u1|u2)-\d{12}@example\.com$/;
export const ROLLER = ["u1", "u2"];
export const ISLEMLER = ["plan", "olustur", "uzlastir", "dogrulama", "kurtarma", "durum", "temizle"];
const SENTETIK_AD = "G1 8.6 Sentetik (silinecek)";
/* Oluşturma yanıtındaki zaman ile şimdiki zaman arasında kabul edilen en büyük fark. */
const TAZE_SINIR_MS = 10 * 60 * 1000;

/** Kapı reddi (çıkış 2) ya da işlem hatası (çıkış 1). Mesajda gizli değer olmaz. */
export class Dur extends Error {
  constructor(mesaj, cikis = 2) {
    super(mesaj);
    this.name = "Dur";
    this.cikis = cikis;
  }
}

/* ---------------- Saf kararlar (ağsız, anahtarsız) ---------------- */

/** Supabase hatasından yalnızca kod ve HTTP durumu. Mesaj ve gövde bilerek atılır. */
export function guvenliHata(hata) {
  const kod = typeof hata?.code === "string" && /^[a-z0-9_]{1,64}$/i.test(hata.code) ? hata.code : "bilinmiyor";
  const durum = Number.isInteger(hata?.status) ? hata.status : "-";
  return `kod=${kod} http=${durum}`;
}

export const kimlikOzeti = (id) => createHash("sha256").update(String(id)).digest("hex");

/** UTC damgasıyla sentetik adres (dakika çözünürlüğü). Rol yalnızca u1 ya da u2. */
export function sentetikEposta(rol, simdi = new Date()) {
  if (!ROLLER.includes(rol)) throw new Dur("Bilinmeyen sentetik rol.");
  const d = simdi.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  return `arvolab-g1-86-${rol}-${d}@example.com`;
}

/** Geriye dönük: U1 adresi. */
export function u1Epostasi(simdi = new Date()) {
  return sentetikEposta("u1", simdi);
}

/** Adresteki rol (u1/u2); desene uymuyorsa null. */
export function epostaRolu(eposta) {
  const m = EPOSTA_DESENI.exec(String(eposta ?? ""));
  return m ? m[1] : null;
}

export function epostaGecerli(eposta) {
  return typeof eposta === "string" && EPOSTA_DESENI.test(eposta);
}

/** Argümanlar: işlem, --calistir, --origin=. Bilinmeyen her şey ret. */
export function argumanlariCoz(argv) {
  let islem = "plan";
  let calistir = false;
  let kok = VARSAYILAN_KOK;
  let islemVerildi = false;
  let u2 = false;
  for (const a of argv) {
    if (a === "--calistir") calistir = true;
    else if (a === "--u2") u2 = true;
    else if (a.startsWith("--origin=")) kok = a.slice("--origin=".length);
    else if (!a.startsWith("-") && !islemVerildi && ISLEMLER.includes(a)) {
      islem = a;
      islemVerildi = true;
    } else throw new Dur(`Bilinmeyen argüman: ${a.slice(0, 40)}`);
  }
  if (!IZINLI_KOKLER.includes(kok)) throw new Dur("Bağlantı kökü izinli listede değil.");
  // --u2 yalnızca oluşturmayı (ve planını) değiştirir; diğer işlemler rolü kayıt defterinden alır.
  if (u2 && islem !== "olustur" && islem !== "plan") throw new Dur("--u2 yalnızca `olustur` (ya da `plan`) ile kullanılır.");
  return { islem, calistir: calistir && islem !== "plan", kok, rol: u2 ? "u2" : "u1" };
}

/**
 * Hedef kapıları. Yalnızca adres ve kimlik değişkenlerine bakar; anahtar
 * OKUMAZ, ağa çıkmaz. ARVOLAB_TEK_PROJE bilerek hiç okunmaz.
 */
export function hedefDenetle(env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const testDegiskeni = String(env.ARVOLAB_TEST_SUPABASE_REF ?? "").trim();
  if (uretimProjesiniGosteriyor(url, testDegiskeni)) throw new Dur(`Hedef üretim projesini gösteriyor (${URETIM_REF}); hiçbir işlem yapılmaz.`);
  if (!url) throw new Dur("NEXT_PUBLIC_SUPABASE_URL tanımlı değil.");
  const ref = projeKimligi(url);
  if (ref !== TEST_REF) throw new Dur(`Adres Test projesi değil (beklenen ${TEST_REF}).`);
  if (url.replace(/\/+$/, "") !== `https://${TEST_REF}.supabase.co`) throw new Dur("Adres beklenen biçimde değil (https://<test>.supabase.co, yol yok).");
  if (testDegiskeni && testDegiskeni !== TEST_REF) throw new Dur("ARVOLAB_TEST_SUPABASE_REF Test projesiyle eşleşmiyor.");
  return `https://${TEST_REF}.supabase.co`;
}

/** Gerçek kipte, kapılardan SONRA. Değer hiçbir yere yazılmaz. */
export function anahtarOku(env) {
  const anahtar = String(env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!anahtar) throw new Dur("SUPABASE_SECRET_KEY tanımlı değil (yalnızca kendi terminalinizde).");
  if (anahtar.startsWith("sb_publishable_")) throw new Dur("Verilen anahtar publishable anahtar; sunucu anahtarı gerekir.");
  const jwt = anahtarProjesi(anahtar);
  if (jwt?.ref && jwt.ref !== TEST_REF) throw new Dur("Anahtar Test projesine ait değil.");
  if (jwt?.rol && jwt.rol !== "service_role") throw new Dur("Anahtar service_role anahtarı değil.");
  return anahtar;
}

/*
  U2 TEST ŞİFRESİ (G1-B). Yalnızca `olustur --u2 --calistir` okur; okunduktan
  hemen sonra (geçersiz olsa da) ortamdan silinir, hiçbir alt sürece geçmez.
  Değer hiçbir çıktıya, hata mesajına, kayıt defterine ya da URL'ye yazılmaz;
  hata mesajları yalnızca kuralın adını söyler. 72 bayt sınırı bcrypt'in
  (GoTrue) okuduğu üst sınırdır: daha uzun bir şifrenin fazlası sessizce
  yok sayılır ve test yanlış güven verir.
*/
export function u2SifresiOku(env, anahtar) {
  let sifre;
  try {
    sifre = String(env.G1_86_U2_SIFRE ?? "");
  } finally {
    delete env.G1_86_U2_SIFRE;
  }
  if (!sifre) throw new Dur("G1_86_U2_SIFRE tanımlı değil (yalnızca kendi terminalinizde, Read-Host -AsSecureString ile).");
  if (sifre.length < 8) throw new Dur("U2 test şifresi en az 8 karakter olmalı.");
  if (Buffer.byteLength(sifre, "utf8") > 72) throw new Dur("U2 test şifresi 72 baytı geçmemeli.");
  if (sifre !== sifre.trim()) throw new Dur("U2 test şifresi baş/son boşluk içermemeli.");
  if (anahtar && sifre === anahtar) throw new Dur("U2 test şifresi anahtarla aynı olamaz.");
  return sifre;
}

/* ---------------- Kayıt defteri ---------------- */

/*
  KAYIT DEFTERİ (sürüm 2, 11.11.2026). Sürüm 1'de defter, kullanıcı
  oluşturulup yanıt doğrulandıktan SONRA yazılıyordu. Arada dört yolda
  izi olmayan bir kullanıcı kalabiliyordu: yanıt kaybolunca (zaman aşımı),
  yanıt beklenmedik gelince (ör. created_at eksik), defter yazılamayınca
  ve işlem tam o aralıkta kesilince. Artık önce NİYET yazılır
  (durum "olusturuluyor": e-posta, niyet zamanı, başlangıç kümesi),
  kullanıcı ancak ondan sonra oluşturulur. Niyeti kalan bir defter
  `uzlastir` ile çözülür; o da hiçbir şey silmez.

  Bütünlük: dosya izni (0600) bir kanıt DEĞİL. Defter, service-role
  anahtarından türetilen bir anahtarla HMAC-SHA256 ile imzalanır
  (node:crypto; yeni bağımlılık yok). Anahtarı olmayan biri ya da
  elle yapılan bir düzeltme imzayı bozar ve gerçek kipteki her işlem
  durur. İmza bir saldırganı değil kazayı durdurur: anahtarı olan
  zaten Test projesinin tamamına erişebilir. Asıl güvence her silme ve
  bağlantı öncesinde kullanıcının yönetim API'sinden YENİDEN okunup
  kimlik, sentetik e-posta, g1_86 işareti, oluşturulma zamanı ve
  başlangıç kümesiyle karşılaştırılmasıdır; defter tek başına hiçbir
  şeye izin vermez.

  Eski bir kopyaya dönüş: silinen kullanıcının defteri silmeden önce
  "silindi" durumuna imzalanıp arşivlenir; o kopya geri konursa hiçbir
  işlem kabul etmez. Daha eski bir "olusturuldu" kopyası ise canlı
  kullanıcıyla eşleşmez (kullanıcı yok ya da zamanı farklı) ve durur.
*/
export const DURUMLAR = ["olusturuluyor", "olusturuldu", "silindi", "olusmadi"];
const IMZA_ETIKETI = "arvolab-g1-86-kayit-defteri-v2";

export function varsayilanKayitYolu(env) {
  return env.G1_86_KAYIT ? path.resolve(env.G1_86_KAYIT) : path.join(os.homedir(), ".arvolab-g1-86", "kayit.json");
}

/** İmzalanan içerik: alanlar sabit sırada, imza hariç. */
function imzaIcerigi(k) {
  return JSON.stringify([k.surum, k.proje, k.durum, k.eposta, k.niyetZamani, k.userId, k.olusturuldu, [...k.korunanOzetler].sort()]);
}

/** İmza anahtarı service-role anahtarından türetilir; anahtarın kendisi saklanmaz. */
export function imzaAnahtari(anahtar) {
  return createHmac("sha256", String(anahtar)).update(IMZA_ETIKETI).digest();
}

export function kayitImzala(kayit, imzaAnahtar) {
  return createHmac("sha256", imzaAnahtar).update(imzaIcerigi(kayit)).digest("hex");
}

/** Biçim denetimi (imzadan bağımsız). Her durumun zorunlu alanları ayrı. */
function bicimGecerli(k) {
  const ozetler = Array.isArray(k?.korunanOzetler) && k.korunanOzetler.every((o) => typeof o === "string" && /^[0-9a-f]{64}$/.test(o));
  if (k?.surum !== 2 || k.proje !== TEST_REF || !DURUMLAR.includes(k.durum) || !epostaGecerli(k.eposta) || typeof k.niyetZamani !== "string" || !ozetler) return false;
  if (typeof k.imza !== "string" || !/^[0-9a-f]{64}$/.test(k.imza)) return false;
  const kimlikli = typeof k.userId === "string" && typeof k.olusturuldu === "string";
  if (k.durum === "olusturuldu" || k.durum === "silindi") return kimlikli;
  if (k.durum === "olusturuluyor" || k.durum === "olusmadi") return k.userId === null && k.olusturuldu === null;
  return false;
}

/**
 * Defteri okur. imzaAnahtar verilirse imza doğrulanır (gerçek kip); verilmezse
 * (kuru kip) yalnızca biçim denetlenir ve `imzaDogrulandi: false` döner.
 */
export function kayitOku(yol, imzaAnahtar = null) {
  if (!fs.existsSync(yol)) return null;
  let k;
  try {
    k = JSON.parse(fs.readFileSync(yol, "utf8"));
  } catch {
    throw new Dur("Kayıt defteri okunamadı; elle düzeltilmeden işlem yapılmaz.", 1);
  }
  if (!bicimGecerli(k)) throw new Dur("Kayıt defteri beklenen biçimde değil; işlem yapılmaz.", 1);
  if (imzaAnahtar) {
    const beklenen = Buffer.from(kayitImzala(k, imzaAnahtar), "hex");
    const gelen = Buffer.from(k.imza, "hex");
    if (beklenen.length !== gelen.length || !timingSafeEqual(beklenen, gelen)) {
      throw new Dur("Kayıt defterinin imzası doğrulanamadı (elle değiştirilmiş ya da başka bir anahtarla yazılmış); işlem yapılmaz.", 1);
    }
  }
  return { ...k, imzaDogrulandi: Boolean(imzaAnahtar) };
}

export function kayitYaz(yol, kayit, imzaAnahtar) {
  // Yalnızca tanımlı alanlar yazılır; okumada eklenen `imzaDogrulandi` ve eski imza diske geri gitmez.
  const saf = { surum: kayit.surum, proje: kayit.proje, durum: kayit.durum, eposta: kayit.eposta, niyetZamani: kayit.niyetZamani, userId: kayit.userId, olusturuldu: kayit.olusturuldu, korunanOzetler: kayit.korunanOzetler };
  const imzali = { ...saf, imza: kayitImzala(saf, imzaAnahtar) };
  if (!bicimGecerli(imzali)) throw new Dur("Kayıt defterine geçersiz içerik yazılmak istendi; durduruldu.", 1);
  fs.mkdirSync(path.dirname(yol), { recursive: true, mode: 0o700 });
  const gecici = `${yol}.${process.pid}.tmp`;
  fs.writeFileSync(gecici, `${JSON.stringify(imzali, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(gecici, yol);
  return imzali;
}

/**
 * Bir kullanıcı üzerinde işlem yapılmadan önceki kimlik denetimi. Hepsi
 * tutmalı; biri tutmazsa işlem yapılmaz. Kullanıcı nesnesi yönetim
 * API'sinden YENİ okunmuş olmalı (kayıt defterine güvenilmez).
 */
export function hedefKullaniciDenetle(kayit, kullanici) {
  if (!kayit) throw new Dur("Kayıt defteri yok: bu betiğin oluşturduğu bir kullanıcı yok, işlem yapılmaz.");
  if (kayit.durum !== "olusturuldu") throw new Dur(`Kayıt defteri "${kayit.durum}" durumunda; bu işlem yalnızca "olusturuldu" durumunda yapılır.`);
  if (!kullanici || typeof kullanici.id !== "string") throw new Dur("Kullanıcı okunamadı; işlem yapılmaz.", 1);
  if (kayit.korunanOzetler.includes(kimlikOzeti(kullanici.id))) throw new Dur("Hedef, oluşturmadan önce var olan bir kullanıcı; işlem yapılmaz.");
  if (kullanici.id !== kayit.userId) throw new Dur("Kullanıcı kimliği kayıt defteriyle eşleşmiyor.");
  if (String(kullanici.email ?? "").toLowerCase() !== kayit.eposta) throw new Dur("Kullanıcının e-postası kayıt defteriyle eşleşmiyor.");
  if (!epostaGecerli(kullanici.email)) throw new Dur("Kullanıcının e-postası sentetik desene uymuyor.");
  if (kullanici.user_metadata?.g1_86 !== true) throw new Dur("Kullanıcı bu betiğin işaretini (g1_86) taşımıyor.");
  const rolIsareti = kullanici.user_metadata?.g1_86_rol;
  if (rolIsareti !== undefined && rolIsareti !== epostaRolu(kullanici.email)) throw new Dur("Kullanıcının rol işareti e-postasıyla eşleşmiyor.");
  if (kullanici.created_at !== kayit.olusturuldu) throw new Dur("Kullanıcının oluşturulma zamanı kayıt defteriyle eşleşmiyor.");
  return kullanici;
}

/**
 * Bir kullanıcının bu niyetle oluşturulan U1 olduğunu kanıtlayan ortak kural
 * (oluşturma yanıtı ve uzlaştırma aynı kuralı kullanır). Kanıt eksikse null
 * değil, gerekçeli ret.
 */
export function niyetleEslesir(kullanici, kayit) {
  if (!kullanici || typeof kullanici.id !== "string") return "kullanıcı nesnesi yok";
  if (kayit.korunanOzetler.includes(kimlikOzeti(kullanici.id))) return "kimlik başlangıç kümesinde (önceden vardı)";
  if (String(kullanici.email ?? "").toLowerCase() !== kayit.eposta) return "e-posta niyetle eşleşmiyor";
  if (kullanici.user_metadata?.g1_86 !== true) return "g1_86 işareti yok";
  const rolIsareti = kullanici.user_metadata?.g1_86_rol;
  if (rolIsareti !== undefined && rolIsareti !== epostaRolu(kayit.eposta)) return "rol işareti e-postayla eşleşmiyor";
  const zaman = Date.parse(kullanici.created_at ?? "");
  const niyet = Date.parse(kayit.niyetZamani);
  if (!Number.isFinite(zaman)) return "oluşturulma zamanı yok ya da okunamıyor";
  // Saat farkına küçük bir pay: kullanıcı niyetten önce oluşmuş olamaz, ama iki saat birebir aynı değil.
  if (zaman < niyet - 2 * 60 * 1000 || zaman > niyet + TAZE_SINIR_MS) return "oluşturulma zamanı niyet aralığında değil";
  return null;
}

/** Bağlantıyı, uygulamanın e-postada kurduğu biçimde kurar (lib/auth-link.ts). Yazdırılmaz. */
export function baglantiKur(kok, hashedToken, tur) {
  if (typeof hashedToken !== "string" || !hashedToken) throw new Dur("Doğrulama belirteci alınamadı.", 1);
  return authConfirmLink(kok, hashedToken, tur, tur === "signup" ? ILK_SIFRE_YOLU : "/reset-password");
}

/* ---------------- Yan etkili parçalar (gerçek kipte; testte sahte) ---------------- */

/** Projedeki bütün kullanıcı kimliklerinin özeti. E-posta tutulmaz. */
export async function korunanOzetleriTopla(admin) {
  const ozetler = [];
  for (let sayfa = 1; sayfa <= 100; sayfa++) {
    const { data, error } = await admin.listUsers({ page: sayfa, perPage: 1000 });
    if (error) throw new Dur(`Kullanıcı listesi okunamadı (${guvenliHata(error)}).`, 1);
    const kullanicilar = data?.users ?? [];
    for (const k of kullanicilar) ozetler.push(kimlikOzeti(k.id));
    if (kullanicilar.length < 1000) return ozetler;
  }
  throw new Dur("Kullanıcı listesi beklenenden uzun; işlem yapılmaz.", 1);
}

/**
 * Bağlantıyı 127.0.0.1 üzerinde tek kullanımlık bir yönlendirmeyle açar.
 * Açıcıya (open/xdg-open/explorer) yalnızca rastgele yerel adres verilir;
 * gerçek bağlantı işlem listesine, kabuk geçmişine ve diske girmez.
 *
 * Kapanış (Ö3, 11.11.2026): eskiden yanıttan sonra sunucu, tarayıcının
 * açık tuttuğu (keep-alive) bağlantı yüzünden ~6 sn daha yaşıyordu. Her
 * yanıt artık "Connection: close" taşır; Node soketi yanıt TAMAMEN
 * gönderildikten sonra kapatır (yanıt yarıda kesilmez). Zaman aşımında
 * bekleyen bağlantılar da zorla kapatılır.
 */
export async function baglantiyiAc(baglanti, { acici = sistemAcicisi, bekleme = 120_000 } = {}) {
  const nonce = randomBytes(24).toString("base64url");
  let kullanildi = false;
  const sunucu = http.createServer((istek, yanit) => {
    const baslik = { "cache-control": "no-store", "referrer-policy": "no-referrer", connection: "close" };
    if (!kullanildi && istek.method === "GET" && istek.url === `/${nonce}`) {
      kullanildi = true;
      // Yeni bağlantı kabulü HEMEN durur; mevcut yanıt bitince soket kapanır.
      sunucu.close();
      yanit.writeHead(302, { ...baslik, location: baglanti });
      yanit.end();
      return;
    }
    yanit.writeHead(404, baslik);
    yanit.end();
  });
  await new Promise((coz, red) => {
    sunucu.once("error", red);
    sunucu.listen(0, "127.0.0.1", coz);
  });
  const yerel = `http://127.0.0.1:${sunucu.address().port}/${nonce}`;
  const kapandi = new Promise((coz) => sunucu.once("close", coz));
  const zaman = setTimeout(() => {
    sunucu.close();
    sunucu.closeAllConnections();
  }, bekleme);
  try {
    await acici(yerel);
    await kapandi;
  } finally {
    clearTimeout(zaman);
    if (sunucu.listening) sunucu.close();
    sunucu.closeAllConnections();
  }
  if (!kullanildi) throw new Dur("Tarayıcı bağlantıyı süresinde açmadı; belirteç kullanılmadı.", 1);
}

/*
  AÇICI ORTAMI (Ö1, 11.11.2026). Eskiden açıcı (explorer/open/xdg-open)
  betiğin bütün ortamını devralıyordu; açıcı tarayıcıyı başlatırsa
  SUPABASE_SECRET_KEY tarayıcının ortamında yaşamaya devam ediyordu. Artık
  açıcıya yalnızca izin listesindeki değişkenler gider; listede olsa bile
  anahtar/sır biçimli bir ad asla geçmez. Windows'ta ortam adları büyük/küçük
  harf duyarsızdır (Path = PATH); arama da öyle yapılır.
*/
export const ACICI_DEGISKENLERI = {
  win32: ["SystemRoot", "windir", "SystemDrive", "PATH", "PATHEXT", "ComSpec", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH", "USERNAME", "USERDOMAIN"],
  darwin: ["PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "LANG", "LC_ALL", "__CF_USER_TEXT_ENCODING"],
  linux: ["PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "DISPLAY", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "XDG_CURRENT_DESKTOP", "XDG_DATA_DIRS", "XDG_CONFIG_DIRS", "DBUS_SESSION_BUS_ADDRESS", "BROWSER"],
};
/*
  "SESSION" bilerek listede DEĞİL (8.6B.4): Linux'ta xdg-open'ın tarayıcıyı
  bulması için gereken DBUS_SESSION_BUS_ADDRESS'i eliyordu. Oturum sırrı
  taşıyan adlar (SESSION_TOKEN, AUTH_SESSION, SESSION_COOKIE) zaten TOKEN,
  AUTH ya da COOKIE ile yakalanır; asıl sınır yine açık izin listesidir.
*/
const SIR_BICIMI = /SECRET|KEY|TOKEN|PASSWORD|PASSWD|CREDENTIAL|SUPABASE|AUTH|COOKIE|SIFRE|PAROLA/i;

export function aciciOrtami(env = process.env, platform = process.platform) {
  const liste = ACICI_DEGISKENLERI[platform] ?? ACICI_DEGISKENLERI.linux;
  const adlar = Object.keys(env);
  const sonuc = {};
  for (const istenen of liste) {
    if (SIR_BICIMI.test(istenen)) continue;
    const ad = platform === "win32" ? adlar.find((a) => a.toLowerCase() === istenen.toLowerCase()) : adlar.find((a) => a === istenen);
    if (ad !== undefined && typeof env[ad] === "string") sonuc[istenen] = env[ad];
  }
  return sonuc;
}

/** Platforma göre açıcı. spawnFn ve ortam testte sahtesiyle verilir. */
export function sistemAcicisiKur({ platform = process.platform, env = process.env, spawnFn = spawn } = {}) {
  return (adres) => {
    const komut = platform === "darwin" ? "open" : platform === "win32" ? "explorer.exe" : "xdg-open";
    return new Promise((coz, red) => {
      let c;
      try {
        c = spawnFn(komut, [adres], { stdio: "ignore", detached: true, shell: false, windowsHide: true, env: aciciOrtami(env, platform) });
      } catch {
        red(new Dur("Tarayıcı açılamadı.", 1));
        return;
      }
      c.once("error", () => red(new Dur("Tarayıcı açılamadı.", 1)));
      c.once("spawn", () => {
        c.unref();
        coz();
      });
    });
  };
}

function sistemAcicisi(adres) {
  return sistemAcicisiKur()(adres);
}

/*
  ONAY ÖNCESİ BEKLEME (G1-B). Kullanıcı "devam" yazana kadar bağlantı
  AÇILMAZ; Enter tek başına yetmez (yanlışlıkla B1 adımı atlanmasın).
  "iptal" ya da girişin kapanması (EOF) bağlantıyı açmaz; U2 kayıt defterinde
  "olusturuldu" olarak kaldığı için `temizle` ile silinebilir. Ctrl+C ve
  terminalin kapanması bu işleve "kapandi" olarak GELMEZ: süreç sonlanır.
  Sonuç aynıdır (bağlantı açılmaz, kayıt defteri beklemeden önce yazıldığı
  için diskte kalır), ama bu yol birim testinde DOĞRULANMADI; yalnızca
  tasarımdan çıkarılıyor.
*/
export function devamBekleKur({ girdi = process.stdin, cikti = process.stdout } = {}) {
  return (soru) =>
    new Promise((coz) => {
      const rl = readline.createInterface({ input: girdi, output: cikti, terminal: false });
      let bitti = false;
      const bitir = (sonuc) => {
        if (bitti) return;
        bitti = true;
        rl.close();
        coz(sonuc);
      };
      cikti.write(soru);
      rl.on("line", (satir) => {
        const y = satir.trim().toLowerCase();
        if (y === "devam") bitir("devam");
        else if (y === "iptal") bitir("iptal");
        else cikti.write('  "devam" ya da "iptal" yazın: ');
      });
      rl.on("close", () => bitir("kapandi"));
    });
}

/** Gerçek yönetim istemcisi: yalnızca kapılardan ve anahtar okunduktan sonra kurulur. */
async function gercekAdmin(url, anahtar) {
  const { createClient } = await import("@supabase/supabase-js");
  const c = createClient(url, anahtar, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    generateLink: (p) => c.auth.admin.generateLink(p),
    getUserById: (id) => c.auth.admin.getUserById(id),
    deleteUser: (id) => c.auth.admin.deleteUser(id, false),
    listUsers: (p) => c.auth.admin.listUsers(p),
  };
}

/* ---------------- İşlemler ---------------- */

async function kullaniciOku(admin, kayit) {
  if (!kayit) throw new Dur("Kayıt defteri yok: bu betiğin oluşturduğu bir kullanıcı yok, işlem yapılmaz.");
  if (kayit.durum !== "olusturuldu") throw new Dur(`Kayıt defteri "${kayit.durum}" durumunda; önce \`uzlastir\`.`);
  const { data, error } = await admin.getUserById(kayit.userId);
  if (error) throw new Dur(`Kullanıcı okunamadı (${guvenliHata(error)}).`, 1);
  return hedefKullaniciDenetle(kayit, data?.user);
}

const kullaniciYok = (hata) => Boolean(hata) && (hata.code === "user_not_found" || hata.status === 404);

/*
  U2 bekleme sınırı. GoTrue'nun e-posta bağlantısı geçerlilik süresi bu
  projede doğrulanmadı (varsayılan genelde 1 saat). Daha uzun beklenirse
  bağlantı AÇILMAZ ve yenisi ÜRETİLMEZ: yeni generateLink(signup) bilinen
  şifreyi değiştirip testi geçersiz kılabilir. Doğrusu temizleyip baştan
  başlamaktır.
*/
export const U2_BEKLEME_SINIRI_MS = 45 * 60 * 1000;

async function olustur(admin, b) {
  if (kayitOku(b.kayitYolu, b.imza)) throw new Dur("Kayıt defteri zaten var; önce `uzlastir` ya da `temizle` (yarım kalan bir koşu olabilir).");
  const rol = b.rol;
  const eposta = sentetikEposta(rol, b.simdi);
  const korunanOzetler = await korunanOzetleriTopla(admin);
  // 1) NİYET: kullanıcı oluşturulmadan önce. Bu yazılamazsa hiçbir şey oluşturulmaz.
  let kayit = kayitYaz(b.kayitYolu, { surum: 2, proje: TEST_REF, durum: "olusturuluyor", eposta, niyetZamani: b.simdi.toISOString(), userId: null, olusturuldu: null, korunanOzetler }, b.imza);
  // 2) Oluşturma. Bundan sonraki her hata defteri "olusturuluyor" bırakır; `uzlastir` çözer.
  let yanit;
  try {
    yanit = await admin.generateLink({
      type: "signup",
      email: eposta,
      // U1: uygulamanın kayıt işlemiyle aynı, kimsenin bilmediği şifre. U2 (G1-B): test edenin BİLDİĞİ şifre;
      // amaç onayın bu şifreyi sildiğini görmek. Her iki durumda da onayda veritabanı siler.
      password: rol === "u2" ? b.u2Sifre : `${randomBytes(32).toString("base64url")}aA1!`,
      options: { data: { full_name: SENTETIK_AD, kvkk_onay_at: b.simdi.toISOString(), test_hesabi: true, g1_86: true, g1_86_rol: rol } },
    });
  } catch (e) {
    throw new Dur(`Oluşturma yanıtı alınamadı (${guvenliHata(e)}); kullanıcı oluşmuş olabilir. \`uzlastir\` çalıştırın.`, 1);
  }
  const { data, error } = yanit ?? {};
  if (error) throw new Dur(`Kullanıcı oluşturulamadı (${guvenliHata(error)}); \`uzlastir\` ile doğrulayın.`, 1);
  const neden = niyetleEslesir(data?.user, kayit);
  if (neden) throw new Dur(`Oluşturma yanıtı doğrulanamadı (${neden}); bağlantı açılmadı. \`uzlastir\` çalıştırın.`, 1);
  // 3) Kimliği deftere bağla, ANCAK ondan sonra bağlantıyı aç.
  kayit = kayitYaz(b.kayitYolu, { ...kayit, durum: "olusturuldu", userId: data.user.id, olusturuldu: data.user.created_at }, b.imza);
  const ROL = rol.toUpperCase();
  b.cikti(`✓ ${ROL} oluşturuldu: ${kayit.userId} (${eposta}); kayıt defteri: ${b.kayitYolu}`);
  // Bağlantı ŞİMDİ kurulur ve yalnızca bellekte tutulur; yazdırılmaz, diske yazılmaz.
  const baglanti = baglantiKur(b.kok, data?.properties?.hashed_token, "signup");
  if (rol === "u2") {
    const baslangic = b.saat();
    b.cikti("");
    b.cikti("  Bağlantı henüz AÇILMADI. Onaydan ÖNCE iki kontrol:");
    b.cikti("  B0 — Salt okunur SQL (Test projesi, SQL Editor); beklenen: onayli = false, sifre_yok = false");
    b.cikti(`    select email_confirmed_at is not null as onayli, encrypted_password is null or encrypted_password = '' as sifre_yok from auth.users where id = '${kayit.userId}';`);
    b.cikti(`  B1 — Karşıt giriş denemesi (uygulamanın giriş sayfası, ${eposta}):`);
    b.cikti('    B1a YANLIŞ bir şifreyle → beklenen "E-posta adresi veya şifre hatalı." (?error=invalid-credentials)');
    b.cikti('    B1b U2 test şifresiyle  → beklenen "E-posta adresiniz henüz doğrulanmadı." (?error=email-not-confirmed)');
    b.cikti("    Kanıt: B1a ile B1b FARKLI olmalı; aynıysa B1 kanıt sayılmaz.");
    b.cikti('  B0 ya da B1 tutmazsa "devam" YAZMAYIN: "iptal" yazın → test BLOCKED, sonra `temizle --calistir`.');
    const yanit = await b.bekle('  Sonra buraya "devam" (bağlantıyı aç) ya da "iptal" yazın: ');
    if (yanit !== "devam") {
      throw new Dur(`Bağlantı açılmadı (${yanit === "iptal" ? "iptal edildi" : "giriş kapandı"}). U2 kayıt defterinde; silmek için \`temizle --calistir\`.`, 1);
    }
    if (b.saat() - baslangic > U2_BEKLEME_SINIRI_MS) {
      throw new Dur("Bekleme sınırı aşıldı; bağlantının süresi dolmuş olabilir. Yeni bağlantı ÜRETİLMEDİ (şifre değişebilirdi). `temizle --calistir` ile silip baştan başlayın.", 1);
    }
  }
  await b.ac(baglanti);
  b.cikti("✓ Kayıt doğrulama bağlantısı tarayıcıda açıldı (yazdırılmadı).");
  if (rol === "u2") {
    b.cikti("  B2: ilk şifre ekranı açılmalı. ŞİFRE BELİRLEMEYİN ve sözleşme KABUL ETMEYİN; \"Çıkış yap\" düğmesini kullanın.");
    b.cikti('  B3: gizli bir pencerede aynı şifreyle giriş deneyin; beklenen "E-posta adresi veya şifre hatalı." (?error=invalid-credentials).');
  }
}

/**
 * Yarım kalan oluşturmayı çözer. HİÇBİR ŞEY SİLMEZ ve hiçbir bağlantı açmaz.
 * Niyetteki e-postayla (dakika damgalı, tek) projedeki kullanıcılar aranır:
 *   - eşleşen yok         → kullanıcı oluşmamış; defter "olusmadi" olarak arşivlenir
 *   - tek ve kanıtlı      → kimlik deftere bağlanır ("olusturuldu"); temizlik `temizle` ile
 *   - başka her durum     → belirsiz: defter olduğu gibi kalır, elle inceleme
 */
async function uzlastir(admin, b) {
  const kayit = kayitOku(b.kayitYolu, b.imza);
  if (!kayit) throw new Dur("Kayıt defteri yok; uzlaştırılacak bir şey yok.");
  if (kayit.durum !== "olusturuluyor") throw new Dur(`Kayıt defteri "${kayit.durum}" durumunda; uzlaştırma gerekmiyor.`);
  const eslesenler = [];
  for (let sayfa = 1; sayfa <= 100; sayfa++) {
    const { data, error } = await admin.listUsers({ page: sayfa, perPage: 1000 });
    if (error) throw new Dur(`Kullanıcı listesi okunamadı (${guvenliHata(error)}); defter değişmedi.`, 1);
    const kullanicilar = data?.users;
    if (!Array.isArray(kullanicilar)) throw new Dur("Kullanıcı listesi beklenen biçimde değil; defter değişmedi.", 1);
    for (const k of kullanicilar) if (String(k?.email ?? "").toLowerCase() === kayit.eposta) eslesenler.push(k);
    if (kullanicilar.length < 1000) break;
    if (sayfa === 100) throw new Dur("Kullanıcı listesi beklenenden uzun; defter değişmedi.", 1);
  }
  if (eslesenler.length === 0) {
    kayitYaz(b.kayitYolu, { ...kayit, durum: "olusmadi" }, b.imza);
    fs.renameSync(b.kayitYolu, `${b.kayitYolu}.olusmadi-${b.simdi.getTime()}`);
    b.cikti("✓ Niyetteki kullanıcı oluşmamış; kayıt defteri arşivlendi. Yeniden `olustur` çalıştırılabilir.");
    return;
  }
  const neden = eslesenler.length > 1 ? "aynı e-postayla birden çok kullanıcı" : niyetleEslesir(eslesenler[0], kayit);
  if (neden) {
    throw new Dur(`Belirsiz durum (${neden}); hiçbir şey silinmedi ve defter değişmedi. Elle inceleme: betiğin başındaki KURTARMA PROSEDÜRÜ.`, 1);
  }
  const k = eslesenler[0];
  kayitYaz(b.kayitYolu, { ...kayit, durum: "olusturuldu", userId: k.id, olusturuldu: k.created_at }, b.imza);
  b.cikti(`✓ Yarım kalan oluşturma uzlaştırıldı: U1 ${k.id} deftere bağlandı. Silmek için \`temizle\`.`);
}

async function yeniBaglanti(admin, b, tur) {
  const kayit = kayitOku(b.kayitYolu, b.imza);
  const kullanici = await kullaniciOku(admin, kayit);
  const onayli = Boolean(kullanici.email_confirmed_at);
  if (tur === "signup" && epostaRolu(kayit.eposta) === "u2") {
    throw new Dur("U2 için yeni kayıt bağlantısı üretilmez: generateLink(signup) bilinen test şifresini değiştirebilir ve G1-B'yi geçersiz kılar. `temizle --calistir` ile silip baştan başlayın.");
  }
  if (tur === "signup" && onayli) throw new Dur("U1 zaten onaylı; kayıt bağlantısı üretilmez (kurtarma için `kurtarma`).");
  if (tur === "recovery" && !onayli) throw new Dur("U1 onaysız; kurtarma bağlantısı üretilmez (önce `dogrulama`).");
  const parametre = tur === "signup" ? { type: "signup", email: kayit.eposta, password: `${randomBytes(32).toString("base64url")}aA1!` } : { type: "recovery", email: kayit.eposta };
  const { data, error } = await admin.generateLink(parametre);
  if (error) throw new Dur(`Bağlantı üretilemedi (${guvenliHata(error)}).`, 1);
  if (data?.user?.id !== kayit.userId) throw new Dur("Bağlantının kullanıcısı U1 olarak doğrulanamadı; açılmadı.", 1);
  await b.ac(baglantiKur(b.kok, data?.properties?.hashed_token, tur));
  b.cikti(`✓ ${tur === "signup" ? "Kayıt doğrulama" : "Kurtarma"} bağlantısı tarayıcıda açıldı (yazdırılmadı).`);
}

async function durum(admin, b) {
  const kayit = kayitOku(b.kayitYolu, b.imza);
  const k = await kullaniciOku(admin, kayit);
  b.cikti(`${(epostaRolu(k.email) ?? "u1").toUpperCase()} ${k.id}`);
  b.cikti(`  onaylı           : ${k.email_confirmed_at ? `evet (${k.email_confirmed_at})` : "hayır"}`);
  b.cikti(`  son giriş        : ${k.last_sign_in_at ?? "yok"}`);
  b.cikti("  şifre durumu     : yönetim API'si göstermiyor. Salt okunur SQL (Test projesi, SQL Editor):");
  b.cikti(`    select id, email_confirmed_at is not null as onayli, encrypted_password is null or encrypted_password = '' as sifre_yok from auth.users where id = '${k.id}';`);
}

function arsivle(b, kayit, sonek) {
  // Önce "silindi" olarak imzalanır, sonra arşive taşınır: bu kopya geri konsa da hiçbir işlem kabul etmez.
  kayitYaz(b.kayitYolu, { ...kayit, durum: "silindi" }, b.imza);
  fs.renameSync(b.kayitYolu, `${b.kayitYolu}.${sonek}-${b.simdi.getTime()}`);
}

async function temizle(admin, b) {
  const kayit = kayitOku(b.kayitYolu, b.imza);
  if (!kayit) throw new Dur("Kayıt defteri yok: bu betiğin oluşturduğu bir kullanıcı yok, işlem yapılmaz.");
  if (kayit.durum !== "olusturuldu") throw new Dur(`Kayıt defteri "${kayit.durum}" durumunda; silme yalnızca "olusturuldu" durumunda (yarım kalan koşu için önce \`uzlastir\`).`);
  const { data: once, error: onceHata } = await admin.getUserById(kayit.userId);
  if (kullaniciYok(onceHata)) {
    // Önceki bir silme yanıtı kaybolmuş olabilir: silme ÇAĞRILMAZ, yalnızca defter kapanır.
    arsivle(b, kayit, "zaten-yoktu");
    b.cikti(`✓ U1 ${kayit.userId} zaten yok (silme çağrılmadı); kayıt defteri arşivlendi.`);
    return;
  }
  if (onceHata) throw new Dur(`Kullanıcı okunamadı (${guvenliHata(onceHata)}); hiçbir şey silinmedi.`, 1);
  const k = hedefKullaniciDenetle(kayit, once?.user);
  const { error } = await admin.deleteUser(k.id);
  if (error) throw new Dur(`Silme yanıtı hata döndü (${guvenliHata(error)}); kayıt defteri korunuyor (\`temizle\` tekrar güvenli).`, 1);
  const { data: sonra, error: okumaHatasi } = await admin.getUserById(k.id);
  // Yalnızca "kullanıcı yok" cevabı silindi sayılır; ağ hatası gibi belirsiz bir sonuçta kayıt defteri korunur.
  if (!kullaniciYok(okumaHatasi) || sonra?.user) throw new Dur("Silme doğrulanamadı; kayıt defteri korunuyor (`temizle` tekrar güvenli).", 1);
  arsivle(b, kayit, "silindi");
  b.cikti(`✓ ${(epostaRolu(k.email) ?? "u1").toUpperCase()} silindi: ${k.id}. Kayıt defteri arşivlendi.`);
  b.cikti("  Kalanlar (bu betiğin kapsamı dışında): auth_rate_limits satırları, Supabase Auth denetim günlükleri.");
}

function planYaz(a, b, url) {
  const kayit = (() => {
    try {
      return kayitOku(b.kayitYolu, null);
    } catch {
      return "okunamadı";
    }
  })();
  b.cikti("KURU KİP — ağ isteği yok, anahtar okunmadı, kullanıcı oluşturulmadı, bağlantı üretilmedi, tarayıcı açılmadı.");
  b.cikti(`  Hedef Supabase   : ${url} (Test, ${TEST_REF})`);
  b.cikti(`  Bağlantı kökü    : ${a.kok}`);
  b.cikti(`  İşlem            : ${a.islem}`);
  b.cikti(`  Kayıt defteri    : ${b.kayitYolu} (${kayit === null ? "yok" : kayit === "okunamadı" ? "okunamadı" : `durum ${kayit.durum}${kayit.userId ? `, U1 ${kayit.userId}` : ""}; imza kuru kipte doğrulanmaz`})`);
  if (a.islem === "olustur" || a.islem === "plan") {
    b.cikti(`  Oluşturulacak    : ${sentetikEposta(a.rol, b.simdi)} (1 kullanıcı, generateLink signup${a.rol === "u2" ? ", bilinen test şifresiyle; bağlantı \"devam\" yazılınca açılır" : ""})`);
    if (a.rol === "u2") b.cikti("  U2 şifresi       : kuru kipte okunmaz (G1_86_U2_SIFRE yalnızca --calistir ile)");
  }
  b.cikti("  Gerçek koşu için : işlem + --calistir (ayrıca onaylandıktan sonra).");
}

/**
 * Giriş noktası. Bütün yan etkiler parametreyle verilir; testler sahtesini
 * geçer. Dönen değer çıkış kodudur.
 */
export async function calistir(argv, secenek = {}) {
  const env = secenek.env ?? process.env;
  const cikti = secenek.cikti ?? ((m) => console.log(m));
  const hataCikti = secenek.hataCikti ?? ((m) => console.error(m));
  const adminFabrikasi = secenek.adminFabrikasi ?? gercekAdmin;
  const simdi = secenek.simdi ?? new Date();
  try {
    const a = argumanlariCoz(argv);
    const url = hedefDenetle(env);
    const b = {
      cikti,
      simdi,
      kok: a.kok,
      rol: a.rol,
      kayitYolu: secenek.kayitYolu ?? varsayilanKayitYolu(env),
      ac: secenek.ac ?? ((l) => baglantiyiAc(l)),
      bekle: secenek.bekle ?? devamBekleKur(),
      saat: secenek.saat ?? (() => Date.now()),
    };
    if (!a.calistir) {
      planYaz(a, b, url);
      return 0;
    }
    let anahtar;
    try {
      anahtar = anahtarOku(env);
    } finally {
      /*
        Ö1: anahtar okunduktan sonra (geçersiz olsa da) ortamdan silinir; bu
        süreçten başlayan hiçbir alt süreç onu devralamaz. Yönetim istemcisi
        anahtarı kendi belleğinde tutar, silme onu etkilemez.
      */
      delete env.SUPABASE_SECRET_KEY;
    }
    b.imza = imzaAnahtari(anahtar);
    if (a.islem === "olustur" && a.rol === "u2") b.u2Sifre = u2SifresiOku(env, anahtar);
    else delete env.G1_86_U2_SIFRE; // U2 dışında hiç okunmaz; yine de alt süreçlere kalmasın.
    const admin = await adminFabrikasi(url, anahtar);
    if (a.islem === "olustur") await olustur(admin, b);
    else if (a.islem === "uzlastir") await uzlastir(admin, b);
    else if (a.islem === "dogrulama") await yeniBaglanti(admin, b, "signup");
    else if (a.islem === "kurtarma") await yeniBaglanti(admin, b, "recovery");
    else if (a.islem === "durum") await durum(admin, b);
    else if (a.islem === "temizle") await temizle(admin, b);
    return 0;
  } catch (e) {
    if (e instanceof Dur) {
      hataCikti(`✗ Durduruldu: ${e.message}`);
      return e.cikis;
    }
    // Beklenmeyen hata: ayrıntı (mesaj, yığın) yazılmaz, içinde yanıt gövdesi olabilir.
    hataCikti(`✗ Beklenmeyen hata; güvenli durduruldu (${guvenliHata(e)}).`);
    return 1;
  }
}

/*
  DOĞRUDAN ÇALIŞTIRMA (Ö2, 11.11.2026). Eskiden `import.meta.url` ile
  `pathToFileURL(path.resolve(argv[1]))` birebir karşılaştırılıyordu.
  Windows'ta sürücü harfi (C: / c:), ayraç (\ / /) ya da kısa/uzun yol
  farkı karşılaştırmayı bozar ve betik HİÇBİR ŞEY YAPMADAN çıkış 0 verirdi.
  Artık iki yol da gerçek yola çevrilir; Windows'ta büyük/küçük harf ve
  ayraç farkı yok sayılır. Dosya adı bu betik olduğu hâlde yol
  eşleşmiyorsa sessizce geçilmez: hata yazılır, çıkış 2.
*/
const BETIK_ADI = "g1-86-baglanti.mjs";

function gercekYol(y, platform, realpath) {
  try {
    return realpath(y);
  } catch {
    return platform === "win32" ? path.win32.resolve(y) : path.posix.resolve(y);
  }
}

/** "ana" (doğrudan çalıştırıldı), "baska" (içe aktarıldı), "belirsiz" (adı bu betik ama yol eşleşmiyor). */
export function dogrudanCalistirildiMi(metaUrl, argv1, { platform = process.platform, realpath = fs.realpathSync.native } = {}) {
  if (typeof argv1 !== "string" || !argv1) return "baska";
  const yolu = platform === "win32" ? path.win32 : path.posix;
  const normal = (y) => {
    const n = yolu.normalize(gercekYol(y, platform, realpath));
    return platform === "win32" ? n.replace(/\//g, "\\").toLowerCase() : n;
  };
  let modul;
  try {
    modul = fileURLToPath(metaUrl, { windows: platform === "win32" });
  } catch {
    return "belirsiz";
  }
  if (normal(modul) === normal(yolu.resolve(argv1))) return "ana";
  const ad = yolu.basename(argv1);
  return (platform === "win32" ? ad.toLowerCase() === BETIK_ADI : ad === BETIK_ADI) ? "belirsiz" : "baska";
}

const baslangic = dogrudanCalistirildiMi(import.meta.url, process.argv[1]);
if (baslangic === "ana") {
  process.exitCode = await calistir(process.argv.slice(2));
} else if (baslangic === "belirsiz") {
  console.error("✗ Durduruldu: betik doğrudan çalıştırılmış görünüyor ama yolu doğrulanamadı; hiçbir işlem yapılmadı. Betiği depo kökünden göreli yolla çalıştırın.");
  process.exitCode = 2;
}
