# Dört ana giriş — 20.11.2026

Çalışmanın içindeki menü dört girişe indi, grup başlıkları ("Yaz / Araştır /
Kontrol et") kalktı. Masaüstü, tablet ve telefon aynı dört girişi kullanır.

| Giriş | Ne açılır | Adres |
|---|---|---|
| Belge | Yazım ekranı. Bölüm ağacı Belge'nin içinden açılır, kapanır: açık kenar çubuğunda Belge'nin hemen altında dar bir ağaç olarak; dar çubukta, tablette ve telefonda araç alanında. Başlığa tıklamak belgede o yere gider; bölüm işlemleri (eksik bölümleri ekle, durum) aynı yerde. Telefonda açık Belge'ye yeniden dokunmak ağacı açar ya da kapatır. | `…/write`, `?sol=bolumler` |
| Kaynaklar | Kütüphanem ve Kaynakça sekmeleri; "Makale bul" belirgin bir düğmeyle aynı alandan açılır | `?sol=kaynaklar`, `?sol=kaynakca`, `?sol=arama` |
| Arvo AI | Sağ panel | `?sag=ai` |
| Kontrol ve teslim | Kılavuz, biçim, teslim hazırlığı ve bu çalışmanın sayfaları: Özet ve teslim, Kanıt matrisi, Makale, Etik kurul, Analiz, Belge kontrolü (eskiden "Diğer araçlar") | `?sol=kontrol` |

**Eski adresler:**
- `?sol=kilavuz`, Kontrol ve teslim'i açar.
- `?sol=arama` ve `?sol=kaynakca`, Kaynaklar'ı açar.
- `?sol=bolumler`, Belge'nin bölüm ağacını açar.
- Özet ve teslim, Kanıt matrisi, Etik kurul, Analiz ve Belge kontrolü sayfaları olduğu gibi duruyor. Bu sayfalarda menüde "Kontrol ve teslim" seçili görünür.
- Hiçbir işlev silinmedi.

**Editörün durumu korunuyor.** Kaynaklar'ın sekmeleri ve Makale bul arasında geçiş, adresteki `sol` değerini yumuşak bir yönlendirmeyle ve kaydırmadan değiştiriyor. Editör sökülmüyor; içerik, imleç ve kaydırma olduğu gibi kalıyor (kabulde ölçüldü). Arama metni de korunuyor.

## Kabul

`node tasarim/dort-giris/betikler/kabul.mjs` **26/26** geçti. Masaüstü 1440 px ve iPhone 13'te, açık ve koyu temada koşuldu. Kapsanan durumlar:
- dört giriş ve grup başlığı olmaması;
- dar bölüm ağacı ve başlığa gitme;
- sekmeler ile Makale bul;
- editör durumunun korunması;
- Kontrol ve teslim içeriği;
- eski adresler;
- telefonda aynı dört giriş ve yatay taşma olmaması.
