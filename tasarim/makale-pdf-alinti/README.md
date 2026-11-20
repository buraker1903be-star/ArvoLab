# Makale → PDF → Alıntı (20.11.2026)

Canlı testteki Makale Bul, PDF, atıf, AI ve Word bulgularının yeniden üretimi ile tasarım ve
uygulama planı. Bu klasörün eklendiği teslimde ürün kodu değişmedi.

- [`PLAN.md`](PLAN.md): yeniden üretim tablosu, hatalar (B-*), tasarım değişiklikleri (D-*),
  ekran ekran tablo, PR sırası, kararlar.
- [`oneri.html`](oneri.html) ve [`gorseller/oneri.png`](gorseller/oneri.png): görsel öneri.
- `gorseller/bugun-*.png`: bugünkü hâl. Yerel yığında, sentetik veriyle, `next start` ile alındı.
- [`betikler/yeniden-uret.mjs`](betikler/yeniden-uret.mjs): tarayıcıda yeniden üretim betiği.
  Ön koşul: yerel yığın (`scripts/yerel-yigin`), `gecit.mjs`, `model-taklidi.mjs` ve
  `AI_TABAN_URL=http://127.0.0.1:54900/v1` ile başlatılmış `next start -p 3150`. Tohum olarak
  `tasarim/tek-deneyim/betikler/tohum.json` hesapları kullanılır.
- [`betikler/atif-saf-cikti.txt`](betikler/atif-saf-cikti.txt): saf işlevlerle atıf ve puan çıktısı.
- [`yeniden-uretim-sonucu.json`](yeniden-uretim-sonucu.json): betiğin son koşusunun ölçümleri.
