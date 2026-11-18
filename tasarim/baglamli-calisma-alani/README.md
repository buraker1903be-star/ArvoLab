# Bağlamlı çalışma alanı — tasarım teslimi

Dal `tasarim/baglamli-calisma-alani`, taban `main` = `a076d9d` (18.11.2026).
İlk iki tur: inceleme ve görsel tasarım. Onaylanan 2. tur aynı dalda uygulandı (19.11.2026); durum aşağıda, **Uygulama durumu**.

| Yol | Ne |
|---|---|
| `INCELEME.md` | Mevcut sorunlar, korunacaklar, önerilen düzen, 2. tur düzeltmeleri, mevcut/geliştirme ayrımı |
| `KARARLAR.md` | Onay bekleyen kararlar: belge dili, kaynak–PDF bağı, atıf kartı (seçenekler ve çıktı etkileri) |
| `prototip/index.html` | Etkileşimli prototip. Tarayıcıda açılır (bağımlılık yok; yalnızca Google Fonts). Ekran, tema ve dil seçilir; `#ekran-1` … `#ekran-10` doğrudan bağlantı |
| `prototip/logo/` | `public/arvolab-logo*.png`'nin bayt bayt kopyası (SHA-256 aynı); prototip uygulamadan bağımsız açılsın diye |
| `gorseller/` | Prototipin ekran görüntüleri. Masaüstü `NN-tema-dil.png` (10 ekran açık/TR; seçilenler koyu ve EN), telefon `tel-NN-tema-dil.png` (ekran 1, 2, 3, 5, 6, 7, 8). 2. turda eklenen durumlar: `05secim-*`, `05atif-*` (ekran 5, A ve B), `071440-*`, `071280-*` (ekran 7, iki genişlik) |
| `once/` | Mevcut uygulama (a076d9d, temiz üretim derlemesi, gerçek depolamalı yerel yığın, sentetik içerik) |
| `sonra/` | İlk teslimin görüntüleri (23e927c derlemesi); tarihsel, üzerine yazılmaz |
| `sonra-903bd9a/` | Son hâl: 903bd9a, temiz üretim derlemesi `XRV2st2SilgSkE62Kuq3H`, aynı yerel yığın, sentetik içerik; `scripts/yerel-yigin/calisma-alani-kabul.mjs` üretir |

Prototipte içerik sentetik ve davranışlar taklittir: arama sonuçları, PDF sayfası, AI cevabı, kayıtlı cevaplar,
kelime sayıları ve atıf kartı gerçek veriye bağlı değildir. Prototip sunucuya istek göndermez. Her ekranın üstünde **Mevcut** (bugün çalışan),
**Geliştirme** (yapılması gereken) ve **Taklit** (yalnızca gösterim) etiketleri var.

## Ekranlar

1. İlk kullanım ana görünümü · 2. Mevcut çalışmalarla ana görünüm · 3. Yeni çalışma ·
4. Genel → çalışma gezinmesi · 5. Dar çalışma gezinmesi + belge · 6. Geniş makale arama + belge ·
7. Kaynak listesi + sağda PDF · 8. Sağ Arvo AI paneli · 9. Telefonda arama → PDF → belge ·
10. Mevcut/önerilen tipografi

## Henüz çalışmayan işlevler (prototipte "Geliştirme" etiketli)

- Editörde sol alanın genel ↔ çalışma gezinmesine dönüşmesi ve görevle genişlemesi
- Atıfa tıklayınca kaynak kartı ve "Dayanağa git" (bugün atıf düz metin)
- PDF'te eşleşen pasajın sarı vurgusu; "eşleşme yok" durumu
- Kayıtlı AI cevapları sekmesi
- Seçili pasaj üstünde bağlamsal araç çubuğu
- Çalışma başına belge dili; yeni çalışmadan Word içe aktarma bağlantısı
- Telefonda arama sayfası ve "Çalışma" yaprağı
- Belge ölçeği denetimi (−/+/Sığdır) ve PDF açılınca daralma sırası; telefonda PDF yakınlaştırma ve "Pasaja odaklan"
- Ayrı güven durumları (PDF açılabilir / künye doğrulandı / alıntı birebir eşleşti) tek görünümde

## Başlangıç genişlikleri (prototipte)

Genel/dar gezinme 236 · bölüm ve kaynak listesi 300 · makale arama 372 · AI 396 · PDF 520 px.
Talimattaki aralıkların içinde; gerçek içerikle uygulamada sınanacak.

## Uygulama durumu (19.11.2026)

Beş commit, onaylanan sırayla: 1 kimlik/tipografi/gezinme · 2 yeni çalışma + belge dili (K1-A) ·
3 sol araştırma alanı, tek sağ panel, belge ölçeği, durum koruma · 4 kaynak–PDF bağı (K2-A), atıf kartı (K3-A),
pasaj vurgusu · 5 klavye, dokunma, telefon. Kabul: `node scripts/yerel-yigin/calisma-alani-kabul.mjs <adres>`,
sonuç `scripts/yerel-yigin/sonuclar/calisma-alani-kabul.json`.

Kabul sonuçları commit adıyla ayrı dosyalarda (`scripts/yerel-yigin/sonuclar/`); her dosya git HEAD, BUILD_ID ve
uygulama kodunun temiz olup olmadığını taşır. `calisma-alani-kabul.json` ilk teslimin (23e927c) sonucudur, yeni
HEAD'in kanıtı değildir. Son tam koşu: `calisma-alani-kabul-903bd9a.json` (13 PASS).

### Migration → şema önbelleği → kod sırası

Migration'lar yalnızca izole yerel yığında ve PGlite testlerinde uygulandı; Production ya da paylaşılan Test'e
uygulanmadı.

1. `20261118122556_calisma_belge_dili` (`academic_projects.belge_dili`: NULL serbest, `tr`/`en`, varsayılan ve toplu
   doldurma yok) ve `20261118125346_kaynak_pdf_kaynak_bagi` (`kaynak_pdfleri.kaynak_id`: silmede NULL, kısmi dizin,
   security invoker kapsam tetikleyicisi). İkisi de yalnızca EKLER; mevcut satırlar değişmez, eski kod çalışmaya devam eder.
2. `notify pgrst, 'reload schema';` — PostgREST önbelleği yenilenmeden yeni sütuna dokunan her istek PGRST204 ile
   düşer (yeni çalışma oluşturma dahil). Yerel kabulün ilk koşusu tam bu yüzden düştü.
3. Uygulama kodu. Kod iki sütunu okuyup yazıyor; sütunlar yokken dağıtılırsa yeni çalışma ve PDF bağı düşer.

### Geri alma koşulları

Ne zaman: belge dili ya da kaynak–PDF bağı veri bozuyor, yetki açığı çıkıyor ya da kod geri alınmak zorunda.
Sıra kurulumun TERSİDİR: önce kod (bu dalın öncesi), sonra `supabase/geri-alma/` dosyaları
(`…kaynak_pdf_kaynak_bagi.sql`, sonra `…calisma_belge_dili.sql`), sonra şema önbelleği (dosyaların sonunda).
Kaybolan: kullanıcıların seçtiği belge dilleri (çalışmalar arayüz dili kuralına döner) ve kurulan PDF–kaynak
bağları (eşleşme künye/DOI tahminine döner). PDF'ler, kaynaklar ve belgeler silinmez. İki dosya yerel veritabanında
bir işlem içinde çalıştırılıp geri sarıldı: sütunlar ve tetikleyici kalktı, 20 PDF satırı yerinde kaldı.

### Kayıtlı AI cevapları: neden eksik, tamamlamak için ne gerekir

Prototipte "Kayıtlı" sekmesi vardı ve onaylı kapsamdaydı. Bu dalda yapılmadı; kapsam dışı sayılmıyor. İlk teslimde
önce yerleşim, K1–K3 ve kabul işleri yapıldı; bu sekme atlandı ve PR'da yalnızca "prototipten fark" diye geçti. Onu
kendiliğinden kapsamdan düşmüş gibi yazmak yanlıştı. Engel bir karar ya da şema değişikliği değil. Bugün durum:

- Yazım asistanının sohbeti panelin belleğinde (`yazim-paneli.tsx`, `useState`); panel kapanınca ya da sayfa
  yenilenince kaybolur.
- Her çalışma sunucuda zaten `ai_assistant_runs`'a yazılıyor (`lib/ai/kayit.ts`): `capability`, `status`, `output`
  (modelin ham cevabı), `context` (istemin tamamı), `findings`, `project_id`, `rating`. Okuma RLS'i: kullanıcı kendi
  satırını görür; kurum gözetim rolleri `gozetim_kapsami` ile.

Tamamlamak için (aynı dalda, migration GEREKMEZ):

1. Sunucu işlemi: oturumdaki kullanıcının, bu çalışmaya ait, `capability in ('yazim','kaynak')` ve
   `status = 'completed'` satırlarını tarihe göre sıralı ve sayfalı okur. Gözetim rolünün okuma hakkı kayıtlı
   sekmede kullanılmaz: sorgu `user_id = auth.uid()` ile açıkça daraltılır.
2. Gösterim: `output` yazım asistanının kendi çözümleyicisiyle okunur. Kullanıcının sorusu ayrı bir sütunda değil,
   `context`'in içinde; eski kayıtlarda soru gösterilmez, yenilerinde `findings`'e soru ve görev yazılır
   (jsonb, şema değişmez).
3. Ekleme: kayıtlı cevap belgeye yine yalnızca kullanıcının düğmesiyle girer, asistan izi (`lib/tiptap-asistan-izi.ts`)
   taşır ve ekleme anında atıf denetimi GÜNCEL Literatür kütüphanesine karşı yeniden çalışır. Cevap kaydedildiği
   gün geçerli olan bir atıf, kaynak sonradan silindiyse düşer. Gerçek AI çağrısı gerekmez.
4. Kabul: yerel model taklidiyle (`scripts/yerel-yigin/model-taklidi.mjs`) üretilmiş kayıtlarla listeleme, sayfa
   yenilemeden sonra görünme, başka kullanıcının ve başka çalışmanın kaydının görünmemesi, silinmiş kaynağa atıflı
   cevabın eklenememesi; birim testi çözümleyici ve atıf yeniden denetimi için.

Tahmini iş: bir sunucu işlemi, panelde bir sekme, iki test dosyası ve kabul senaryosu.

**Prototipten kalan farklar** (bilerek ya da henüz yapılmadı):

- Kayıtlı AI cevapları sekmesi yok (yukarıda: neden ve gereken iş).
- İlerleme çubuğu/kelime hedefi yok: uygulamada kullanıcının girdiği bir hedef alanı bulunmuyor, uydurulmadı.
- Doğrulanmış pasaj yalnızca oturum boyunca tutulur (K3-ek onaylı değil); yenilemeden sonra kartta yalnızca "PDF'i aç".
- Atıf kartı dipnotlu stillerde açılmaz; numaralı atıf belgenin kaynakça sırası ve başlığıyla eşlenir.
- Dar ekranda kart kâğıdın sağına sığmazsa satırın altına/üstüne iner.
- Kaynakça ve kılavuz/biçim ayrı gezinme öğesi değil; "Özet ve teslim" altında.
- İnceleme paneli artık yerleşim kararında (19.11.2026): sağ panelle aynı yuvayı paylaşır, AI/PDF açıkken gizlenir;
  yalnız açıkken belgeyi %85'in altına sıkıştırmaz (önce ray, sonra çekmece). Dar masaüstünde AI/PDF çekmecesi
  başlık satırını (Kontroller, Dışa aktar) örter; incelemeye geçmek için çekmece kapatılır.
