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
