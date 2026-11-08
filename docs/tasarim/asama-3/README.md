# Aşama 3.0 — Dashboard ve Çalışmalarım maketleri

Durağan HTML maketler; uygulamanın kodu değil. Renkler `app/styles/tokens.css`,
simgeler uygulamanın lucide seti, logo `public/`, metin ve sayılar önizleme
verisi (`scripts/onizleme/veri.ts`). Kurum sahibinin görsel onayı alınmadan
3.1–3.6 uygulanmaz.

```
node docs/tasarim/asama-3/uret.mjs            # HTML'leri üretir
node docs/tasarim/asama-3/cek.mjs <klasör>    # 1440/390 × açık/koyu PNG
```

## Maketteki her denetimin bugünkü karşılığı

Var olmayan bir özellik çizilmedi. Sağ sütun bugün hangi bileşenden geliyor:

| Maketteki öğe | Bugün nerede |
|---|---|
| Yazmaya devam et / Çalışma özeti | `app/dashboard/page.tsx` ana kart |
| Teslime kalan, Yazılan (%55 kılavuz hedefine göre), Teslim hazırlığı | Ana kart ölçüleri; `calisma-durum-karti.tsx` ölçüleri (iki sayfa artık aynı şerit) |
| Önce · Tez yazım kılavuzu · Kılavuzumu yükle | "Şimdi/Önce" satırı, `KilavuzPenceresi` |
| Sıradaki adımlar: Kapak sayfası / Yapı ve atıflar / İçindekiler | Teslim listesi ve "Başka neler var" maddeleri (aynı veri) |
| Yazım ritmi (Son 14 gün) | `genel-bakis.tsx` — önizleme hesabında veri yok, boş hâli çizildi; veri varken grafik zaten var |
| Hızlı eylemler: DOI ile kaynak ekle, Yazım asistanını aç, Kaynağa sor | Bugün "Daha fazla" içinde; aynı üç eylem |
| Kaynaklar ve kanıt (5 satır) | Ana sayfa "Kaynaklar ve kanıt" kartı |
| Danışmanıma gönder: Okuma bağlantısı, Dosya olarak gönder | `danismana-gonder.tsx` |
| Abonelik ve kredi: toplam, bu ay kalan, satın alınan bakiye, Ayrıntı, Kredi satın al | `kredi-ozet-karti.tsx` (A2-5 kararı) |
| Diğer çalışmalarınız, Tüm çalışmalar | Ana sayfa "Diğer çalışmalarınız" |
| Daha fazla: bölümler, son eklenenler, çalışma hareketi | Ana sayfa açılır bölümü (hızlı eylemler dışarı alındı) |
| ArvoLab işinizi kolaylaştırdı mı? 1–5, Sonra, Bir daha sorma | `geri-bildirim-karti.tsx` |
| Çalışmalarım listesi: başlık, tür, kelime, son düzenleme, durum, teslim, ilerleme | `editor/page.tsx` öğrenci satırı |
| Ayrıntı ⋯: teslim paketi, düzenle, belge yükle, sil | `calisma-durum-karti.tsx` kart menüsü |
| Araçlar: Takvim, Literatür, Kaynakça, Kanıt matrisi, Diğer araçlar | Aynı kartın araç satırı |
| Telefonda liste → ayrıntı ("← Tüm çalışmalar") | Seçenek A kararı; `?sec=` adresi korunur |

## Onay isteyen yeni kararlar

1. Kenar çubuğundaki "Yeni çalışma" tonal düğme olur: sayfanın tek birincil
   eylemi "Yazmaya devam et" kalsın.
2. "Hızlı eylemler" ana sayfada görünür kart olur (sütunları dengeliyor);
   "Daha fazla" bölümler, son eklenenler ve çalışma hareketiyle kalır.
3. Çalışmalarım başlığının altına kısa açıklama: "Bir çalışma seçin; özeti,
   teslim durumu ve araçları sağda."
4. Telefonda üç ölçü yan yana değil, satır listesi.

## Revizyon 2 (kurum sahibinin 7 maddesi)

`maket-v2.css` + `uret.mjs`'teki sayfa parçaları. Kabuk aynı.

- **Dashboard iki katman:** tek yükseltilmiş yüzey "odak bandı" (açık
  çalışma, tek birincil eylem, uygulamanın kendi "Şimdi" önerisi, sağda üç
  ölçü); ikincil bilgi kartsız "çalışma masası"nda, ince çizgi ve küçük
  başlıkla ayrılmış sık satırlar.
- **Hızlı eylemler:** masaüstünde tek satır (34 px), telefonda üç kısa
  simge düğmesi (64 px). Aynı üç eylem; "Yazım asistanını aç" etiketi
  "Yazım asistanı" olarak kısaldı.
- **Telefon Dashboard:** ilk ekranda çalışma, "Yazmaya devam et" (alt
  kenarı 360 px) ve "Şimdi" adımı (509 px). Sayfa boyu 3270 → 2469 px.
- **Çalışmalarım masaüstü:** liste kanvasta ve sakin (340 px), seçili
  çalışma tek kart olarak öne çıkar; ayrıntıda araçlar başlığın altında
  araç çubuğu, ölçüler sık şerit, "Şimdi" ve teslim listesi.
- **Telefon ayrıntı:** tek uzun kart yerine başlık + gruplanmış listeler
  (Durum, Şimdi, Teslim için bakılacaklar, Araçlar).
