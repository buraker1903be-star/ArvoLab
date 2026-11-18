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
| `sonra/` | Uygulanmış hâl (dalın son HEAD'i, temiz üretim derlemesi, aynı yerel yığın, sentetik içerik); `scripts/yerel-yigin/calisma-alani-kabul.mjs` üretir |

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

Migration'lar (yalnızca izole yerel yığında uygulandı; geri alma dosyaları `supabase/geri-alma/`):
`20261118122556_calisma_belge_dili` (`academic_projects.belge_dili`, NULL serbest, tr/en, toplu doldurma yok) ·
`20261118125346_kaynak_pdf_kaynak_bagi` (`kaynak_pdfleri.kaynak_id`, silmede NULL, kapsam tetikleyicisi).
Uygulandıktan sonra PostgREST şema önbelleği yenilenmeli (`notify pgrst, 'reload schema'`); yenilenmeden yeni
sütunlu her yazma PGRST204 ile düşer (yerel kabulde ilk koşu böyle düştü).

**Prototipten kalan farklar** (bilerek ya da henüz yapılmadı):

- Kayıtlı AI cevapları sekmesi yok; sağ AI paneli mevcut yazım asistanıdır.
- İlerleme çubuğu/kelime hedefi yok: uygulamada kullanıcının girdiği bir hedef alanı bulunmuyor, uydurulmadı.
- Doğrulanmış pasaj yalnızca oturum boyunca tutulur (K3-ek onaylı değil); yenilemeden sonra kartta yalnızca "PDF'i aç".
- Atıf kartı dipnotlu stillerde açılmaz; numaralı atıf belgenin kaynakça sırası ve başlığıyla eşlenir.
- Dar ekranda kart kâğıdın sağına sığmazsa satırın altına/üstüne iner.
- Kaynakça ve kılavuz/biçim ayrı gezinme öğesi değil; "Özet ve teslim" altında.
- İnceleme paneli yerleşim kararının dışında (eski davranışıyla açılır).
