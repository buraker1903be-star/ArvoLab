"""
ArvoLab logosunun KOYU TEMA varyantı (Signature OS 4.3, 05.11.2026).

Kurum sahibinin kuralı: koyu temada ARVO beyaz, LAB orijinal yeşilinde
kalır; logonun tamamını beyaza çeviren CSS filtresi kullanılmaz. Resmî
bir koyu varyant yok; bu betik orijinal dosyadan TEKNİK bir varyant
üretir, yeni logo çizmez:
  - lacivert (ARVO) pikseller beyaza kaydırılır,
  - yeşil (LAB) pikseller olduğu gibi kalır (birebir aynı RGB),
  - saydamlık (alfa) birebir aynıdır: kenar yumuşatması ve boyut korunur.
İki renk arasındaki her piksel lacivert→yeşil doğrusu üzerindeki yerine
göre kaydırılır; yeşile yakın olanlar (t > 0.7) dokunulmadan kalır.

Çalıştırma: python3 scripts/logo-koyu-varyant.py
Girdi public/arvolab-logo.png, çıktı public/arvolab-logo-koyu.png.
"""
import numpy as np
from PIL import Image

kaynak = np.array(Image.open("public/arvolab-logo.png").convert("RGBA")).astype(float)
rgb, alfa = kaynak[..., :3], kaynak[..., 3]
opak = alfa > 250
lacivert = rgb[opak & (rgb[..., 1] < 60)].mean(0)
yesil = rgb[opak & (rgb[..., 1] > 130)].mean(0)
d = yesil - lacivert
t = np.clip(((rgb - lacivert) @ d) / (d @ d), 0, 1)
t = np.where(t > 0.7, 1.0, t)[..., None]
cikti = rgb + (1 - t) * (np.array([255.0, 255.0, 255.0]) - lacivert)
sonuc = np.dstack([cikti.clip(0, 255), alfa]).round().astype(np.uint8)
Image.fromarray(sonuc, "RGBA").save("public/arvolab-logo-koyu.png", optimize=True)

k = np.array(Image.open("public/arvolab-logo-koyu.png").convert("RGBA")).astype(int)
o = kaynak.astype(int)
ym = opak & (rgb[..., 1] > 130)
lm = opak & (rgb[..., 1] < 60)
print("yeşil piksel:", int(ym.sum()), "değişen:", int((np.abs(k[ym][:, :3] - o[ym][:, :3]).max(-1) > 0).sum()))
print("alfa birebir:", bool((k[..., 3] == o[..., 3]).all()), "| ARVO ortalama:", k[lm][:, :3].mean(0).round().tolist())
