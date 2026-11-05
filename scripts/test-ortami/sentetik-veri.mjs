#!/usr/bin/env node
/*
  TEST SUPABASE PROJESİ — SENTETİK VERİ (Güvenli Test Ortamı, Aşama 1).
  BU BETİK HENÜZ ÇALIŞTIRILMADI; çalıştırma kararı ve ortamı sizde.

  Tek tip kullanıcı modeline göre test hesapları ve verileri. Üretim
  verisi KOPYALANMAZ; her şey uydurma ve "test" işaretli.

  ÜRETİME YAZMAYI ÜÇ AYRI KAPI ENGELLER (biri yeterli, üçü birden aranır):
    1. Adresteki proje kimliği ARVOLAB_TEST_SUPABASE_REF olmalı ve
       ARVOLAB_URETIM_SUPABASE_REF olmamalı (betikHedefKarari, tur
       "sentetik-veri": üretimde hiçbir bayrakla açılmaz).
    2. Sunucu anahtarı JWT biçimindeyse adresteki projeye ait olmalı.
    3. Veritabanında ortam işareti: public.arvolab_test_ortami() "test"
       dönmeli. Bu fonksiyonu yalnızca kur.mjs TEST projesinde oluşturur;
       üretimde yok — etiketler yanlış girilse de betik durur.

  Hesaplar (e-posta: arvolab-test-*@example.com, user_metadata.test_hesabi = true):
    A  aktif abonelik, kredisi var; iki çalışma (tez + makale), farklı kaynak setleri
    B  denemede; tek çalışma; A ile aynı başlıklı bir kaynak (yalıtım sınaması)
    C  aboneliği bitmiş (abonelik kapısı)
    D  aktif ama AI kredisi sıfır (kredi kapısı)
    Y  system_admin (yönetim alanının kullanıcı deneyiminden ayrılığı)

  Ortam (TEST projesinin değerleri; yalnızca kendi terminalinizde):
    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
    ARVOLAB_TEST_SUPABASE_REF, ARVOLAB_URETIM_SUPABASE_REF,
    TEST_HESAP_PAROLASI (en az 12 karakter; betik yazdırmaz).
  Yeniden çalıştırılabilir: var olan hesap ve kayıt yeniden açılmaz.

  Kullanım:  node scripts/test-ortami/sentetik-veri.mjs
*/
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { anahtarUyusmazligi, betikHedefKarari, projeKimligi } from "../../lib/supabase/ortam-guvenligi.ts";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

function durdur(mesaj) {
  console.error(`✗ Sentetik veri durduruldu: ${mesaj}`);
  process.exit(1);
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANAHTAR = process.env.SUPABASE_SECRET_KEY;
const PAROLA = process.env.TEST_HESAP_PAROLASI ?? "";

// Kapı 1: proje kimliği
const karar = betikHedefKarari({
  tur: "sentetik-veri",
  hedefRef: projeKimligi(URL_),
  uretimRef: process.env.ARVOLAB_URETIM_SUPABASE_REF,
  testRef: process.env.ARVOLAB_TEST_SUPABASE_REF,
});
if (karar.tur !== "izin") durdur(karar.mesaj);
// Kapı 2: anahtarın projesi
if (!ANAHTAR) durdur("SUPABASE_SECRET_KEY tanımlı değil.");
const uyusmazlik = anahtarUyusmazligi(URL_, ANAHTAR);
if (uyusmazlik) durdur(uyusmazlik);
if (PAROLA.length < 12) durdur("TEST_HESAP_PAROLASI en az 12 karakter olmalı.");

const db = createClient(URL_, ANAHTAR, { auth: { persistSession: false, autoRefreshToken: false } });

// Kapı 3: veritabanındaki ortam işareti
const isaret = await db.rpc("arvolab_test_ortami");
if (isaret.error || isaret.data !== "test") durdur("Ortam işareti bulunamadı (public.arvolab_test_ortami). Bu bir test projesi değil ya da kur.mjs çalıştırılmadı.");
console.log(`✓ Test projesi doğrulandı (${projeKimligi(URL_)}).`);

const gun = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
const beklet = (s, ne) => {
  if (s.error) durdur(`${ne}: ${s.error.message}`);
  return s.data;
};

async function hesap(kisa, adSoyad) {
  const eposta = `arvolab-test-${kisa}@example.com`;
  // Var mı? (sayfa sayfa; test projesinde az hesap var)
  for (let sayfa = 1; sayfa < 20; sayfa++) {
    const liste = beklet(await db.auth.admin.listUsers({ page: sayfa, perPage: 200 }), "hesap listesi");
    const var_ = liste.users.find((u) => u.email === eposta);
    if (var_) return var_.id;
    if (liste.users.length < 200) break;
  }
  const yeni = beklet(
    await db.auth.admin.createUser({ email: eposta, password: PAROLA, email_confirm: true, user_metadata: { full_name: adSoyad, test_hesabi: true } }),
    `hesap ${kisa}`,
  );
  console.log(`  + hesap ${kisa} (${eposta})`);
  return yeni.user.id;
}

const A = await hesap("a", "Test Kullanıcı A");
const B = await hesap("b", "Test Kullanıcı B");
const C = await hesap("c", "Test Kullanıcı C");
const D = await hesap("d", "Test Kullanıcı D");
const Y = await hesap("yonetici", "Test Yönetici");

// Yönetici rolü (servis rolü; rol yükseltme koruması oturumsuz yazmaya izin verir).
beklet(await db.from("profiles").update({ role: "system_admin" }).eq("id", Y), "yönetici rolü");

// Abonelik aynası ve AI kredisi (ArvoOS köprüsü test ortamında yok; aynayı betik yazar).
beklet(
  await db.from("individual_subscriptions").upsert([
    { user_id: A, status: "active", current_period_end: gun(30) },
    { user_id: B, status: "trialing", trial_ends_at: gun(3) },
    { user_id: C, status: "canceled", current_period_end: gun(-5) },
    { user_id: D, status: "active", current_period_end: gun(30) },
  ]),
  "abonelik aynası",
);
beklet(
  await db.from("ai_bireysel_kredi_hesabi").upsert([
    { user_id: A, aylik_kalan: 50_000, ek_bakiye: 0 },
    { user_id: D, aylik_kalan: 0, ek_bakiye: 0 },
  ]),
  "AI kredisi",
);

async function calisma(sahip, alanlar) {
  const var_ = beklet(await db.from("academic_projects").select("id").eq("owner_id", sahip).eq("title", alanlar.title).maybeSingle(), "çalışma okuma");
  if (var_) return var_.id;
  const yeni = beklet(
    await db.from("academic_projects").insert({ owner_id: sahip, citation_style: "apa7", priority: "normal", status: "writing", progress: 0, ...alanlar }).select("id").single(),
    `çalışma ${alanlar.title}`,
  );
  console.log(`  + çalışma: ${alanlar.title}`);
  return yeni.id;
}

const tezA = await calisma(A, { title: "[TEST] Türkiye'de enflasyon ve işsizlik", project_type: "thesis", university: "Örnek Üniversitesi", department: "Ekonometri" });
const makaleA = await calisma(A, { title: "[TEST] Uzaktan eğitimde öğrenci katılımı", project_type: "article", status: "new" });
const tezB = await calisma(B, { title: "[TEST] Kentsel dönüşüm ve konut fiyatları", project_type: "thesis", university: "Örnek Üniversitesi" });

// Müsvedde: depodaki örnek tez (tests/fixtures; uydurma içerik, kişisel veri yok).
const tez = JSON.parse(readFileSync(new URL("../../tests/fixtures/tez-enflasyon-issizlik.json", import.meta.url), "utf8"));
const varMi = beklet(await db.from("project_manuscripts").select("project_id").eq("project_id", tezA).maybeSingle(), "müsvedde okuma");
if (!varMi) {
  beklet(await db.from("project_manuscripts").insert({ project_id: tezA, content: tez, plain_text: "", word_count: 0, updated_by: A }), "müsvedde");
  console.log("  + müsvedde (A, tez) — kelime sayısı ilk kayıtta hesaplanır");
}

async function kaynaklar(sahip, proje, liste) {
  const mevcut = beklet(await db.from("literature_sources").select("title").eq("owner_id", sahip).eq("project_id", proje), "kaynak okuma");
  const varOlan = new Set(mevcut.map((k) => k.title));
  const yeni = liste.filter((k) => !varOlan.has(k.title)).map((k) => ({ owner_id: sahip, project_id: proje, source_type: "article", status: "to_review", notes: "[test verisi]", ...k }));
  if (yeni.length) {
    beklet(await db.from("literature_sources").insert(yeni), "kaynaklar");
    console.log(`  + ${yeni.length} kaynak`);
  }
}

await kaynaklar(A, tezA, [
  { title: "Türkiye'de Phillips eğrisinin istikrarı", authors: "Önder, A. Ö.", year: "2009", status: "used" },
  { title: "Bounds testing approaches to the analysis of level relationships", authors: "Pesaran, M. H., Shin, Y., & Smith, R. J.", year: "2001" },
  { title: "Tüketici Fiyat Endeksi", authors: "TÜİK.", year: "2026a" },
]);
await kaynaklar(A, makaleA, [
  { title: "Çevrim içi derslerde katılım", authors: "Kaya, C.", year: "2021" },
  { title: "Öğrenci bağlılığı ölçeği", authors: "Yılmaz, B.", year: "2019" },
]);
// B'nin A ile AYNI başlıklı kaynağı: kullanıcılar arası yalıtım sınaması.
await kaynaklar(B, tezB, [
  { title: "Türkiye'de Phillips eğrisinin istikrarı", authors: "Önder, A. Ö.", year: "2009" },
  { title: "Konut fiyat endeksleri", authors: "Türkiye Cumhuriyet Merkez Bankası (TCMB)", year: "2023" },
]);

console.log("✓ Sentetik veri hazır. Hesaplar: arvolab-test-{a,b,c,d,yonetici}@example.com (parola: TEST_HESAP_PAROLASI).");
