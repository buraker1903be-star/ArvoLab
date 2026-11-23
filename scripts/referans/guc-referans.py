#!/usr/bin/env python3
"""
GÜÇ ve ÖRNEKLEM — İKİNCİ BAĞIMSIZ REFERANS (Python: statsmodels + SciPy).

R referansı (scripts/referans/guc-referans.R) ile aynı senaryolar, başka
bir uygulamayla. Ayrıca KORELASYONDA Monte-Carlo: ArvoLab ve `pwr` Fisher z
yaklaşıklığını kullanıyor, G*Power'ın "Exact" seçeneği r'nin tam örnekleme
dağılımını kullanıyor. Benzetim, yaklaşıklığın gerçek güçten ne kadar
ayrıldığını ÖLÇÜYOR — varsayımla geçiştirilmiyor.

Çalıştırma: python3 -I scripts/referans/guc-referans.py
Çıktı:      tests/fixtures/guc-referans-python.json
"""
import json
import os
import sys

import numpy as np
import scipy
import statsmodels
from scipy import stats
from statsmodels.stats.power import FTestAnovaPower, FTestPower, TTestIndPower, TTestPower

SENARYOLAR = [
    {"ad": "bagimsizT-d05", "yontem": "bagimsizT", "etki": 0.5, "alfa": 0.05, "yon": "iki", "N": 128},
    {"ad": "bagimsizT-d08-tek", "yontem": "bagimsizT", "etki": 0.8, "alfa": 0.05, "yon": "tek", "N": 55},
    {"ad": "eslestirilmisT-dz04", "yontem": "eslestirilmisT", "etki": 0.4, "alfa": 0.05, "yon": "iki", "N": 52},
    {"ad": "eslestirilmisT-dz025-tek", "yontem": "eslestirilmisT", "etki": 0.25, "alfa": 0.01, "yon": "tek", "N": 211},
    {"ad": "anova-k3-f025", "yontem": "tekYonluAnova", "etki": 0.25, "alfa": 0.05, "k": 3, "N": 159},
    {"ad": "anova-k4-f040", "yontem": "tekYonluAnova", "etki": 0.40, "alfa": 0.05, "k": 4, "N": 112},
    {"ad": "korelasyon-r03", "yontem": "korelasyon", "etki": 0.3, "alfa": 0.05, "yon": "iki", "N": 84},
    {"ad": "korelasyon-r05-tek", "yontem": "korelasyon", "etki": 0.5, "alfa": 0.05, "yon": "tek", "N": 31},
    {"ad": "regresyon-p3-f2015", "yontem": "regresyon", "etki": 0.15, "alfa": 0.05, "p": 3, "N": 77},
    {"ad": "regresyon-p5-f2035", "yontem": "regresyon", "etki": 0.35, "alfa": 0.01, "p": 5, "N": 71},
]

YON = {"iki": "two-sided", "tek": "larger"}


def guc(s, N):
    y = s["yontem"]
    if y == "bagimsizT":
        n1 = round(N / 2)
        return float(TTestIndPower().power(effect_size=s["etki"], nobs1=n1, alpha=s["alfa"], ratio=(N - n1) / n1,
                                           alternative=YON[s["yon"]]))
    if y == "eslestirilmisT":
        return float(TTestPower().power(effect_size=s["etki"], nobs=N, alpha=s["alfa"], alternative=YON[s["yon"]]))
    if y == "tekYonluAnova":
        return float(FTestAnovaPower().power(effect_size=s["etki"], nobs=N, alpha=s["alfa"], k_groups=s["k"]))
    if y == "regresyon":
        # DİKKAT: statsmodels'te df_num/df_denom adları TERS (kendi belgesi de
        # uyarıyor): df_num payda, df_denom pay. nc = f² × (df_num+df_denom+1) = f² × N.
        return float(FTestPower().power(effect_size=np.sqrt(s["etki"]), df_num=N - s["p"] - 1, df_denom=s["p"],
                                        alpha=s["alfa"]))
    # Korelasyon: statsmodels'te karşılığı yok; Fisher z kapalı formu.
    z = np.arctanh(s["etki"]) * np.sqrt(N - 3)
    zc = stats.norm.ppf(1 - (s["alfa"] if s["yon"] == "tek" else s["alfa"] / 2))
    ust = 1 - stats.norm.cdf(zc - z)
    return float(ust if s["yon"] == "tek" else ust + stats.norm.cdf(-zc - z))


def korelasyon_benzetim(N, r, alfa, yon, tur=400000, tohum=20261123):
    """r'nin TAM dağılımından güç: iki değişkenli normalden örnek çekip test ediliyor."""
    rng = np.random.default_rng(tohum)
    x = rng.standard_normal((tur, N))
    y = r * x + np.sqrt(1 - r * r) * rng.standard_normal((tur, N))
    xm = x - x.mean(axis=1, keepdims=True)
    ym = y - y.mean(axis=1, keepdims=True)
    rs = (xm * ym).sum(axis=1) / np.sqrt((xm * xm).sum(axis=1) * (ym * ym).sum(axis=1))
    t = rs * np.sqrt(N - 2) / np.sqrt(np.maximum(1 - rs * rs, 1e-300))
    if yon == "tek":
        red = t > stats.t.ppf(1 - alfa, N - 2)
    else:
        red = np.abs(t) > stats.t.ppf(1 - alfa / 2, N - 2)
    p = float(red.mean())
    return {"guc": p, "standartHata": float(np.sqrt(p * (1 - p) / tur)), "tur": tur}


def main():
    cikti = {
        "uretim": {
            "python": sys.version.split()[0],
            "statsmodels": statsmodels.__version__,
            "scipy": scipy.__version__,
            "numpy": np.__version__,
            "yol": "statsmodels TTestIndPower / TTestPower / FTestAnovaPower / FTestPower; korelasyon Fisher z (SciPy)",
            "not": "Korelasyonda ayrıca Monte-Carlo: Fisher z yaklaşıklığının gerçek güçten sapması ölçülüyor.",
        },
        "senaryolar": [],
        "korelasyonBenzetimi": [],
    }
    for s in SENARYOLAR:
        N = s["N"]
        cikti["senaryolar"].append({"ad": s["ad"], "N": N, "guc": guc(s, N), "birKucukGuc": guc(s, N - 1)})
    for s in SENARYOLAR:
        if s["yontem"] != "korelasyon":
            continue
        for N in (s["N"] - 1, s["N"]):
            b = korelasyon_benzetim(N, s["etki"], s["alfa"], s["yon"])
            cikti["korelasyonBenzetimi"].append({"ad": s["ad"], "N": N, "fisherZ": guc(s, N), **b})
    yol = os.path.join("tests", "fixtures", "guc-referans-python.json")
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"yazildi: {yol}")
    for s in cikti["senaryolar"]:
        print(f"  {s['ad']:26s} N={s['N']:5d} guc={s['guc']:.6f}")
    for b in cikti["korelasyonBenzetimi"]:
        print(f"  BENZETIM {b['ad']} N={b['N']}: fisherZ={b['fisherZ']:.4f} benzetim={b['guc']:.4f} ± {1.96*b['standartHata']:.4f}")


if __name__ == "__main__":
    main()
