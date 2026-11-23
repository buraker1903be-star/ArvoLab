#!/usr/bin/env python3
"""
PEARSON KORELASYONUNDA GÜÇ — YÜKSEK HASSASİYETLİ BAĞIMSIZ REFERANS.

ArvoLab, r'nin tam yoğunluğunu (Hotelling) Simpson ile integre ediyor.
Büyük N'de yoğunluk ρ çevresinde daralıyor; integralin hâlâ doğru
olduğunu ÇİFT DUYARLIKLA DEĞİL, 40 basamaklı aritmetikle sınamak
gerekiyor. Burada yoğunluk mpmath'in kendi `hyp2f1`'iyle kuruluyor ve
integral mpmath'in uyarlamalı dörtlemesiyle alınıyor; kritik r, SciPy'nin
t niceliğinden geliyor. ArvoLab'ın kodundan hiçbir şey kullanılmıyor.

Çalıştırma: python3 -I scripts/referans/korelasyon-guc-mp.py
Çıktı:      tests/fixtures/korelasyon-guc-mp.json
"""
import json
import os
import sys

import mpmath as mp
import scipy
from scipy import stats

mp.mp.dps = 40


def yogunluk(r, rho, n):
    r = mp.mpf(r)
    rho = mp.mpf(rho)
    n = mp.mpf(n)
    if abs(r) >= 1:
        return mp.mpf(0)
    log = (
        mp.log(n - 2)
        - mp.log(mp.sqrt(2 * mp.pi))
        + mp.loggamma(n - 1)
        - mp.loggamma(n - mp.mpf("0.5"))
        + (n - 1) / 2 * mp.log(1 - rho**2)
        + (n - 4) / 2 * mp.log(1 - r**2)
        - (n - mp.mpf("1.5")) * mp.log(1 - rho * r)
    )
    return mp.e**log * mp.hyp2f1(mp.mpf("0.5"), mp.mpf("0.5"), n - mp.mpf("0.5"), (1 + rho * r) / 2)


def guc(n, rho, alfa, yon):
    """Kritik r, SciPy'nin t niceliğinden: t = r√(n−2)/√(1−r²)."""
    tc = stats.t.ppf(1 - (alfa if yon == "tek" else alfa / 2), n - 2)
    rc = mp.mpf(tc) / mp.sqrt(mp.mpf(tc) ** 2 + n - 2)
    sigma = (1 - mp.mpf(rho) ** 2) / mp.sqrt(n)
    # Tepe noktaları dörtlemeye açıkça veriliyor: dar tepeyi kaçırmasın.
    def bolumler(a, b):
        ara = [a]
        for x in (mp.mpf(rho) - 6 * sigma, mp.mpf(rho), mp.mpf(rho) + 6 * sigma):
            if a < x < b:
                ara.append(x)
        ara.append(b)
        return ara
    ust = mp.quad(lambda r: yogunluk(r, rho, n), bolumler(rc, mp.mpf(1)))
    if yon == "tek":
        return ust
    return ust + mp.quad(lambda r: yogunluk(r, rho, n), bolumler(mp.mpf(-1), -rc))


NOKTALAR = [
    # (ad, rho, alfa, yon, n)  — çözüm ve bir önceki aday çiftleri
    ("r03-iki", 0.3, 0.05, "iki", 84),
    ("r03-iki", 0.3, 0.05, "iki", 83),
    ("r05-tek", 0.5, 0.05, "tek", 31),
    ("r05-tek", 0.5, 0.05, "tek", 30),
    ("r001-iki", 0.01, 0.05, "iki", 78486),
    ("r001-iki", 0.01, 0.05, "iki", 78485),
    # Sonluluk ve büyük N doğruluğu
    ("r001-iki", 0.01, 0.05, "iki", 78500),
    ("r001-iki", 0.01, 0.05, "iki", 100000),
    ("r02-iki", 0.2, 0.05, "iki", 20000),
    # UÇ ρ, KÜÇÜK N: dağılım r = 1 ucunda yoğunlaşıyor ve asimptotik σ
    # yayılımı dar gösteriyor. Ret bölgesinin TAMAMI integre ediliyor.
    ("r099-iki", 0.99, 0.10, "iki", 5),
    ("r099-iki", 0.99, 0.10, "iki", 6),
    ("r099-iki", 0.99, 0.10, "iki", 7),
]

# ρ ± 16σ penceresinin attığı olasılık: düzeltmeden önceki kusurun ölçüsü.
PENCERE_OLCUMU = [("r099-iki", 0.99, 0.10, "iki", 5), ("r099-iki", 0.99, 0.10, "iki", 6)]


def main():
    cikti = {
        "uretim": {
            "python": sys.version.split()[0],
            "mpmath": mp.__version__,
            "scipy": scipy.__version__,
            "basamak": mp.mp.dps,
            "yol": "r'nin tam yoğunluğu (Hotelling) mpmath.hyp2f1 ile; integral mpmath.quad; kritik r SciPy t niceliğinden",
            "tolerans": {"guc": 1e-9},
        },
        "noktalar": [],
    }
    for ad, rho, alfa, yon, n in NOKTALAR:
        p = guc(n, rho, alfa, yon)
        cikti["noktalar"].append({"ad": ad, "rho": rho, "alfa": alfa, "yon": yon, "n": n, "guc": float(p),
                                  "gucMetin": mp.nstr(p, 25)})
        print(f"  {ad:10s} n={n:7d}  guc={mp.nstr(p, 18)}")
    cikti["pencereOlcumu"] = []
    for ad, rho, alfa, yon, n in PENCERE_OLCUMU:
        tc = stats.t.ppf(1 - alfa / 2, n - 2)
        rc = mp.mpf(tc) / mp.sqrt(mp.mpf(tc) ** 2 + n - 2)
        sigma = (1 - mp.mpf(rho) ** 2) / mp.sqrt(n)
        alt = max(rc, mp.mpf(rho) - 16 * sigma)
        tam = guc(n, rho, alfa, yon)
        pencere = mp.quad(lambda r: yogunluk(r, rho, n), [alt, mp.mpf(rho), mp.mpf(1)]) if alt < 1 else mp.mpf(0)
        atilan = tam - pencere
        cikti["pencereOlcumu"].append({
            "ad": ad, "rho": rho, "alfa": alfa, "yon": yon, "n": n,
            "kritikR": float(rc), "pencereAlt": float(alt),
            "tamGuc": float(tam), "pencereyleGuc": float(pencere), "atilanOlasilik": float(atilan),
        })
        print(f"  PENCERE {ad} n={n}: ret bolgesi [{mp.nstr(rc,8)}, 1], pencere [{mp.nstr(alt,8)}, 1], "
              f"atilan={mp.nstr(atilan,8)}")

    yol = os.path.join("tests", "fixtures", "korelasyon-guc-mp.json")
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"yazildi: {yol}")


if __name__ == "__main__":
    main()
