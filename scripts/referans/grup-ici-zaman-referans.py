#!/usr/bin/env python3
"""
KARMA ANOVA'DA GRUP İÇİ ZAMAN ETKİSİNİN BAĞIMSIZ REFERANSI.

Etkileşim anlamlıysa ArvoLab her grup için ayrı bir tekrarlı ölçümler
ANOVA'sı çalıştırıyor; küresellik gerektiğinde Greenhouse-Geisser
düzeltmesini uyguluyor ve PAY/PAYDA serbestlik derecelerini de o grubun
kendi epsilon'uyla düzeltiyor. Ekranda görünen serbestlik dereceleri
(df × ε) ve aile içi Bonferroni düzeltmeli p (p_GG × grup sayısı) burada
ArvoLab'ın kodundan BAĞIMSIZ olarak pingouin ile üretiliyor.

Çalıştırma:  python3 -I scripts/referans/grup-ici-zaman-referans.py
Çıktı:       tests/fixtures/grup-ici-zaman-referans.json

İki veri seti, ikisi de tarayıcı kabulündeki dosyalarla BİREBİR aynı
(scripts/yerel-yigin/analiz-alani-kabul.mjs):
  tekilKovaryans — S11.karma, ölçümler on/son/tekil (tekil = on + 3):
                   kovaryans tekil, Mauchly hesaplanamıyor, GG yine
                   üretilebiliyor; p çok küçük olduğu için ekranda
                   "p < 0,001" yazıyor, serbestlik dereceleri sayı.
  ggUygulanan    — S11.ggUygulanan: küresellik GERÇEKTEN bozuk (Mauchly
                   p < .05) ve GG üretilebiliyor; Bonferroni sonrası p
                   iki grupta da ekranda SAYI olarak basılıyor, biri
                   anlamlı biri değil. Düzeltilmiş sd ve p'nin ikisi de
                   bu veri setinde karşılaştırılıyor.
"""
import json
import os
import sys

import numpy as np
import pandas as pd
import pingouin as pg
import scipy

# --- Veri seti 1: S11.karma (tekil kovaryans) ---------------------------
KARMA_ON = [10, 12, 11, 14, 13, 15, 9, 12, 13, 11, 10, 14, 11, 13, 12, 15]
KARMA_SON = [12, 15, 13, 16, 15, 18, 11, 14, 16, 13, 12, 17, 13, 16, 14, 18]
KARMA_TEKIL = [v + 3 for v in KARMA_ON]  # ön testin sabit kaydırılmışı
KARMA_GRUPLAR = ["deney" if i % 2 == 0 else "kontrol" for i in range(16)]

# --- Veri seti 2: S11.ggUygulanan (küresellik bozuk, GG üretilebilir) ---
# İlk 12 satır deney, son 12 satır kontrol. Üçüncü ölçümün hata varyansı
# kasten çok büyük: fark varyansları eşit olmadığı için Mauchly düşüyor.
GG_ON = [51, 58, 46, 47, 50, 52, 47, 49, 48, 59, 51, 51, 48, 51, 55, 53, 53, 54, 47, 44, 53, 46, 58, 43]
GG_ARA = [58, 65, 51, 54, 54, 59, 53, 57, 55, 63, 55, 59, 50, 50, 56, 53, 52, 57, 49, 46, 54, 49, 59, 41]
GG_SON = [73, 58, 51, 54, 56, 56, 68, 56, 70, 67, 67, 62, 54, 46, 56, 43, 55, 57, 47, 43, 53, 47, 57, 42]
GG_GRUPLAR = ["deney"] * 12 + ["kontrol"] * 12


def cerceve(gruplar, olcum_adlari, diziler):
    satirlar = []
    for i, g in enumerate(gruplar):
        for ad, dizi in zip(olcum_adlari, diziler):
            satirlar.append({"katilimci": f"K{i + 1}", "grup": g, "olcum": ad, "deger": float(dizi[i])})
    return pd.DataFrame(satirlar)


def sutun(r, *adlar):
    for ad in adlar:
        if ad in r.index:
            return r[ad]
    raise KeyError(adlar)


def grup_ici(df, grup, grup_sayisi):
    alt = df[df["grup"] == grup]
    r = pg.rm_anova(data=alt, dv="deger", within="olcum", subject="katilimci", correction=True, detailed=False).iloc[0]
    eps = float(sutun(r, "eps"))
    ddof1, ddof2 = int(r["ddof1"]), int(r["ddof2"])
    pGG = float(sutun(r, "p_GG_corr", "p-GG-corr"))
    pSpher = float(sutun(r, "p_spher"))
    return {
        "grup": grup,
        "n": int(alt["katilimci"].nunique()),
        "F": float(r["F"]),
        "ddof1": ddof1,
        "ddof2": ddof2,
        "eps": eps,
        "mauchly_p": None if not np.isfinite(pSpher) else pSpher,
        "kuresellik_bozuk": bool(np.isfinite(pSpher) and pSpher < 0.05),
        "p_unc": float(sutun(r, "p_unc", "p-unc")),
        "p_GG": pGG,
        # Ekranda görünmesi beklenenler:
        "beklenen_df1": round(ddof1 * eps, 2),
        "beklenen_df2": round(ddof2 * eps, 2),
        "beklenen_p_bonferroni": min(1.0, pGG * grup_sayisi),
    }


def etkilesim_p(df):
    mx = pg.mixed_anova(data=df, dv="deger", within="olcum", between="grup", subject="katilimci")
    satir = mx[mx["Source"] == "Interaction"].iloc[0]
    return float(sutun(satir, "p_unc", "p-unc"))


def veri_seti(ad, gruplar, olcum_adlari, diziler, not_metni):
    df = cerceve(gruplar, olcum_adlari, diziler)
    grup_adlari = sorted(set(gruplar))
    return {
        "ad": ad,
        "olcumler": olcum_adlari,
        "gruplar": grup_adlari,
        "grupSayisi": len(grup_adlari),
        "etkilesim_p": etkilesim_p(df),
        "not": not_metni,
        "gruptaZaman": [grup_ici(df, g, len(grup_adlari)) for g in grup_adlari],
    }


def main():
    cikti = {
        "uretim": {
            "python": sys.version.split()[0],
            "pingouin": pg.__version__,
            "scipy": scipy.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "komutlar": [
                "pingouin.rm_anova(dv='deger', within='olcum', subject='katilimci', correction=True)",
                "pingouin.mixed_anova(dv='deger', within='olcum', between='grup', subject='katilimci')",
                "ekran_df = ddof x eps (iki ondalık) ; ekran_p = min(1, p_GG x grup_sayisi)",
            ],
            "tolerans": {"df": 0.01, "p": 1e-6, "F": 0.01},
            "not": "Veri setleri sentetik; tarayıcı kabulündeki dosyalarla birebir aynı.",
        },
        "veriSetleri": [
            veri_seti(
                "tekilKovaryans",
                KARMA_GRUPLAR,
                ["on", "son", "tekil"],
                [KARMA_ON, KARMA_SON, KARMA_TEKIL],
                "tekil = on + 3; Mauchly hesaplanamıyor, GG üretilebiliyor.",
            ),
            veri_seti(
                "ggUygulanan",
                GG_GRUPLAR,
                ["on", "ara", "son"],
                [GG_ON, GG_ARA, GG_SON],
                "Küresellik gerçekten bozuk; GG üretilebiliyor ve Bonferroni sonrası p ekranda sayı.",
            ),
        ],
    }
    yol = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "grup-ici-zaman-referans.json")
    )
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(cikti, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")
    print(f"yazildi: {yol}")
    for vs in cikti["veriSetleri"]:
        print(f"{vs['ad']}: etkilesim p = {vs['etkilesim_p']:.2e}")
        for g in vs["gruptaZaman"]:
            print(
                f"   {g['grup']}: F({g['beklenen_df1']}, {g['beklenen_df2']}) = {g['F']:.2f}, "
                f"eps = {g['eps']:.4f}, Mauchly p = {g['mauchly_p']}, Bonferroni p = {g['beklenen_p_bonferroni']:.5f}"
            )


if __name__ == "__main__":
    main()
