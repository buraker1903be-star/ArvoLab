# Canlı deneme düzeltmeleri (20.11.2026)

Kurum sahibinin lab.arvo-os.com'daki denemesinden çıkan üç sorun. Belge içeriğine dokunulmadı, migration yok.

| Sorun | Kök neden | Düzeltme |
|---|---|---|
| İncele paneli kapatılınca geri açılamıyor | Yeniden açmanın tek yolu "Kontroller" menüsünün en altındaki satırdı | Panel kapalıyken araç çubuğunun sağ ucunda, panelin başlığının üstünde görünür "İncele" düğmesi. Odak iki yönde taşınıyor (açınca panelin kapatma düğmesine, kapatınca bu düğmeye). Sağ panel (AI/PDF) açıkken ve odak modunda çizilmez; orada menüdeki "İnceleme paneline geç" var. |
| Yazarken kâğıdın iki yanında kalın lacivert çizgiler | TipTap belge alanına `tabindex="0"` veriyor; `base.css`'teki genel `[tabindex]:focus-visible` kuralı 3 px halka çiziyor. Yazılabilir alanda tarayıcı odağı hep "görünür" sayar, halka her tıklamada çıkıyordu | `.manuscript-editor-content:focus-visible { outline: none; }`. İmleç, seçim rengi ve araç çubuğu düğmelerinin klavye halkası değişmedi. |
| Başlıksız belgenin Word çıktısında boş "İÇİNDEKİLER" sayfası | Word yolu içindekiler açıkken başlık olup olmadığına bakmıyordu (yazdırma/PDF yolu bakıyordu) | Başlık satırı yoksa İÇİNDEKİLER başlığı, alanı ve sayfa sonu yazılmıyor. Tablo/şekil listeleri kendi koşuluyla devam ediyor; ön sayfaların arasına yerleşince ilk başlık doğru adı taşıyor. |

Not: canlı görüntüdeki paragrafın solundaki ince çizgi ve gri yazı, paragrafın alıntı (blockquote) biçiminde olmasından; içerik olduğu için dokunulmadı.

## Kabul (`betikler/kabul.mjs`, yerel üretim derlemesi, sentetik veri) — 10/10

```
node tasarim/tek-deneyim/betikler/tohum.mjs
node tasarim/tek-deneyim/betikler/kabul3.mjs http://localhost:3150   # önce (bireysel hesabın son çalışmasını tohumdaki varsayar)
node tasarim/canli-duzeltme-1/betikler/kabul.mjs http://localhost:3150
```

- 1440 ve 1280 px: düğme araç çubuğunda, kâğıtla çakışmıyor, çubuk taşmıyor; aç → kapat → tekrar aç (fare ve Enter), odak taşınıyor, tercih yenilemede korunuyor.
- Yazarken belge alanında halka yok; imleç belgede, metin kaydediliyor, seçim rengi duruyor, araç çubuğu klavye halkası duruyor.
- Word: başlıksız belgede İÇİNDEKİLER ve TOC alanı yok; başlıklı belgede ikisi de var.
