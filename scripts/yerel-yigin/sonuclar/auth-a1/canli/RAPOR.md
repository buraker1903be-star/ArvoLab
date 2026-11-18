# Auth A1 — Production yayını ve canlı kabul (18.11.2026)

**Sonuç: GEÇTİ.** Auth A1 kapandı.

## Yayın

| Adım | Zaman (UTC) | Kanıt |
|---|---|---|
| PR #109 birleştirme öncesi denetim | 11:06 | HEAD `637ada4e9bb6447864fda18a6feefb884e433cfb`, `kontrol` ×2 success, mergeable clean |
| Squash birleştirme | 11:06 | `main` = `a076d9d5222fc24e4c97e312520388ccf40b0e5a` |
| Otomatik Production dağıtımı | 11:06:49 oluştu → 11:07:15 READY | `dpl_GLoSgdGXu7rYtRBuG2FcPeotqFd9`, kaynak `git`, SHA `a076d9d`, alias `lab.arvo-os.com`. **Kendiliğinden tetiklendi; elle dağıtım gerekmedi.** (Önceki yayında ce23df7 için tetiklenmemişti; bkz. rc06o-kabul `VERCEL-OTOMATIK-DAGITIM.md`.) |
| Yeni kodun canlıda olduğu (ayar kapalı) | 11:08–11:13 | Hesap A: ilk şifre sayfası "8–64" (eski kod "12–64"), Ayarlar "Şifre 8–64 karakter. Değiştirmek için mevcut şifreniz gerekir…" |
| "Require current password when updating" açıldı | ~11:14 | Ürün sahibi panelden açtı. Minimum uzunluk 8 kaldı; başka Auth ayarı değişmedi |
| Canlı kabul (ayar açık) | 11:15–11:19 | Aşağıda |

Diğer ayarların değişmediği, herkese açık `/auth/v1/settings` ile kontrol edildi: e-posta açık, `mailer_autoconfirm` false, `disable_signup` false; GoTrue v2.198.0. En kısa şifrenin 8 kaldığı API-3 ile görüldü.

## Canlı kabul (lab.arvo-os.com, ayar açık)

Yalnızca sentetik hesaplar: `delivered+arvolab-a1-a-56d737@resend.dev` (A) ve `delivered+arvolab-a1-b-565fbb@resend.dev` (B). Bu adresler Resend'in test alıcısı; gerçek kişiye posta gitmedi. Onay ve kurtarma bağlantıları, e-postadakiyle aynı biçimde, hesabın `confirmation_token` / `recovery_token` değerinden kuruldu (salt okunur sorgu). AI çağrısı yok. Mevcut hesaplara dokunulmadı.

| # | Senaryo | Beklenen | Gözlenen | |
|---|---|---|---|---|
| API-1 | Mevcut şifre olmadan `PUT /auth/v1/user` | 400 `current_password_required`, eski şifre geçerli | aynı | PASS |
| API-2 | Yanlış mevcut şifreyle | 400 `current_password_invalid`, eski şifre geçerli | aynı | PASS |
| API-3 | 7 karakter | 422 `weak_password` | aynı | PASS |
| API-4 | Reddedilen denemeler öteki oturumu kapatmaz | yenileme 200 | 200 | PASS |
| AYARLAR | Ayarlar'da doğru mevcut şifreyle değişiklik (uygulama `current_password` gönderiyor) | yeni şifre 200, eski geçersiz | aynı | PASS |
| AYARLAR-OTEKI | Değişiklikten sonra başka cihaz oturumu | yenileme 400 | 400 | PASS |
| ILK (B) | Kayıt → onay bağlantısı → ilk şifre (mevcut şifre yok) | `/reset-password?ilk=1`, "8–64", panel, giriş 200 | aynı | PASS |
| KURTARMA (A) | Şifremi unuttum → bağlantı → yeni şifre | `/reset-password` → panel, yeni 200, eski geçersiz | aynı | PASS |
| KURTARMA-OTEKI | Kurtarmadan sonra önceki oturum | yenileme 400 | 400 | PASS |
| GIRIS (A, B) | Son şifreyle tarayıcıdan yeniden giriş | `/dashboard/settings` | aynı | PASS |
| Sayfa hatası | Her fazda | 0 | 0 | PASS |

Ham sonuçlar `sonuclar.jsonl`'de. İçindeki iki FAIL satırı ayar açılmadan önceki kod doğrulamasında çıkan **düzenek** hatalarıdır, ürün sonucu değil:
1. `ILK` (A, 11:08): betiğin Node `fetch`'i oturumun HTTPS vekilini kullanmıyordu (`NODE_USE_ENV_PROXY` gerekiyordu). Tarayıcı adımı tamamlanmıştı; aynı şifreyle giriş vekil düzeltildikten sonra 200 döndü (`ILK-SIFRE` satırı).
2. `KOD-AYARLAR` (A): sayfa metin yüklenmeden okundu. Beklemeli tekrarında PASS; elle bakışta metin "Şifre 8–64 karakter" idi.

## Geri dönüş

Ayar açıkken eski koda (`ce23df7`) dönülürse Ayarlar'dan şifre değiştirme çalışmaz (yerel üretim derlemesinde ölçüldü: `../uretim/kimlik-taban-acik.json`, K4/K5). Dönüş gerekirse önce ayar kapatılır, sonra kod geri alınır.

## Production'da kalan test verisi

İki sentetik hesap (A, B) Production'da duruyor. Silmek istenirse panelden.

Betik: `canli-a1.mjs.txt` (şifre, belirteç ve bağlantı çıktıya yazılmaz; yayımlanabilir anahtar ayrı bir yerel dosyadan okunur ve burada yok).
