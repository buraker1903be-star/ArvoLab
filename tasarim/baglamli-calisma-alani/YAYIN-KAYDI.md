# Yayın kaydı: PR #110 — 18.11.2026

Onaylanan plan: `YAYIN-PLANI.md`, aday `d3bc78307d202f8bf9c5acaa51cd41c4ca91cede`.
**Durum: DURDU — oturumlu API doğrulamasından önce. Merge ve Production dağıtımı YAPILMADI.**

## Gerçekleşen

| Adım | Sonuç |
|---|---|
| HEAD | Yerel = `origin/tasarim/baglamli-calisma-alani` = `d3bc783`; `main` = `a076d9d` |
| CI | `d3bc783`: `kontrol` iki koşuda da başarılı (44400105895, 44400092276) |
| Production ön koşulu (salt okunur) | Bekleyen migration 2, yeni sütun/kısıt/dizin/işlev/tetikleyici 0, son `20261115203504`, toplam 121; Production dağıtımı `a076d9d` (`dpl_GLoSgdGXu7rYtRBuG2FcPeotqFd9`) |
| Yedek | Kullanıcı panelden son yedeği gördüğünü bildirdi; mesajda tarih/saat değeri yazılı değildi (yer tutucu metin geldi), bu kayda değer olarak girmedi |
| Migration 1 | `20261118122556_calisma_belge_dili` tek işlemde uygulandı, geçmişe `version`+`name` ile yazıldı |
| Migration 2 | `20261118125346_kaynak_pdf_kaynak_bagi` tek işlemde uygulandı, geçmişe yazıldı |
| Migration sonrası denetim | Kayıtlı 2, toplam 123; `belge_dili` text, NULL serbest, varsayılansız; kısıt `belge_dili IS NULL OR IN ('tr','en')`; `kaynak_id` uuid NULL serbest, `on delete set null` → `literature_sources`; kısmi dizin var; işlev security invoker, `search_path=public`, `PUBLIC/anon/authenticated` yetkisi 0, gövde özeti depodaki dosyayla aynı (`55dfc48a…`); tetikleyici `BEFORE INSERT OR UPDATE OF kaynak_id, project_id`; dolu `belge_dili` 0, dolu `kaynak_id` 0; satır sayıları değişmedi (3 / 30) |
| Şema önbelleği | `notify pgrst, 'reload schema'` |
| API (oturumsuz) | `academic_projects?select=id,belge_dili` ve `kaynak_pdfleri?select=id,kaynak_id` → 401 / 42501 (bugünkü gibi anon'a kapalı). Var olmayan bir sütun → 400 / 42703. Yeni sütunlar "yok" değil "yetki yok" hatası verdiği için PostgREST önbelleği onları tanıyor (dolaylı kanıt) |
| Sentetik hesap | `/kayit` ile yeni hesap açıldı: `delivered+arvolab-yayin-af5173@resend.dev` (Resend test alıcısı, posta kimseye gitmez). E-posta onayı yapılmadı → hesap onaysız, çalışması yok |

## Neden durdu

Plan, birleştirmeden önce **oturumlu** API doğrulaması istiyor (bölüm 3, adım 3). Sentetik hesabın oturumu için
e-posta onayı gerekiyor. Onay e-postası Resend'in test alıcısına gidiyor ve bu oturumdan okunamıyor. Onay bağlantısını
veritabanındaki belirteçten kurmak, e-posta doğrulamasını atlamak olur. Bu yol oturumun izin denetiminde de reddedildi;
onay engelini aşmaya çalışılmadı. Durma koşulu: oturumlu doğrulama yapılamadı → merge yok.

## Şu anki durum

- **Production veritabanı:** iki migration uygulanmış (yalnızca ekleme), şema önbelleği yenilenmiş.
- **Production kodu:** `a076d9d`. Eski kod yeni sütunları adlandırmıyor; plan bölüm 4'e göre bu ara durum güvenli.
- **PR #110:** taslak, birleştirilmedi.
- **Oluşturulan veri:** yalnızca onaysız sentetik hesap (`…af5173`). Çalışma, kaynak ya da PDF oluşturulmadı.
- Gerçek AI çağrısı yok. Mevcut hesap ve verilere dokunulmadı. Sütun geri alma yapılmadı.

## Devam için gerekenler (kullanıcı kararı)

Aşağıdakilerden biri:

1. Resend panelinde (Emails) `…af5173` adresine giden doğrulama e-postasındaki bağlantıyı paylaşmak. Bağlantı 1 saat
   geçerli; süresi geçtiyse hesap yeniden onay e-postası ister.
2. Production'da sentetik bir test hesabını panelden onaylamak (Authentication → Users) ya da hazır bir test hesabı
   vermek.

Sonra sıra kaldığı yerden sürer: oturumlu API → PR'ı hazır hâle getirme ve birleştirme → dağıtım doğrulaması →
C1–C8 → 30 dk gözlem.

**HEAD notu:** bu kayıt dosyası dalda yeni bir commit oluşturur. Onaylanan `d3bc783` ile arasındaki fark yalnızca bu
belgedir; uygulama kodu aynı.

---

## Devam: 18.11.2026 22:00–22:32 UTC

**Yedek (kullanıcının panelden bildirdiği):** son veritabanı yedeği 18.11.2026 05:00 UTC / 08:00 TSİ. Bu yedek
Storage dosyalarını kapsamıyor.

| Adım | Sonuç |
|---|---|
| HEAD / CI | `18af35b`; `d3bc783`'e göre yalnızca bu belge farklı, uygulama kodu aynı; `kontrol` iki koşuda yeşil |
| Migration'lar | Yeniden uygulanmadı; kayıtlı 2/2, toplam 123 |
| Sentetik hesap | `6168c0ea-f7de-4a02-9e12-8c1e4df3dfd0` (`…af5173@resend.dev`), kullanıcı onayladı; geçici şifre kullanıcıdan, hiçbir dosyaya yazılmadı |
| Oturumlu API | `academic_projects?select=id,belge_dili` → 200; `kaynak_pdfleri?select=id,kaynak_id` → 200 |
| Eski kodla eski çalışma (C1 hazırlığı) | `7788514e-12a7-4c2c-bab7-669cbf2ef278`, `a076d9d` canlıdayken oluşturuldu; `belge_dili` NULL, sayfa hatası 0 |
| Birleştirme | PR #110 taslaktan çıkarıldı, squash: **`ea010ace1f8ee4f710203d00a1bbe3a5d6dab92d`** |
| Production dağıtımı | `dpl_H41HPBEkUF93mdpDgsKHNN566BSS`, READY 22:11:46 UTC; `lab.arvo-os.com` bu dağıtıma bağlı (`ea010ac`) |

### Canlı kabul

| # | Sonuç | Kanıt |
|---|---|---|
| C1 | PASS | Eski çalışma yeni kodla açıldı, yazıldı, yenilemede iki cümle de var; `belge_dili` NULL kaldı |
| C2 | PASS | Yeni çalışma `9ff42aa9-9d6c-4c1e-a38d-5c39391eca37`, makale, `belge_dili='en'`, metin kaydedildi |
| C3 | ÖLÇÜLMEDİ | C7 ile birlikte koşacaktı; durma sonrası koşulmadı |
| C4 | PASS | Kaynak `c6fc66cf…` (arayüz, Manuel kaynak ekle); Kaynakça denetimi + PDF yükleme → "PDF yüklendi." (`cde880db…`); PDF panelinde "Kaynağa bağla" → `kaynak_id` dolu; atıf kartı (Deneme, 2020) eşleşti, "PDF'i aç" bağlı PDF'i açtı |
| C5 | PASS | Başka çalışmanın kaynağı (`b5c98534…`) ve olmayan kaynak → 403/42501 "Kaynak bu çalışmaya ait değil…"; anon → 401; bağ değişmedi |
| C6 | **FAIL** | Aşağıda |
| C7 | ÖLÇÜLMEDİ | Durma |
| C8 | KISMİ | 22:11:46–22:31:36 (~20 dk) Vercel çalışma hatası 0; 30 dk tamamlanmadı |

**C6 ayrıntısı.** 1472'de liste + PDF yan yana, taşma 0. AI paneli açıldı/kapandı, AI isteği 0
(`ai_assistant_runs` bu kullanıcı için boş). Telefonda (390) alt çubuk Belge / Kaynaklar / Arvo AI geçişleri
çalışıyor, taşma 0. **Hata (1280):** PDF geçici çekmecesi açıkken ("Geçici görünüm · Esc ile kapatın"), imleç
belgedeyken Esc çekmeceyi kapatmıyor — AYNI SEKMEDE daha önce Arvo AI paneli (`?sag=ai`) açılmışsa. Ölçüm:

| Dizi (1280, imleç belgede, Esc) | Çekmece kapandı |
|---|---|
| Taze sekme | 3/3 |
| 1472 → 1280 yeniden boyut | 1/1 |
| Önce `?sag=ai` açılıp sonra PDF çekmecesi | 1/6 |

Arada tam sayfa yüklemesi var; localStorage, sessionStorage ve çerezlerde fark yok. Satır içi öneri yok, atıf
kartı yok, açık pencere yok. Çekmece çarpı düğmesiyle kapanıyor; veri kaybı ya da sayfa hatası yok. Yerel kabulde
(S16/S18/S19) bu dizi sınanmamıştı. Görseller: düzenek klasöründe `c6-1280-esc.png`, `esc-*.png`.

### Oluşturulan sentetik kayıtlar (temizlenmedi — hata yeniden üretilebilsin diye, karar bekliyor)

- auth kullanıcı `6168c0ea-f7de-4a02-9e12-8c1e4df3dfd0`
- çalışmalar `7788514e-12a7-4c2c-bab7-669cbf2ef278`, `9ff42aa9-9d6c-4c1e-a38d-5c39391eca37` (+ müsveddeleri)
- kaynaklar `c6fc66cf-c456-4ce4-bc51-f8c58497f3d3`, `b5c98534-b5d0-4d90-ad57-3bc560737f36`
- kaynak PDF'i `cde880db-d675-4eb9-9334-fbbe8f3a7fe5`, Storage `project-files/9ff42aa9-…/kaynak-pdf/y-6168c0ea-…-8e54f34e-….pdf`
- Kaynakça denetiminin bıraktığı kayıt(lar) — temizlikte proje kimliğiyle aranacak

---

## Devam: 18.11.2026 22:35 – 19.11.2026 (C3, C7, gözlem; C6 düzeltmesi)

### Canlı kabulün kalanı — `ea010ac` (Production), düzeltme ÖNCESİ

| # | Sonuç | Kanıt |
|---|---|---|
| C3 | PASS | Yeni çalışma (`belge_dili='en'`) TR ve EN arayüzde Word'de "TABLE OF CONTENTS"; eski çalışma (NULL) TR arayüzde "İÇİNDEKİLER", EN arayüzde "TABLE OF CONTENTS" (eski kural arayüzü izler) |
| C7 | PASS | `/api/manuscripts/<id>/export` dört kez 200, `.docx` 9,8 KB; metin ve atıf "(Deneme, 2020)" çıktıda; içindekiler başlığı belge diline göre. İçindekiler bayrağı kullanıcının kendi oturumuyla (RLS altında) açıldı |
| C8 | PASS | 22:11:46–22:41:46 UTC: Vercel çalışma hatası yok. Görünen tek kayıt Node'un `localStorage` deneysel uyarısı; 05.11.2026'dan beri var, bu yayınla ilgisiz |
| C6 | **FAIL (korunuyor)** | İlk canlı başarısızlık yukarıda; aşağıdaki düzeltme Production'a henüz dağıtılmadı |

Not: eski çalışmanın metninde bu kabul betiklerinin yazmadığı bir "Selamlar" kelimesi görüldü (çalışmanın son
güncellemesi 22:48:51, kabulün içindekiler isteğiyle aynı an). Hesap sentetik ve geçici şifresi kullanıcıda;
bu kabulün dışında bir oturumun yazdığı düşünülüyor, ürün hatası belirtisi değil.

### C6 kök nedeni (Production'da ölçüldü, yerelde yeniden üretildi)

Çekmece görünümü (`data-sag-cekmece`, "Esc ile kapatın" ipucu) yerleşim kararı henüz yokken de çiziliyor
(`sag && karar?.sag !== "sutun"`, karar null iken doğru). Esc dinleyicisi ise ancak karar "cekmece" deyince
ekleniyordu. Production izi (`ea010ac`): React yerleşimi 1537 ms'de sahiplendi (çekmece çizili, karar yok), Esc
3494 ms'de basıldı ve yalnızca Ctrl+K/Ctrl+S dinleyicileri canlıydı, karar 3661 ms'de geldi, dinleyici 3665 ms'de
eklendi. Yerelde ara sıfıra yakın; CDP ile CPU 6× kısıtlanınca eski derlemede de aynı iz çıktı (0/5, sonra S20
0/10). AI panelinin kendisi neden değil (aynı sekmede yenilemesiz dizi geçiyor); eski kapanım (stale closure)
değil (`escDurumu`/`pdfKapat` bağımlılıkları doğru); olay önceliği değil (o anda Esc'i dinleyen yoktu).

### Düzeltme (`duzeltme/pdf-cekmece-esc`, Production'a dağıtılmadı)

Dinleyici PDF açık olduğu sürece ekli; çekmece olup olmadığı olay anında görünen durumdan okunur
(`lib/editor-esc.ts` → `pdfCekmecesiGorunuyor`: nitelik + pencere genişliği, ≤760 telefon). Odak modu aynı karara
bakar. Koda gecikme eklenmedi.

| Doğrulama (yerel, temiz üretim derlemesi) | Düzeltmeden önce | Sonra |
|---|---|---|
| Yavaş cihaz (CPU 6×), ipucu görünür görünmez Esc | 0/5 (iz), S20 0/10 | 10/10 |
| Canlıdaki dizi (önce `?sag=ai`, sonra PDF çekmecesi) | — (yerelde ara kısa) | 10/10 |
| Aynı sekmede AI aç/kapat → PDF'i aç → 1472→1280 → belge → Esc | 3/3 | 10/10 |
| Teslim kontrolü penceresi açıkken ilk Esc yalnızca pencereyi kapatır, ikinci Esc PDF'i | — | 10/10 |
| Tam kabul S0–S20 | — | **22/22 PASS** (`sonuclar/calisma-alani-kabul-0f55756.json`) |

Kontroller: tsc, lint (0 hata), check:css, check:rakamlar, check:migrations, test:unit 2356, test:editor 112,
test:db 362.

### Temizlik — BEKLİYOR

Production'daki sentetik kayıtlar inceleme süresince korundu. Silme öncesi ilişkili kayıtları bulan salt okunur
sorgu, araç onay sorusuna yanıt gelmediği için çalışmadı; temizlik ve test oturumlarının kapatılması kullanıcı
onayından sonra yapılacak.
