#!/usr/bin/env python3
"""
TEKRARLI ÖLÇÜMLER SONRASI İKİLİ KARŞILAŞTIRMALARIN BAĞIMSIZ REFERANSI.

lib/stats-anova-ek.ts'teki tekrarliIkiliKarsilastirmalar, ArvoLab'ın KENDİ
eşleştirilmiş t-testiyle hesaplıyor. Beklenen değerleri aynı fonksiyondan
üretmek, denetimin denetlediği şeye bakmaması olurdu; bu betik değerleri
SciPy (ttest_rel) ve statsmodels (multipletests, method="bonferroni") ile
üretiyor.

Çalıştırma:  python3 scripts/referans/tekrarli-ikili-referans.py
Çıktı:       tests/fixtures/tekrarli-ikili-referans.json

Sürümler koşu sırasında JSON'a yazılır; test dosyası o sürümleri yorumunda
anar. Tolerans: t ve ortalama farkı 1e-6, p 1e-9 (JSON'da da yazılı).
"""
import itertools
import json
import os
import sys

import numpy as np
import scipy
from scipy import stats
import statsmodels
from statsmodels.stats.multitest import multipletests

# ---------------------------------------------------------------- veri setleri
# Hepsi sentetik ve elle yazıldı; bir yayından alınmadı.
VERI = {
    # Üç ölçüm, artan eğilim: en az bir çift anlamlı çıkmalı.
    # Farklar BİLEREK sabit değil; sabit fark t'yi tanımsız yapar (ayrı set).
    "uc_olcum_anlamli": [
        [10, 12, 11, 14, 13, 15, 9, 12, 13, 11],
        [12, 15, 13, 16, 15, 18, 11, 14, 16, 13],
        [15, 18, 17, 19, 19, 21, 13, 18, 19, 15],
    ],
    # Üç ölçüm, gürültü: Bonferroni'den sonra hiçbiri anlamlı olmamalı.
    "uc_olcum_anlamsiz": [
        [8, 7, 9, 6, 8, 7, 9, 8, 7, 8],
        [7, 8, 8, 7, 9, 6, 8, 9, 8, 7],
        [8, 8, 7, 8, 7, 8, 7, 8, 9, 8],
    ],
    # Dört ölçüm (6 çift): karışık yön, negatif farklar da var.
    "dort_olcum_karisik": [
        [20, 22, 19, 25, 21, 23, 18, 24, 20, 22, 21, 19],
        [18, 21, 17, 22, 20, 21, 16, 22, 18, 19, 19, 18],
        [25, 26, 24, 30, 26, 29, 23, 27, 26, 27, 25, 24],
        [19, 22, 18, 23, 21, 22, 18, 23, 19, 20, 21, 18],
    ],
    # Sıra değişimi: yukarıdakinin ölçümleri ters sırada.
    "dort_olcum_ters": None,  # aşağıda kuruluyor
    # p'nin 1'de sınırlanması: ham p büyük, çift sayısıyla çarpılınca 1'i aşar.
    "p_tavani": [
        [5, 6, 7, 8, 9, 10, 11, 12],
        [5.1, 6.2, 6.9, 8.1, 8.8, 10.2, 11.1, 11.9],
        [4.9, 5.9, 7.1, 7.9, 9.2, 9.8, 10.9, 12.1],
    ],
    # SIFIR FARK VARYANSI: her katılımcıda fark tam olarak aynı.
    # SciPy t = ±inf, p = 0 veriyor; ArvoLab'ın davranışı ayrıca sınanıyor.
    "sifir_fark_varyansi": [
        [10, 12, 11, 14, 13, 15, 9, 12],
        [13, 15, 14, 17, 16, 18, 12, 15],
        [11, 14, 12, 16, 14, 18, 10, 14],
    ],
}
VERI["dort_olcum_ters"] = list(reversed(VERI["dort_olcum_karisik"]))

ADLAR = {
    "uc_olcum_anlamli": ["on", "son", "izleme"],
    "uc_olcum_anlamsiz": ["t1", "t2", "t3"],
    "dort_olcum_karisik": ["o1", "o2", "o3", "o4"],
    "dort_olcum_ters": ["o4", "o3", "o2", "o1"],
    "p_tavani": ["a", "b", "c"],
    "sifir_fark_varyansi": ["s1", "s2", "s3"],
}


def sayi(x):
    """JSON sonsuzluk taşıyamaz: tanımsız değerler dizge olarak yazılıyor.

    Sıfır fark varyansında SciPy t = ±inf, p = 0 veriyor; bu, verinin
    kendisinden gelen gerçek bir durum, kayıpsız aktarılmalı."""
    f = float(x)
    if f != f:
        return "NaN"
    if f == float("inf"):
        return "Infinity"
    if f == float("-inf"):
        return "-Infinity"
    return f


def referans(olcumler, adlar):
    """SciPy ttest_rel + statsmodels bonferroni.

    ArvoLab fark olarak (i - j) kullanıyor; ttest_rel(a, b) de a - b veriyor.
    Çift sırası: i < j, satır sırası korunarak."""
    k = len(olcumler)
    ciftler = []
    ham_p = []
    for i, j in itertools.combinations(range(k), 2):
        a = np.asarray(olcumler[i], dtype=float)
        b = np.asarray(olcumler[j], dtype=float)
        sonuc = stats.ttest_rel(a, b)
        ciftler.append(
            {
                "a": adlar[i],
                "b": adlar[j],
                "fark": sayi(np.mean(a - b)),
                "t": sayi(sonuc.statistic),
                "pHam": sayi(sonuc.pvalue),
            }
        )
        ham_p.append(float(sonuc.pvalue))
    # Bonferroni: statsmodels'in kendi uygulaması (min(1, p*m) ile aynı tanım).
    reddedildi, duzeltilmis, _, _ = multipletests(ham_p, alpha=0.05, method="bonferroni")
    for c, p, red in zip(ciftler, duzeltilmis, reddedildi):
        c["p"] = sayi(p)
        c["anlamli"] = bool(red)
    return ciftler


def main():
    cikti = {
        "uretim": {
            "python": sys.version.split()[0],
            "scipy": scipy.__version__,
            "numpy": np.__version__,
            "statsmodels": statsmodels.__version__,
            "komutlar": [
                "scipy.stats.ttest_rel(a, b)  # t ve iki kuyruklu ham p",
                "numpy.mean(a - b)            # ortalama fark",
                "statsmodels.stats.multitest.multipletests(p, alpha=0.05, method='bonferroni')",
            ],
            "tolerans": {"fark": 1e-6, "t": 1e-6, "p": 1e-9},
            "not": "Veri setleri sentetik; bir yayından alınmadı.",
        },
        "setler": {},
    }
    for ad, olcumler in VERI.items():
        cikti["setler"][ad] = {
            "olcumler": olcumler,
            "adlar": ADLAR[ad],
            "ciftler": referans(olcumler, ADLAR[ad]),
        }
    yol = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "tekrarli-ikili-referans.json")
    yol = os.path.normpath(yol)
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")
    print(f"yazildi: {yol}")
    for ad, s in cikti["setler"].items():
        anlamli = sum(1 for c in s["ciftler"] if c["anlamli"])
        print(f"  {ad}: {len(s['ciftler'])} çift, {anlamli} anlamlı")


if __name__ == "__main__":
    main()
