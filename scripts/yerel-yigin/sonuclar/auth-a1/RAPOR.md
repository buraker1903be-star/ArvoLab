# Auth A1 kabul kanıtları (18.11.2026)

Dal `duzeltme/auth-sifre-guvenligi`. Kod HEAD'i `26e0530` (uygulama); taban `ce23df7`
(`main`, bugünkü Production kodu). Hepsi yerel yığında: Postgres 17 + GoTrue **v2.198.0**
(Production'la aynı sürüm, en kısa şifre 8) + PostgREST. Gerçek Supabase projesine, e-posta
sağlayıcısına ya da AI'ya gidilmedi. Hesaplar sentetik (`@yerel.test`); şifreler betikte
üretilip yazılmadı; JSON'larda belirteç, şifre ya da e-posta adresi yok (taranarak doğrulandı).

"Ayar" = GoTrue'nun `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD`'ü
(Supabase panelinde "Require current password when updating"). **Kapalı = bugünkü Production.**

## Hangi ölçüm hangi derlemede

| Klasör | Derleme | Ne |
|---|---|---|
| `uretim/` | **Temiz üretim derlemesi** (`rm -rf .next && next build`, `next start`). HEAD BUILD_ID `nvqwjEKBHkf8LafYsBRle`, taban `t4JbLfJXo4_Nk9yjzCRu5`. Kimlik JSON'ları derleme kaydını (kip, dizin, git HEAD, BUILD_ID, GoTrue sürümü) kendisi taşır. | **Esas sonuç.** Taban ve HEAD × ayar kapalı/açık; aynı yığın, aynı betik (düzeltilmiş düzenek). |
| `gelistirme/` | `next dev` (Turbopack). Derleme kaydı yok (betiğin eski sürümü). | İlk tur. `kimlik-taban-acik-YANLIS-DIZIN.json` düzenek hatasıyla koştu, aşağıya bakın. |
| `siniflandirma/` | Taban üretim derlemesi; betiğin DÜZELTİLMEMİŞ sürümü. | K8a/K9 başarısızlığının sınıflandırması. |
| `gotrue-ilk-yoklama/` | Uygulama yok; ayrı bir GoTrue v2.198.0 kabı. | İlk API yoklaması (`A3` beklentisi o anda yanlış yazılmıştı: GoTrue'nun kodu `current_password_invalid`). |
| `sifre-api-*.json` | Uygulama yok (doğrudan Auth API); derlemeden bağımsız. | |

## Sonuçlar — üretim derlemesi (`uretim/`)

| Kabul | Ayar kapalı | Ayar açık |
|---|---|---|
| `sifre-api-kabul` (doğrudan Auth API) | 7/10 — A2, A3, C2 FAIL = **açık** | 10/10 |
| `kimlik-kabul` HEAD `26e0530` | **15/15** | **15/15** |
| `kimlik-kabul` taban `ce23df7` | 12/15 — K3, K7, K10 | 10/15 — K3, K4, K5, K7, K10 |

Tabanın düşenleri:
- **K3, K7, K10**: taban "en az **12** karakter" diyor, betik 8 bekliyor. Bu değişikliğin amacı; regresyon değil.
- **K4, K5 (yalnız ayar açık)**: taban `updateUser({ password })` gönderiyor, GoTrue
  `current_password_required` ile reddediyor; Ayarlar'da şifre değişmiyor. **Yayın sırası
  bundan: önce kod, sonra ayar.** HEAD iki durumda da geçiyor.

## K8a / K9 (hesap silme) — sınıflandırma: TEST DÜZENEĞİ

İlk turda (`gelistirme/kimlik-taban-acik-YANLIS-DIZIN.json`) tabanda K8a "eylem bulundu=false",
K9 "sınanamadı" yazdı. Neden: betik hesap silme işleminin kimliğini işlem bildiriminden
(`server-reference-manifest.json`) **koşturulduğu dizinden** okuyordu. Taban sunucusu
`/home/user/arvolab-a1-eski`'den çalışırken betik `/home/user/arvolab-a1`'den koşturuldu ve
HEAD derlemesinin kimliğini gönderdi. İşlem kimliği derlemeye özgü: `app/actions/hesap.ts`
iki sürümde aynı olduğu hâlde iki temiz üretim derlemesi farklı kimlik üretiyor
(`hesapSilmeTalebi`: HEAD `40365eaa…`, taban `40e27e22…`).

Kanıt (`siniflandirma/`): **aynı taban üretim sunucusu, aynı ayar (açık), aynı düzeltilmemiş betik**,
yalnızca koşturma dizini farklı:

| | Koşturma dizini | K8a | K9 |
|---|---|---|---|
| a | HEAD (`arvolab-a1`) | FAIL (eylem bulundu=false) | FAIL (sınanamadı) |
| b | taban (`arvolab-a1-taban`) | PASS | PASS (silme_talebi_at boş) |

Düzeltilmiş betikle `uretim/` matrisinde K8a/K9 taban ve HEAD'de, iki ayarda da PASS.
Uygulama regresyonu da önceden var olan bir ürün hatası da değil.

Düzenek düzeltmesi (`kimlik-kabul.mjs`, studyo-kabul'daki RC06e düzeninin aynısı):
`KIMLIK_DERLEME=uretim|gelistirme` zorunlu, bildirim `KIMLIK_UYGULAMA_DIZINI`'nden okunur,
üretimde `.next/BUILD_ID` sunucunun HTML'inde geçmezse koşu başlamaz (çıkış 2) — ilk turdaki
yanlış eşleşme artık "ÖN KOŞUL: sunucu … derlemesini çalıştırmıyor" ile duruyor (denendi).
K8a gözlenen değerine aday sayısı ve HTTP durumları eklendi.

## Diğer kontroller (HEAD `26e0530`)

tsc, lint, check:css, check:migrations, check:rakamlar, test:unit 2329/2329, test:editor 112/112,
test:db 350/350 yerelde geçti. GitHub Actions "Kontrol" #1074: **success**.
