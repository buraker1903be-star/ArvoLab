# Signature Academic OS v4 — tasarım paketi

Academic Editorial × Precision SaaS. Tasarım çalışmasıdır; uygulama kodu,
token dosyası (`app/styles/tokens.css`), veritabanı ve v3 paketi değişmez.

| Faz | Durum | Dosya |
|---|---|---|
| V4.0 Audit | kabul edildi | `00-audit.md` |
| V4.1 Görsel yön ve tasarım sistemi | kabul edildi | `01-tasarim-kimligi.md`, `02-tasarim-sistemi.md`, `03-token-goc-haritasi.md`, `04-uygulama-riskleri.md`, `tokens-v4.css`, `ornek/` |
| V4.2 Yüksek kaliteli ekranlar | **görsel onay bekliyor** | `05-ekranlar-v4-2.md`, `ekranlar/`, `ekran-goruntuleri/` (22 + 6), `karsilastirma/` (12) |
| V4.3 Entegrasyon | başlamadı (açık onay gerekir) | — |

## Kararlar (kurum sahibi, V4.0 sonrası)

- **K1:** arayüz Inter; editoryal ses Newsreader (çalışma/sayfa başlıkları,
  alıntı). Belge metni kılavuzun yazı tipiyle; UI tipografisi ve belge
  biçimlendirmesi ayrı.
- **K2:** 761–1199'da 64 px simge rayı (ipucu, erişilebilir ad, klavye);
  geniş masaüstünde etiketli kenar çubuğu; telefonda sabit alt gezinme.
  Uygulamanın bugünkü 88 px rayı bu aşamada değişmez.
- **K3:** Editör + PDF yan yana çalışma alanı v4'e dahil; her çıktıda
  "Önerilen yeni işlev" etiketi. Mevcut "PDF'i aç" ve "Kaynağa sor" değişmez.

## Araçlar

```
node docs/tasarim/asama-4/signature-os-v4/araclar/goc-haritasi.mjs   # 03 göç haritasını yeniden üretir
node docs/tasarim/asama-4/signature-os-v4/ornek/uret.mjs              # örnek bileşen sayfası
node docs/tasarim/asama-4/signature-os-v4/ornek/cek.mjs <klasör>      # açık/koyu PNG (1440)
node docs/tasarim/asama-4/signature-os-v4/ekranlar/uret.mjs           # V4.2 ekranları (9 HTML)
node docs/tasarim/asama-4/signature-os-v4/ekranlar/cek.mjs <klasör>   # 22 ekran + 6 konsept
node docs/tasarim/asama-4/signature-os-v4/ekranlar/olc.mjs            # ölçüm (JSON)
node docs/tasarim/asama-4/signature-os-v4/ekranlar/karsilastir.mjs <v3-klasör> <çıktı>  # v3 ↔ v4
```
