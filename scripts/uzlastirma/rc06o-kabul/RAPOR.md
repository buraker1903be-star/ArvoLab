# RC06o entegrasyon kabulü — aday `a08b61d5c7404f305b2e4c4a8e8dedd8e2b056f7`

PR #107 (`design/premium-workspace`) `design/os5`'e birleştirildikten sonraki
aday. Tarih: 18.11.2026. Uygulama kodu bu dalda DEĞİŞMEDİ; yalnızca rapor,
kanıt ve test düzeneği betikleri eklendi.

**Özet: 125 PASS · 0 FAIL · 2 UNVERIFIED** (aşağıda ayrı ayrı).

Kapsam dışı ve dokunulmayanlar: `main` (b62bfcf, değişmedi), Production,
paylaşılan Test, PR #96, ArvoOS. Onay K, P9, Auth A1 ve hak iadesi kararları
UYGULANMADI. Gerçek AI çağrısı YAPILMADI: sunucu yalnızca yerel taklit modele
(`127.0.0.1:54900`, `AI_MODEL=taklit`) bağlıydı, hiçbir sağlayıcı anahtarı
ortamda yoktu; sağlayıcı sayacı **21/30**'da kaldı. Production verisi
kullanılmadı: bütün kullanıcılar ve kayıtlar senaryo içinde sentetik üretildi.

## 1. Aday kimliği, push CI ve Vercel

| Madde | Sonuç | Kanıt |
|---|---|---|
| Birleştirme | PASS | a08b61d ebeveynleri aaa0561 (design/os5) + bcfd0fb (PR HEAD); ağaç `a77fd986…` PR HEAD ağacıyla birebir |
| Push CI | PASS | "Kontrol" #1061, run 44251724441, iş 134623784088: Tipler, Lint, CSS, Migration, Rakam, Birim, DOI runtime, Editör, Veritabanı — hepsi başarılı |
| Vercel | PASS | `dpl_FeuEpYmp2C2dKgCJEMAPbwQzcCNK`, READY, target `null` = **Preview**, ref design/os5, arvo-r9773mznx-arvo-os.vercel.app |

## 2. İzole yerel şema (Production benzeri)

Temiz checkout (`git worktree`, detached a08b61d, `npm ci`, `git status` boş).
Tarif RC06k ile aynı (`betikler/kur-sema.sh.txt`): 8 migration HARİÇ,
`00-production-taklidi.sql`, ardından paketler **P1, P2, P6, P4, P3, P5, P8**
(P7 ve P9 uygulanmadı). Yığın: Postgres 17, GoTrue v2.197.0,
PostgREST v12.2.3, storage-api v1.11.13 — hepsi yerel Docker.

| Madde | Sonuç | Kanıt |
|---|---|---|
| Şema kurulumu | PASS | `kanit/kur-depo.log` |
| Şema özeti | PASS | `kanit/sema-ozeti.txt`: 1484 satır, md5(sıralı) `81b048b748550db42590abbb137c9abc`, md5(ham) `358efe9cba78d8fd8d83bb8d25dc23bf` — RC06i/k/l ile AYNI |

## 3. Üretim derlemesi ve sunucu kimliği

`next build` + `next start -p 3124` (`betikler/derle-baslat.sh.txt`).

| Madde | Sonuç | Kanıt |
|---|---|---|
| HEAD | PASS | `gitHead` a08b61d5c7404f305b2e4c4a8e8dedd8e2b056f7 |
| Temiz ağaç | PASS | `gitTemiz: true` |
| BUILD_ID | PASS | `btCPh8TT8n0WgBHEhv4Bp` — `.next/BUILD_ID` ve sunulan HTML aynı |
| Sunucu işlem bildirimi | PASS | `server-reference-manifest.json` sha256 `5842c102…0954e285` |
| STUDYO_DERLEME=uretim | PASS | `kanit/studyo/studyo-kabul-derleme.json` |

## 4. Gerçek yerel Postgres + GoTrue + Storage üzerinde kabul

| Betik | Sonuç | Kanıt |
|---|---|---|
| Kayıt bütünlüğü (`kayit-butunlugu.mjs yeni`) | **14/14 PASS** | `kanit/butunluk.txt` |
| Kimlik kabulü (`kimlik-kabul.mjs`) | **15/15 PASS** | `kanit/kimlik.txt`, `kanit/kimlik/` |
| Taklit modelle tam Stüdyo (`studyo-kabul.mjs`) | **67 PASS · 0 FAIL · 0 KURULAMADI · 1 UNVERIFIED** | `kanit/studyo.txt`, `kanit/studyo/` |

Stüdyo kabulünde seçici değişikliği GEREKMEDİ. Taklit modele giden istem
kaydı: `kanit/istem-taklit.jsonl` (2 istek, yalnızca yerel).

## 5. Taşınan menüler ve Kaynakça sekmesi

`betikler/erisim-kabul.mjs.txt`, üretim derlemesi + yerel yığın, sentetik
öğrenci, employee ve system_admin. **19/19 PASS** (`kanit/erisim.txt`,
`kanit/erisim/erisim-kabul.json`, üç ekran görüntüsü).

M1–M5 kenar çubuğu ve hesap menüsü (Araçlar/Yardım grupları klavyeyle, tek
`aria-current`, Ayarlar alt bölgede, öğrencide personel aracı yok) · E1–E4
editör (Kontroller menüsü adlı grup + inceleme paneli, Teslim kontrolü
penceresi + Esc, Belge menüsünde Bul ve Odak modu + Ctrl+F, çalışma sekmeleri)
· K1–K4 Kaynaklar (Kaynak ekle menüsü klavyeyle, Kaynakça sekmesi, eski
`/dashboard/citations` yönlendirmesi, özetten Kaynakça bağlantısı) · H0 sayfa
hatası yok · R1 tablet rayı · T1–T2 telefon alt çubuğu ve Kaynakça · personel
araçları employee/system_admin'de yalnızca hesap menüsünde.

**Seçici güncellemeleri (davranış ölçütü değişmedi), yalnızca E3:**

1. Belge menüsü düğmesi `etiketiGizle` ile metinsiz; erişilebilir adı
   açıklamasıdır ("Bul, odak modu, sayfa ayarı, …"). Seçici
   `name: /^Belge/` → `name: /^Bul, odak modu/`.
2. Menüden "Bul ve değiştir" sonrası arama kutusu anlık `isVisible()` ile
   okunuyordu ve çizimden önce `false` dönüyordu; Ctrl+F dalı zaten 300 ms
   bekliyordu. Kutunun görünür OLMASI ölçütü aynı kaldı, yalnızca
   `waitFor({ state: "visible", timeout: 3000 })` ile çizim bekleniyor.

İlk koşu (eski seçici) 18 PASS · 1 FAIL idi; ikinci koşuda menü öğeleri
okundu ama kutu `false` çıktı; üçüncü koşu 19/19.

## PASS

Bölüm 1 (3), bölüm 2 (2), bölüm 3 (5), bütünlük (14), kimlik (15),
Stüdyo (67), erişim (19) — toplam **125 madde** satırı; kabul betiklerinin
kendi sayımları 14 + 15 + 67 + 19 = 115.

## FAIL

Yok.

## UNVERIFIED

1. **Stüdyo U5-dokunma** — telefonda parmakla kaydırırken görünür örtüşme.
   Başsız Chromium'da dokunmatik kaydırma üretilemiyor ve kompozitör kareleri
   görülmüyor. Aynı maddenin tekerlek ve klavye varyantları (1024 ve telefon)
   PASS. Gerçek cihazda elle doğrulanmalı.
2. **Vercel Preview'in çalışma zamanı** — dağıtımın READY ve Preview olduğu
   doğrulandı; Preview adresinde tarayıcı kabulü KOŞULMADI (Preview paylaşılan
   Test'e bağlı ve ona yazmak kapsam dışı). Uygulama kabulü yalnızca yerel
   üretim derlemesinde yapıldı.

## Yeniden üretme

`betikler/kur-sema.sh.txt` → `derle-baslat.sh.txt build` →
`derle-baslat.sh.txt start` → `kabul.sh.txt` → `node erisim-kabul.mjs
http://localhost:3124 <çıktı>`. Betiklerdeki JWT sırrı yalnızca yerel yığın
içindir ve depodaki `scripts/yerel-yigin/*.mjs` ile aynıdır; gerçek bir
anahtar içermez.
