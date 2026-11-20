# Yayın kaydı: PR #112 (görsel uyum), 20.11.2026

Kurum sahibinin onayıyla PR #112 birleştirildi ve Production'a çıktı. Bu kayıt birleştirmeyi,
dağıtımı, canlı kontrolü, test verisinin temizliğini ve hata gözlemini tutar. Migration, Auth
ayarı ve gerçek kullanıcı içeriği değişmedi; gerçek AI çağrısı yapılmadı.

## Birleştirme ve dağıtım

| | |
|---|---|
| Ön kontrol | PR HEAD `ff97dbb` değişmemişti; `kontrol` (GitHub Actions) push ve PR koşusunda başarılı; açık inceleme konusu yok |
| Birleşme | Squash, beklenen HEAD `ff97dbb` ile → **`f9b001c516e3766df99078db71b711b05e461af5`** |
| Dağıtım | `dpl_DwkNYEhcrGpFzbTh7z1Fzg9XePwJ`, READY 04:44:39 UTC |
| Adres | `lab.arvo-os.com` bu dağıtıma bağlı ve `f9b001c`'yi sunuyor |
| Geri dönüş adayı | `dpl_3faB6DFhw7qRE76ziEcoqBZSzizd` (`8b28897`, PR #111) |

## Erişim

- **İlk plan tutmadı.** Önerilen sentetik hesap (`…yayin-af5173@resend.dev`) önceki yayının
  temizliğinde silinmişti; bu, iki başarısız giriş denemesinden ("geçersiz bilgi") sonra
  `auth.users` üzerinde salt okuma sorgusuyla anlaşıldı. Bu denemeler veri değiştirmedi. Canlı
  kontrol durduruldu ve kurum sahibine soruldu.
- **Onaylanan yöntem.** Kalan test hesabı `…yayin-832748@resend.dev` kullanıldı (Resend test
  alıcısı, posta kimseye gitmez). Tek giriş denemesi yapıldı; geçti.
- **Test verisi.** Hesapta çalışma yoktu. Editör, PDF ve AI panelini sınamak için arayüzden şunlar
  açıldı: 1 test çalışması (yeni çalışma formuyla), 1 elle eklenen kaynak, kaynakça denetimiyle
  yüklenen 1 sentetik PDF; PDF kaynağa bağlandı.
- **Sırlar.** Parola, belirteç ve oturum dosyası depoya girmedi. Betikler hesap bilgisini
  `HESAP_DOSYASI` ortam değişkeninden okur.

## Canlı kontrol

Masaüstü 1440×900 ve 1280×800, telefon 390×844; her biri açık ve koyu temada. Koyu tema hesap
ayarıyla değil tarayıcı öykünmesiyle (`colorScheme`) sınandı; hesabın ayarı değişmedi. Ham
sonuçlar `sonuclar/`, görüntüler `goruntuler/`.

| Kontrol | Sonuç |
|---|---|
| Ana ekran | "Kaldığınız yer" kartı ve "Yeni çalışma" görünüyor; altı durumun hiçbirinde yatay taşma yok |
| Yeni çalışma penceresi | Masaüstünde Word → Oluştur, telefonda Oluştur → Word. DOM, ekrandaki ve Tab sırası her durumda aynı; Shift+Tab geri gidiyor. Pozitif `tabindex` 0. Esc pencereyi kapatıyor; form gönderilmedi (sunucu işlemi sayısı değişmedi) |
| Editör | Kâğıt 924 px; taşma yok |
| PDF paneli, 1440 | Liste + belge + PDF 360 px; belgeyle örtüşme yok; güven notu tamamen görünür |
| PDF paneli, 1280 | Ray + belge + PDF 382 px; örtüşme yok; güven notu tamamen görünür |
| PDF paneli, telefon | Tam ekran yaprak, iki satır denetim; güven notu görünür |
| PDF çizimi | Dört masaüstü durumunun hepsinde yaklaşık 5,6 saniyede çiziliyor (`pdfbekle.mjs`) |
| PDF çekmecesi, 1220 | Çekmece ve ipucu görünüyor; belgedeyken Esc çekmeceyi kapatıyor (açık ve koyu) |
| AI paneli | Başlık, Kapat ve istem alanı görünür alanın içinde (1440: y=806, 1280: y=706, telefon: y=753). Telefonda görünen alan 500 px'e indirildiğinde istem alanı y=409'da, görünür. Metin yazıldı, gönderilmeden silindi |
| Odak modu, Esc | Kısayollar penceresi açıkken ilk Esc yalnızca pencereyi kapatıyor, odak modu sürüyor; ikinci Esc çıkarıyor (1440, 1280) |
| Hatalar | Hiçbir durumda sayfa hatası ya da 5xx yanıtı yok |
| AI | `ai_assistant_runs` tablosunda yayından sonra 0 kayıt |

**Esc kapsamı.** 1440 ve 1280'de yan yana açık PDF'i ve AI yan panelini Esc kapatmıyor; bu tasarım
gereği. `lib/editor-esc.ts` (`pdfCekmecesiGorunuyor`) Esc ile yalnızca çekmeceyi kapatır, yan
paneller kalıcıdır. Bu yüzden bulgu sayılmadı; Esc'nin çalışması gereken yerler (yeni çalışma
penceresi, PDF çekmecesi, odak modu) ayrıca sınandı.

**Düzenekteki hatalar (ürün hatası değil).**

- `canli.mjs`'in yeni çalışma adımı ana ekrandaki gizli komut paleti düğmesini seçti. Ana
  ekrandaki tetik bir bağlantı (`a`); bu adım `ek.mjs` ile görünür tetikle yeniden koşuldu.
- `kur.mjs` ilk koşuda boş hesabın "İlk çalışmayı oluştur" düğmesini tanımadı; seçici
  genişletildi.
- Masaüstü PDF görüntüleri 2,5 saniyede alındığı için "PDF yükleniyor" gösteriyor. Çizim
  `pdfbekle-*.png` ile ayrıca doğrulandı.
- Bu üç düzenek hatasının ekran görüntüleri depoya alınmadı.

## Temizlik

Silme hesabın kendi oturumuyla, RLS altında yapıldı; `service_role` kullanılmadı
(`betikler/temizle.sh`).

| Kayıt | Sonuç |
|---|---|
| storage.objects `2813aab1-…` (project-files) | Storage API ile silindi |
| kaynak_pdfleri `0d378d7c-…` | 200, 1 satır |
| citation_checks `03281eed-…` | 200, 1 satır |
| literature_sources `cef24e38-…` | 200, 1 satır |
| academic_projects `0c676cbf-…` | 200, 1 satır; müsvedde ve otomatik sürüm `152ab5f6-…` onunla birlikte silindi |
| Oturumlar | `logout?scope=global` 204; `auth.sessions` 0 |

**Son tarama.** `public` ve `storage` şemalarındaki bütün uuid sütunları hesap ve çalışma
kimliğine karşı tarandı (salt okuma). Kalanlar yalnızca hesabın daha önce var olan profil,
abonelik ve sözleşme onayı satırları; hesap korunuyor.

## Hata gözlemi

- **Süre:** 04:44 – 06:12 UTC (yaklaşık 87 dakika).
- **Hatalar:** Çalışma zamanı hatası yok, 5xx yok.
- **Uyarılar:** 10 uyarının hepsi aynı ve bu PR'dan önce de vardı:
  `[supabase-ortam] ARVOLAB_URETIM_SUPABASE_REF tanımlı değil: üretimin doğru projeye bağlandığı
  doğrulanamıyor (bağlantı kesilmedi).` İlgili dosyalar (`lib/supabase/ortam-guvenligi.ts` ve
  diğerleri) `8b28897`'de de aynı; PR #112 bunlara dokunmadı.

## Açık notlar (bu yayında değiştirilmedi)

1. **React #418** açık bulgu olarak kalıyor (ilk kayıt:
   `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-0335a77.json`). Bu yayının canlı
   kontrollerinde görülmedi; bu, kapandığı anlamına gelmiyor.
2. **`ARVOLAB_URETIM_SUPABASE_REF` Production'da tanımlı değil.** Uygulama bağlantıyı kesmiyor,
   yalnızca uyarı yazıyor. Tanımlanırsa üretimin doğru Supabase projesine bağlandığı her istekte
   doğrulanır. Bu bir ortam ayarı kararıdır, burada değiştirilmedi.

## Dosyalar

| Klasör | İçerik |
|---|---|
| `goruntuler/` | Her durum için ana ekran, yeni çalışma, editör, PDF ve AI; telefonda klavye benzetimi; PDF çekmecesi (1220); PDF çizim doğrulaması; `ozet-masaustu.png`, `ozet-telefon.png` |
| `sonuclar/` | `sonuc.json` (ana koşu), `sonuc-ek-form.json` (yeni çalışma penceresi), `sonuc-ek.json` (PDF çekmecesi; bu koşudaki yeni çalışma adımı seçici hatası), `iz.json` (oluşturulan çalışma kimliği) |
| `betikler/` | `kur.mjs` (giriş ve test verisi), `canli.mjs` (ana kontrol), `ek.mjs` (yeni çalışma ve çekmece), `pdfbekle.mjs`, `dom.mjs`, `temizle.sh` |
