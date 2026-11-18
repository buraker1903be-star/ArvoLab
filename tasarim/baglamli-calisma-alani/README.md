# Bağlamlı çalışma alanı — tasarım teslimi

Dal `tasarim/baglamli-calisma-alani`, taban `main` = `a076d9d` (18.11.2026).
İlk teslim: inceleme ve görsel tasarım. **Uygulama kodu değişmedi;** bu klasör uygulamanın dışında.

| Yol | Ne |
|---|---|
| `INCELEME.md` | Mevcut sorunlar, korunacaklar, önerilen düzen, mevcut/geliştirme ayrımı |
| `prototip/index.html` | Etkileşimli prototip. Tarayıcıda açılır (bağımlılık yok; yalnızca Google Fonts). Ekran, tema ve dil seçilir; `#ekran-1` … `#ekran-10` doğrudan bağlantı |
| `prototip/logo/` | `public/arvolab-logo*.png`'nin bayt bayt kopyası (SHA-256 aynı); prototip uygulamadan bağımsız açılsın diye |
| `gorseller/` | Prototipin ekran görüntüleri. Masaüstü `NN-tema-dil.png` (10 ekran açık/TR; seçilenler koyu ve EN), telefon `tel-NN-tema-dil.png` (ekran 1, 2, 3, 5, 6, 7, 8) |
| `once/` | Mevcut uygulama (a076d9d, temiz üretim derlemesi, gerçek depolamalı yerel yığın, sentetik içerik) |

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

## Başlangıç genişlikleri (prototipte)

Genel/dar gezinme 236 · bölüm ve kaynak listesi 300 · makale arama 372 · AI 396 · PDF 520 px.
Talimattaki aralıkların içinde; gerçek içerikle uygulamada sınanacak.
