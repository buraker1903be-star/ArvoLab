/*
  E-POSTA DOĞRULAMA KABUL TESTİ (05.11.2026).

  /auth/confirm ve /auth/dogrula'nın başarılı, geçersiz ve süresi dolmuş
  bağlantı hâllerini GERÇEK rotalarla sınar; Supabase'in yerinde önizleme
  sahte istemcisi durur (scripts/onizleme/sahte-istemci.ts, verifyOtp ve
  exchangeCodeForSession taklidi). Gerçek belirteç tüketilmez, gerçek
  kullanıcı açılmaz, e-posta gitmez: önizlemede RESEND_API_KEY yok ve
  ONIZLEME_OTURUM=yok iken hoş geldiniz postasının alıcısı da yok.

  CI'da DEĞİL: önizleme sunucusu ister.
    ARVOLAB_ONIZLEME=1 ONIZLEME_OTURUM=yok npx next dev -p 3123
    node scripts/onizleme/dogrulama-kabul.mjs [taban-adres]
  Bir senaryo düşerse çıkış kodu 1.

  Belirteç önekleri sahte istemcide anlam taşır:
    onizleme-gecerli…        → doğrulanır
    onizleme-suresi-dolmus…  → otp_expired
    başka her şey            → geçersiz
*/
const TABAN = process.argv[2] ?? "http://localhost:3123";
const HOST = new URL(TABAN).host;
const sonuclar = [];

async function senaryo(ad, govde) {
  try {
    await govde();
    sonuclar.push({ ad, tamam: true });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: hata instanceof Error ? hata.message : String(hata) });
  }
}
function esit(gercek, beklenen, ne) {
  if (gercek !== beklenen) throw new Error(`${ne}: beklenen ${JSON.stringify(beklenen)}, gelen ${JSON.stringify(gercek)}`);
}
const yer = (yanit) => {
  const konum = yanit.headers.get("location");
  if (!konum) return null;
  const u = new URL(konum, TABAN);
  return u.pathname + u.search;
};

/* Onay sayfasındaki düğmenin gönderdiği form; varsayılan aynı köken. */
async function onayla(alanlar, basliklar = { origin: TABAN, "sec-fetch-site": "same-origin" }) {
  return fetch(`${TABAN}/auth/confirm`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", host: HOST, ...basliklar },
    body: new URLSearchParams(alanlar),
  });
}

await senaryo("GET token_hash belirteci HARCAMAZ, onay sayfasına gönderir", async () => {
  const y = await fetch(`${TABAN}/auth/confirm?token_hash=onizleme-gecerli-1&type=signup&next=/dashboard`, { redirect: "manual" });
  esit(y.status >= 300 && y.status < 400, true, "yönlendirme");
  esit(yer(y), "/auth/dogrula?token_hash=onizleme-gecerli-1&type=signup&next=%2Fdashboard", "hedef");
});

await senaryo("onay sayfası: geçerli biçimde form var, kendiliğinden göndermiyor", async () => {
  const html = await (await fetch(`${TABAN}/auth/dogrula?token_hash=onizleme-gecerli-1&type=signup`)).text();
  esit(html.includes('action="/auth/confirm"'), true, "form");
  esit(html.includes("E-posta adresinizi doğrulayın"), true, "başlık");
  esit(/<script[^>]*>[^<]*\.submit\(\)/.test(html), false, "kendiliğinden gönderim");
});

await senaryo("onay sayfası: bozuk belirteç ya da bilinmeyen tür → 'Bağlantı geçersiz', form yok", async () => {
  for (const sorgu of ["token_hash=kisa&type=signup", "token_hash=onizleme-gecerli-1&type=bilinmeyen", ""]) {
    const html = await (await fetch(`${TABAN}/auth/dogrula?${sorgu}`)).text();
    esit(html.includes("Bağlantı geçersiz"), true, `başlık (${sorgu || "boş"})`);
    esit(html.includes('action="/auth/confirm"'), false, `form (${sorgu || "boş"})`);
  }
});

await senaryo("BAŞARILI: kayıt doğrulaması panele 303 ile gider", async () => {
  const y = await onayla({ token_hash: "onizleme-gecerli-1", type: "signup", next: "/dashboard" });
  esit(y.status, 303, "durum");
  esit(yer(y), "/dashboard", "hedef");
});

await senaryo("BAŞARILI: şifre sıfırlama yeni şifre sayfasına gider", async () => {
  const y = await onayla({ token_hash: "onizleme-gecerli-2", type: "recovery", next: "/reset-password" });
  esit(y.status, 303, "durum");
  esit(yer(y), "/reset-password", "hedef");
});

await senaryo("SÜRESİ DOLMUŞ kayıt bağlantısı: yeni doğrulama bağlantısına yönlendiren uyarı", async () => {
  const y = await onayla({ token_hash: "onizleme-suresi-dolmus-1", type: "signup", next: "/dashboard" });
  esit(y.status, 303, "durum");
  esit(yer(y), "/?error=signup-link-invalid", "hedef");
  const html = await (await fetch(`${TABAN}/?error=signup-link-invalid`)).text();
  esit(html.includes("Doğrulama bağlantınız geçersiz ya da süresi dolmuş"), true, "uyarı metni");
  esit(html.includes("Yeni bir doğrulama bağlantısı"), true, "yönlendirme");
  esit(html.includes('role="alert"'), true, "uyarı rolü");
});

await senaryo("SÜRESİ DOLMUŞ sıfırlama bağlantısı: yeni sıfırlama bağlantısına yönlendiren uyarı", async () => {
  const y = await onayla({ token_hash: "onizleme-suresi-dolmus-2", type: "recovery", next: "/reset-password" });
  esit(yer(y), "/?error=recovery-link-invalid", "hedef");
  const html = await (await fetch(`${TABAN}/?error=recovery-link-invalid`)).text();
  esit(html.includes("Şifre sıfırlama bağlantınız geçersiz ya da süresi dolmuş"), true, "uyarı metni");
});

await senaryo("tür tanınmıyorsa GENEL uyarı (davet, e-posta değişikliği): tür tahmin edilmez", async () => {
  for (const type of ["invite", "email_change", "magiclink"]) {
    esit(yer(await onayla({ token_hash: "onizleme-suresi-dolmus-3", type, next: "/dashboard" })), "/?error=link-invalid", type);
  }
  const html = await (await fetch(`${TABAN}/?error=link-invalid`)).text();
  esit(html.includes("Bağlantı geçersiz ya da süresi dolmuş"), true, "genel metin");
  esit(html.includes("şifre sıfırlama isteyin"), false, "genel metin sıfırlama demez");
});

await senaryo("GEÇERSİZ: tanınmayan belirteç türün uyarısına düşer", async () => {
  esit(yer(await onayla({ token_hash: "baska-bir-belirtec", type: "signup", next: "/dashboard" })), "/?error=signup-link-invalid", "kayıt");
  esit(yer(await onayla({ token_hash: "baska-bir-belirtec", type: "invite", next: "/dashboard" })), "/?error=link-invalid", "davet");
});

await senaryo("GEÇERSİZ: eksik alanlar doğrulamaya hiç gitmez", async () => {
  // Belirteç yoksa bağlantı bozuk, süresi dolmuş değil: tür bilinse de genel metin.
  esit(yer(await onayla({ token_hash: "", type: "signup" })), "/?error=link-invalid", "boş belirteç");
  esit(yer(await onayla({ token_hash: "onizleme-gecerli-3", type: "" })), "/?error=link-invalid", "boş tür");
});

await senaryo("başka kökenden POST reddedilir (giriş CSRF'i), geçerli belirteç olsa bile; uyarı genel", async () => {
  const y = await onayla({ token_hash: "onizleme-gecerli-4", type: "signup" }, { origin: "https://saldirgan.example", "sec-fetch-site": "cross-site" });
  esit(yer(y), "/?error=link-invalid", "hedef");
});

await senaryo("açık yönlendirme yok: next başka alana çözülemez", async () => {
  for (const next of ["//saldirgan.example", "/\\saldirgan.example", "https://saldirgan.example", "/dashboard//x"]) {
    esit(yer(await onayla({ token_hash: "onizleme-gecerli-5", type: "signup", next })), "/dashboard", next);
  }
});

await senaryo("PKCE ?code=: geçerli panele, geçersiz/eksik link-invalid'e", async () => {
  esit(yer(await fetch(`${TABAN}/auth/confirm?code=onizleme-gecerli-kod&next=/dashboard`, { redirect: "manual" })), "/dashboard", "geçerli");
  esit(yer(await fetch(`${TABAN}/auth/confirm?code=bozuk`, { redirect: "manual" })), "/?error=link-invalid", "geçersiz");
  /* Supabase süresi dolmuş PKCE bağlantısını ?error=…&error_code=otp_expired ile döndürür; kod yok. */
  esit(yer(await fetch(`${TABAN}/auth/confirm?error=access_denied&error_code=otp_expired`, { redirect: "manual" })), "/?error=link-invalid", "Supabase hata dönüşü");
});

for (const s of sonuclar) console.log(`${s.tamam ? "✓" : "✗"} ${s.ad}${s.tamam ? "" : `\n    ${s.neden}`}`);
const dusen = sonuclar.filter((s) => !s.tamam).length;
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} senaryo geçti.`);
process.exit(dusen ? 1 : 0);
