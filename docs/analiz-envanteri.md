# Analiz Merkezi envanteri — mevcut 25 analiz

22.11.2026. Kaynak: `app/dashboard/analysis/data-analyzer.tsx` (hesaplama
dalları ve değişken alanları), `lib/stats-*.ts` (hesap fonksiyonları),
`tests/unit/stats-*.test.ts` (doğrulama).

Bu envanter **okunarak** çıkarıldı; ekranda yazan adlar hesaplama
desteğiyle tek tek eşleştirildi. Aynı yöntemin seçenekleri (Welch
düzeltmesi, Tukey/Games–Howell, Fisher kesin testi, paralel/seri
aracılık) ayrı ana analiz sayılmadı — bunlar var olan analizlerin
içinde, koşula göre çalışan yollar.

## Özet

| | |
|---|---|
| Ekranda ayrı ana analiz | **25** (`lib/analiz-turleri.ts`, `ANALIZ_ETIKETLERI`) |
| Hesaplama dalı olan | 25 / 25 |
| Hesap fonksiyonu bağımsız bir uygulamaya karşı sınanan | 23 / 25 |
| Hiç doğrudan testi olmayan hesap fonksiyonu | 2 (`tekrarliIkiliKarsilastirmalar`, `describeNumeric`) |
| Varsayım şeridi (normallik + Levene) çizilen | 6 analiz |
| %95 güven aralığı yazılan | 6 analiz |
| Etki büyüklüğü yazılan | 13 analiz |

Desteklenen veri biçimleri: **`.xlsx`, `.xls`, `.csv`, `.tsv`, `.txt`**
(`data-analyzer.tsx`, dosya girdisi). `.sav` okunmuyor. Hesap
tarayıcıda yapılıyor; dosya sunucuya gitmiyor.

## 1. Betimsel istatistikler

| Alan | Durum |
|---|---|
| Ekrandaki ad | Betimsel İstatistikler |
| Hesap | `describeNumeric` (`stats-tests-core.ts`); ayrıca `normallikOlcutu`, `shapiroWilk`, `leveneTesti` |
| Gerekli değişken | Yok — bütün sayısal sütunlar birlikte özetlenir |
| Araştırma düzeni | Düzen aramaz |
| Varsayım kontrolü | Normallik ölçütü ve Shapiro–Wilk her sütun için yazılır (burada varsayım değil, betimleme) |
| Üretilen | n, ortalama, SS, ortanca, en küçük/en büyük, çarpıklık, basıklık |
| GA / etki | — / — |
| Doğrulama | `describeNumeric` doğrudan çağrılmıyor; alt parçaları (`mean`, `sd`, `median`, çarpıklık/basıklık) SPSS'e karşı sınanıyor (`stats-tests-core.test.ts`, `stats-varsayim.test.ts`) |
| Eksik / kısmi | Ortalamanın güven aralığı yok. `describeNumeric` için ayrı bir test yok (alt parçalar üzerinden dolaylı) |

## 2–4. t-Testleri

### Bağımsız Örneklem t-Testi
| Alan | Durum |
|---|---|
| Hesap | `independentTTest`, varyanslar ayrışırsa ayrıca `welchTTest` (`stats-tests-core.ts`) |
| Gerekli değişken | Grup değişkeni (kategorik, 2 düzey) + sayısal değişken |
| Düzeni | Bağımsız gruplar |
| Varsayım | `varsayimSeridi` (grup başına normallik + Shapiro–Wilk) ve `leveneTesti`; **Levene düşerse Welch sonucu da yazılır** |
| Üretilen | t, df, p, grup ortalamaları/SS/n, ortalama farkı |
| GA | **%95 GA** (farkın alt/üst sınırı) |
| Etki | **Cohen d** + Cohen eşiklerine göre yorum |
| Doğrulama | SPSS ve `pingouin` (`ttest`) çıktılarına karşı; Welch ayrıca sınanıyor (`stats-tests-core.test.ts`, 5 Welch çağrısı) |
| Eksik | Cohen d'nin güven aralığı yok |

### Eşleştirilmiş Örneklem t-Testi
| Alan | Durum |
|---|---|
| Hesap | `eslestirilmisTTest` (`stats-tests-core.ts`); satır hizası `lib/veri-eslestirme.ts` ile korunuyor |
| Gerekli değişken | Önceki ölçüm + sonraki ölçüm (iki sayısal sütun) |
| Düzeni | Aynı kişilerin iki ölçümü |
| Varsayım | **Farkların** normalliği (`normallikOlcutu`) — doğru olan budur |
| Üretilen | t, df, p, ortalamalar, fark ortalaması ve SS |
| GA | **%95 GA** |
| Etki | Cohen d (fark üzerinden) |
| Doğrulama | `pingouin` / SPSS'e karşı |

### Tek Örneklem t-Testi
| Alan | Durum |
|---|---|
| Hesap | `tekOrneklemTTest` (`stats-anova-ek.ts`) |
| Gerekli değişken | Sayısal değişken + karşılaştırılacak değer (kullanıcı yazar) |
| Varsayım | `varsayimSeridi` (tek dizi: normallik; Levene yok — doğru) |
| Üretilen | t, df, p, ortalama, SS, farkın kendisi |
| GA | **%95 GA** |
| Etki | Cohen d |
| Doğrulama | `pingouin` / `statsmodels` |

## 5–9. ANOVA / ANCOVA

### Tek Yönlü ANOVA
| Alan | Durum |
|---|---|
| Hesap | `oneWayAnova`; varyanslar ayrışırsa `welchAnova`. Post hoc: `tukeyHSD`, `gamesHowell`, `bonferroniKarsilastirmalari`, `welchBonferroniKarsilastirmalari` (`stats-tukey.ts`, `stats-tests-core.ts`) |
| Gerekli değişken | Grup değişkeni (kategorik, 3+ düzey) + sayısal değişken |
| Varsayım | `varsayimSeridi` + `leveneTesti`; **Levene düşerse Welch ANOVA ve Games–Howell** |
| Üretilen | F, df, p, grup betimleri, kareler toplamı tablosu, ikili karşılaştırmalar |
| GA | — (post hoc farklarının GA'sı yazılmıyor) |
| Etki | **η²** + yorum |
| Doğrulama | `pingouin` (`pairwise_tukey`), `statsmodels`, SciPy `studentized_range` (n = 3…60 aralığında) |
| Eksik | Post hoc fark GA'ları, ω² yok |

### İki Yönlü ANOVA
| Alan | Durum |
|---|---|
| Hesap | `ikiYonluAnova`, `basitEtkiler` (`stats-iki-yonlu-anova.ts`) |
| Gerekli değişken | 1. faktör + 2. faktör (ikisi kategorik) + sayısal değişken |
| Varsayım | `varsayimSeridi` **hücre düzeyinde** (her faktör birleşimi ayrı) |
| Üretilen | İki ana etki + etkileşim (F, df, p), hücre ortalamaları, dengeli/dengesiz bildirimi, anlamlı etkileşimde basit etkiler |
| GA | — |
| Etki | Her etki için **kısmi η²**; model R² |
| Doğrulama | 38 assert; `statsmodels` ile aynı sayıların elde edilmesi (dosyada referans adı geçmiyor, sayı sabitleri doğrudan yazılı) |
| Eksik | Dengesiz desende yalnızca Tip III'e dayanan tek yol var; kullanıcıya tip seçimi sunulmuyor |

### Tekrarlı Ölçümler ANOVA
| Alan | Durum |
|---|---|
| Hesap | `tekrarliOlcumlerAnova`, `tekrarliIkiliKarsilastirmalar` (`stats-anova-ek.ts`) |
| Gerekli değişken | 3+ ölçüm sütunu |
| Varsayım | **Küresellik**: Greenhouse–Geisser ve Huynh–Feldt epsilon değerleri hesaplanıyor |
| Üretilen | F, df, p (düzeltilmiş df'lerle birlikte), ikili karşılaştırmalar |
| GA | — |
| Etki | **Kısmi η²** |
| Doğrulama | `pingouin` / `statsmodels`; **`tekrarliIkiliKarsilastirmalar` için doğrudan test YOK** |
| Eksik | Bu ikili karşılaştırmaların bağımsız doğrulaması eksik (aşağıdaki "Boşluklar") |

### Karma ANOVA (gruplar arası × tekrarlı)
| Alan | Durum |
|---|---|
| Hesap | `karmaAnova` (`stats-anova-ek.ts`) |
| Gerekli değişken | Grup değişkeni + 2+ ölçüm sütunu |
| Varsayım | Küresellik epsilonları; `leveneTesti` |
| Üretilen | Gruplar arası etki, tekrarlı etki, etkileşim |
| GA | Kısmen (bazı çıktılarda) |
| Etki | Epsilon düzeltmeleri; kısmi η² |
| Doğrulama | `pingouin` / `statsmodels` |
| Eksik | Üç ve daha çok gruplu desende post hoc yok |

### Kovaryans Analizi (ANCOVA)
| Alan | Durum |
|---|---|
| Hesap | `ancova` (`stats-anova-ek.ts`) |
| Gerekli değişken | Grup değişkeni + bağımlı değişken + kovaryat(lar) |
| Varsayım | Hata durumları ayrı ("az-grup", "az-gozlem", "tekil"); **eğim homojenliği (grup × kovaryat) hesaplanıyor** (`egimF`, `egimDf1`, `egimDf2`, `egimP`) |
| Üretilen | Düzeltilmiş ortalamalar, her etki için F/df/p |
| GA | — |
| Etki | **Kısmi η²** |
| Doğrulama | `pingouin` / `statsmodels`; SPSS'in düzeltilmiş kestirimleriyle karşılaştırma. Eğim homojenliği `statsmodels` iç içe model karşılaştırmasıyla sınanıyor (`stats-anova-ek.test.ts`: F = 0,169305, p = 0,846233, sd 2/12) |
| Eksik | Düzeltilmiş ortalamaların güven aralığı yok |

## 10–14. Korelasyon / Regresyon

### Pearson Korelasyonu
`pearsonCorrelation` · değişken 1 + değişken 2 · r, df, p, n, **r²**, r yorumu · GA yok · doğrulama: SPSS/`pingouin`. **Eksik: r'nin Fisher-z güven aralığı yok.**

### Spearman Sıra Korelasyonu
`spearmanKorelasyonu` (`stats-parametrik-olmayan.ts`, `siralandir` ile bağlı sıralar düzeltmesi) · aynı iki değişken · r_s, df, p, n · doğrulama: R / `scipy`.

### Kısmi Korelasyon
`kismiKorelasyon` (`stats-iliski.ts`) · değişken 1 + değişken 2 + kontrol değişken(ler)i · r, df, p · doğrulama: `pingouin`. **Pearson tabanlı** — sıralı değişkenler için Spearman karşılığı yok.

### Doğrusal Regresyon
`dogrusalRegresyon` (`stats-regresyon.ts`, `tersAl`/`enKucukKareler`) · bağımlı değişken (Y) + yordayıcılar · katsayılar (B, SH, β, t, p), **R², düzeltilmiş R²**, model F/df/p, tekillik bildirimi · doğrulama: `statsmodels` OLS (8 çağrı). **Eksik: katsayı GA'ları, VIF ve artık grafikleri ekranda değil.**

### İkili Lojistik Regresyon
`lojistikRegresyon` (`stats-lojistik.ts`) · bağımlı değişken (iki kategorili) + olay kategorisi + yordayıcılar · B, SH, Wald, p, **Exp(B)** ve **Exp(B) %95 GA**, **Nagelkerke R²**; hata durumları ayrı ("tek-sinif", "az-gozlem", "tekil", "ayrisma") · doğrulama: `statsmodels` Logit, sabit veri dosyasıyla (`tests/fixtures/lojistik-verisi`). **Yalnızca İKİLİ sonuç; çok kategorili (multinom) ve sıralı lojistik yok.**

## 15–20. Parametrik olmayan testler

| Analiz | Hesap | Gerekli | Üretilen | Etki | Doğrulama |
|---|---|---|---|---|---|
| Mann-Whitney U | `mannWhitneyU` | grup + sayısal | U, z, p, sıra ortalamaları; n < 8'de yaklaşıklık uyarısı (`YAKLASIKLIK_EN_AZ`) | sıra-nokta korelasyonu | R / `scipy` |
| Kruskal-Wallis H | `kruskalWallis` | grup (3+) + sayısal | H, df, p, sıra ortalamaları | **ε²** | R / `scipy` |
| Wilcoxon İşaretli Sıralar | `wilcoxonIsaretliSiralar` | önceki + sonraki ölçüm | W, z, p, pozitif/negatif sıra sayıları | sıra-nokta korelasyonu | `statsmodels` (W = 8 örneği) |
| Friedman | `friedmanTesti` | 3+ ölçüm | χ², df, p, sıra ortalamaları | **Kendall W** | R / `scipy` |
| McNemar | `mcnemar` | önceki + sonraki (iki kategorili) | χ², p, 2×2 tablo; süreklilik düzeltmesi | — | `statsmodels` (`exact=True`) |
| Ki-Kare Bağımsızlık | `chiSquareIndependence`; varsayım düşer ve tablo 2×2 ise `fisherKesinTesti` | iki kategorik değişken | χ², df, p, gözlenen/beklenen tablo, beklenen < 5 uyarısı | **Cramér V** | SPSS; Fisher `statsmodels` (6 çağrı) |

**Eksik:** tek örneklem Wilcoxon, Cochran Q, Kruskal-Wallis sonrası
Dunn post hoc, Friedman sonrası ikili karşılaştırma yok.

## 21–23. Güvenilirlik / Faktör analizi

### Güvenilirlik (Cronbach Alpha)
`cronbachAlpha` (`stats-tests-core.ts`) · madde sütunları · **α**, madde sayısı, madde-toplam korelasyonları (düzeltilmiş), "madde silinirse α", 0,30 altı ve negatif değer uyarısı · doğrulama: SPSS (8 çağrı). **Eksik: McDonald ω yok; α'nın güven aralığı yok.**

### Açımlayıcı Faktör Analizi
`aciklayiciFaktorAnalizi` (`stats-faktor.ts`: `ozAyristir` + `varimax`) · madde sütunları + istenen faktör sayısı (isteğe bağlı) · öz değerler, **KMO** ve yorumu, Bartlett, döndürülmüş yükler, açıklanan varyans yüzdeleri, düşük (<0,30) ve binişik (<0,10 fark) madde uyarıları; hata durumları ayrı · doğrulama: SciPy (ham yükler). **Eksik: yalnızca varimax; eğik döndürme (promax/oblimin) ve paralel analiz yok.**

### Doğrulayıcı Faktör Analizi
`dogrulayiciFaktorAnalizi` (`stats-dfa.ts`) · faktör yapısı (ad + madde listeleri) + hata kovaryansları · standart yükler, χ²/df, **CFI, TLI, RMSEA, SRMR, GFI, AGFI** ve her birinin yorumu (`uyumYorumu`), değişiklik indeksleri (eşik 3,84); hata durumları ayrı · doğrulama: `lavaan`/AMOS tanımlarıyla, SciPy BFGS ile bağımsız çözüm karşılaştırması (18 assert). **Eksik: RMSEA güven aralığı yok; yalnızca sürekli gösterge varsayımı (ML).**

## 24–25. Aracılık / Düzenleyicilik

### Aracılık
`aracilik` (tek aracı) ve `cokluAracilik` (paralel Model 4, seri Model 6; `stats-aracilik.ts`) · X + Y + aracı(lar) + isteğe bağlı kontrol değişkenleri · a, b, c, c′ yolları, dolaylı etki, **bootstrap %95 GA** (5000 örnek, sabit tohum `20261027` — aynı veri aynı sonucu verir), seri modelde zincir sırası, karşıtlıklar, R² · doğrulama: `pingouin` (5000 örnek), `statsmodels` (6 çağrı). Paralel en çok 10, seri en çok 4 aracı.

### Düzenleyicilik
`duzenleyicilik` (`stats-aracilik.ts`) · X + W + Y + isteğe bağlı kontrol değişkenleri · etkileşim katsayısı, merkezlenmiş değişkenler, koşullu etkiler (W'nin düzeylerinde), **bootstrap GA** · doğrulama: `statsmodels` t-testleriyle. **Eksik: Johnson–Neyman aralığı yok.**

## Boşluklar — doğrulanmış özet

1. ~~`tekrarliIkiliKarsilastirmalar` hiç test edilmiyor.~~ **Kapatıldı
   (23.11.2026).** SciPy `ttest_rel` ve statsmodels `multipletests`
   ("bonferroni") ile bağımsız referanslara karşı sınanıyor
   (`tests/unit/stats-tekrarli-ikili.test.ts`, referanslar
   `scripts/referans/tekrarli-ikili-referans.py` ile üretiliyor).
   Doğrulanan: ortalama farkı, t, düzeltilmiş p, anlamlılık, çift
   sayısı ve etiketler; üç ve dört ölçüm, anlamlı/anlamsız sonuçlar,
   negatif fark, ölçüm sırası değişimi ve p'nin 1'de sınırlanması.
   **Hesap doğru çıktı** — SciPy/statsmodels ile toleranslar içinde
   birebir. Sınır durumlarında iki kusur bulundu ve düzeltildi
   (aşağıda, "Düzeltilen kusurlar").
2. **`describeNumeric` için doğrudan test yok** (alt parçaları SPSS'e
   karşı sınanıyor, dolaylı kapsam).
3. **Güven aralığı yalnızca 6 analizde:** üç t-testi, lojistik Exp(B),
   aracılık/düzenleyicilik bootstrap. Korelasyon r, η², Cohen d,
   Cronbach α, RMSEA ve regresyon katsayıları için GA yok.
4. ~~ANCOVA'da eğim homojenliği sınanmıyor.~~ **Bu madde yanlıştı
   (23.11.2026 düzeltmesi).** Üç başlık ayrı ayrı denetlendi ve üçü de
   karşılanıyor: *hesap* `lib/stats-anova-ek.ts`'te (`egimF`, `egimDf1`,
   `egimDf2`, `egimP`); *arayüzde gösterim* ANCOVA sonucunun altında, F,
   sd ve p ile birlikte ve varsayım bozuksa uyarı tonuyla
   ("varsayım sağlanmıyor; kovaryatın etkisi gruplarda farklı, ANCOVA
   sonucu yanıltıcı olabilir"); *test* `stats-anova-ek.test.ts` içinde
   `statsmodels` iç içe model karşılaştırmasına karşı. Envanterin ilk
   sürümü bu üçünü ayırmadan "eksik" demişti.
5. **Post hoc eksikleri:** Kruskal-Wallis (Dunn), Friedman (ikili),
   karma ANOVA'da gruplar arası.
6. **Varsayım şeridi yalnızca 6 analizde çiziliyor** (betimsel, iki
   bağımsız/eşleştirilmiş/tek örneklem t-testi, tek yönlü ANOVA, iki
   yönlü ANOVA). Regresyon, korelasyon ve lojistikte varsayım bilgisi
   yok ya da yalnızca metin olarak var.

Mevcut yetenekler arasında "arayüzde var ama hesabı yok" **hiçbir
analiz bulunmadı**: 25 adın 25'i gerçekten hesaplanıyor.

## Düzeltilen kusurlar (23.11.2026)

Bağımsız doğrulama sırasında bulunan ve aynı pakette kapatılan iki
kusur. İkisi de hesabın kendisinde değil, **hesaplanamayan durumun
bildirilmesinde**:

1. **Hesaplanamayan çift "anlamlı değil" diye görünüyordu.** Farkların
   varyansı sıfırken (her katılımcıda tam olarak aynı değişim) t
   tanımsız kalıyor; `p` NaN olduğu için `anlamli` false oluyordu ve
   ekranda satır "anlamlı değil" diye bitiyordu. Bulunabilecek en güçlü
   örüntü, kullanıcıya raporlanmaması gereken bir sonuç gibi
   görünüyordu. Artık çift `engel` alanı taşıyor ("sabit-fark" /
   "az-gozlem") ve arayüz sebebi yazıyor.
2. **Eşleşmeyen uzunluk sessizce kırpılıyordu.** Eşleştirilmiş t fazla
   gözlemi atıyor; farklı uzunluktaki ölçümlerde her çift başka bir n
   ile hesaplanıyor ve Bonferroni ailesi tutarsız kalıyordu. Arayüz
   zaten satırları eşleştirerek veriyor (`lib/veri-eslestirme.ts`,
   liste bazlı eleme + "N = … (x satır düştü)" notu); doğrudan çağrı
   artık hata veriyor. Etiket sayısı ölçüm sayısından azsa da hata
   veriliyor (eskiden `undefined` etiketli çift üretiliyordu).

Sonuç tablosunun başlığı çoklu karşılaştırma düzeltmesinin adını açıkça
yazıyor: "İkili karşılaştırmalar (eşleştirilmiş t, **Bonferroni
düzeltmesi**)".
