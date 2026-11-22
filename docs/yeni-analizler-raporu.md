# Yeni istatistiksel yöntemler — envanter ve geliştirme önerisi

22.11.2026. Bu rapor **ayrı teslim**: önerilen yöntemlerin hiçbiri bu
tasarım paketinde uygulanmadı, ürün ekranına yol haritası konmadı.
Gezgindeki liste yalnızca gerçekten hesaplanan 25 analizi gösteriyor
(bkz. `docs/analiz-envanteri.md`).

Her yöntem için: **var mı**, kullanıcı ihtiyacı ve öncelik, hesaplama
bağımlılıkları ve teknik maliyet, varsayımlar ve destek sınırları,
bağımsız referansla doğrulama planı, tarayıcıda çalışmaya uygunluk.

## Önce düzeltilmesi gereken: istenen altı yöntemin dördü ZATEN VAR

Kurum sahibinin listesindeki ilk dört kalemin büyük bölümü 25 analizin
içinde çalışıyor ve arayüze bağlı. Bunları yeniden geliştirmek emek
kaybı olur.

| İstenen | Durum | Nerede |
|---|---|---|
| **Welch t-testi** | **VAR.** Levene düşünce bağımsız örneklem t-testinin yanında kendiliğinden yazılıyor | `welchTTest`, `stats-tests-core.ts`; dal: `data-analyzer.tsx` t-testi |
| **Welch ANOVA** | **VAR.** Varyanslar ayrışınca tek yönlü ANOVA'nın yanında | `welchAnova`, `stats-tests-core.ts` |
| **Tukey HSD** | **VAR.** ANOVA post hoc; studentized range dağılımı kendi içinde | `tukeyHSD`, `stats-tukey.ts` |
| **Games–Howell** | **VAR.** Varyanslar ayrışınca Tukey yerine | `gamesHowell`, `stats-tukey.ts` |
| **Çoklu karşılaştırma** | **VAR (kısmen).** Bonferroni ve Welch-Bonferroni ikili karşılaştırmaları; tekrarlı ölçümlerde de ikili karşılaştırma | `bonferroniKarsilastirmalari`, `welchBonferroniKarsilastirmalari`, `tekrarliIkiliKarsilastirmalar` |
| **Fisher kesin testi** | **VAR.** 2×2 tabloda beklenen değer 5'in altına düşünce ki-karenin yanında | `fisherKesinTesti`, `stats-tests-core.ts` |
| **McDonald ω** | **YOK** | — |
| **Güç ve örneklem büyüklüğü** | **YOK** | — |

Çoklu karşılaştırmada **gerçek boşluk** şudur: Bonferroni ve
Games–Howell var, ama **Kruskal-Wallis sonrası Dunn**, **Friedman
sonrası ikili karşılaştırma** ve **karma ANOVA'da gruplar arası post
hoc** yok. Ayrıca `tekrarliIkiliKarsilastirmalar`ın bağımsız doğrulaması
eksik — bu bir geliştirme değil, **önce kapatılması gereken bir test
boşluğu**.

---

## A. Birinci aşama — yakın vadede değerli ve tarayıcıda uygun

### A1. `tekrarliIkiliKarsilastirmalar` için doğrulama testi

- **Var mı:** Fonksiyon var, **testi yok**.
- **İhtiyaç / öncelik:** **En yüksek.** Ekranda görünen, teze giren bir
  çıktı bağımsız bir uygulamaya karşı hiç sınanmadı. Yeni bir yöntem
  eklemekten önce gelir: var olanın doğruluğu, olmayanın yokluğundan
  önemlidir.
- **Bağımlılık / maliyet:** Yok. Yalnızca test dosyası; yarım gün.
- **Varsayım / sınır:** Yöntem değişmiyor.
- **Doğrulama planı:** `pingouin.pairwise_tests` (paired=True,
  padjust='bonf') çıktısıyla t, p_ham ve p_düzeltilmiş karşılaştırması;
  3 ve 4 ölçümlü iki veri seti.
- **Tarayıcı:** Uygun (zaten çalışıyor).

### A2. McDonald ω (omega)

- **Var mı:** Yok. Yalnızca Cronbach α var.
- **İhtiyaç / öncelik:** **Yüksek.** Ölçek geliştirme ve uyarlama
  tezlerinde hakemler artık α ile birlikte ω istiyor; α maddelerin eşit
  yük varsayımına dayanıyor, ω bu varsayımı gerektirmiyor. ArvoLab'ın
  DFA'sı zaten standart yükleri üretiyor — ω bu yüklerden hesaplanıyor.
- **Bağımlılık / maliyet:** **Düşük.** `dogrulayiciFaktorAnalizi`
  çıktısındaki standart yükler ve hata varyansları yeterli:
  ω = (Σλ)² / ((Σλ)² + Σθ). Tek faktörlü model için doğrudan; çok
  faktörlüde faktör başına ω. Yeni bir kestirim altyapısı gerekmiyor;
  1–2 gün.
- **Varsayım / sınır:** Tek faktörlü (tek boyutlu) yapı varsayımı. Çok
  boyutlu ölçekte toplam ω yanıltıcıdır; **faktör başına** verilmeli ve
  tek boyutluluk sağlanmamışsa bu yazılmalı. Kategorik maddelerde
  (2–3'lü Likert) ML yükleri sapar.
- **Doğrulama planı:** R `psych::omega` ve `semTools::reliability`
  çıktıları; üç veri seti (tek faktör, iki faktör, ters kodlanmış madde
  içeren). Jamovi'nin "Reliability Analysis → McDonald's ω" sonucu
  ikinci bağımsız kaynak.
- **Tarayıcı:** Uygun — DFA kestirimi zaten tarayıcıda çalışıyor, ω onun
  üstüne basit bir toplam.

### A3. Kruskal-Wallis sonrası Dunn + Friedman sonrası ikili karşılaştırma

- **Var mı:** Yok.
- **İhtiyaç / öncelik:** **Yüksek.** Şu anda program "gruplar arasında
  fark var" diyor ama **hangi ikili** arasında olduğunu söylemiyor;
  öğrenci bu noktada ya SPSS'e gidiyor ya da anlamlı testi raporlayıp
  farkı yorumlayamıyor. Parametrik tarafta (Tukey/Games–Howell) bu
  boşluk kapalı, parametrik olmayan tarafta açık.
- **Bağımlılık / maliyet:** **Düşük.** `siralandir` (bağlı sıra
  düzeltmesiyle) ve `normalIkiKuyrukP` zaten var. Dunn: sıra
  ortalamaları farkı / bağ düzeltmeli standart hata, ardından
  Bonferroni ya da Holm. Friedman sonrası: Wilcoxon/Nemenyi.
  2–3 gün.
- **Varsayım / sınır:** Dunn bağlı sıralarda düzeltme gerektirir;
  düzeltmesiz uygulama p'yi küçültür. Çok küçük gruplarda (n < 5)
  yaklaşıklık zayıf — mevcut `YAKLASIKLIK_EN_AZ` uyarısıyla aynı dilde
  bildirilmeli.
- **Doğrulama planı:** `scikit-posthocs.posthoc_dunn` (p_adjust='holm'
  ve 'bonferroni'), Friedman için `scikit-posthocs.posthoc_nemenyi_friedman`;
  bağlı sıra içeren ve içermeyen iki veri seti.
- **Tarayıcı:** Uygun.

### A4. Güç ve örneklem büyüklüğü planlaması

- **Var mı:** Yok.
- **İhtiyaç / öncelik:** **Yüksek ama ayrı bir ekran.** Etik kurul
  başvurusunda ve yöntem bölümünde örneklem gerekçesi isteniyor; şu anda
  öğrenci G*Power indiriyor. Önemli ayrım: bu **veri gerektirmeyen** bir
  araç — kullanıcı etki büyüklüğü, α ve güç girer, n çıkar. Analiz
  çalışma alanının "veri yükle → değişken seç → hesapla" akışına
  girmiyor; ona zorlamak ikisini de bozar.
- **Bağımlılık / maliyet:** **Orta.** Merkezi olmayan t, F ve χ²
  dağılımları gerekiyor. `stats-math.ts`'te `incompleteBeta`, `gammaP`,
  `chiSquareCDF`, `tTestTwoTailedP`, `fTestP` var; **merkezi olmayan
  (noncentral) karşılıkları yok** ve asıl iş o. İlk sürüm dört testle
  sınırlanabilir: bağımsız/eşleştirilmiş t, tek yönlü ANOVA, korelasyon,
  ki-kare. 1–2 hafta.
- **Varsayım / sınır:** Güç analizi **beklenen** etki büyüklüğüne
  dayanır; bu sayı kullanıcının kuramsal kararıdır, veriden
  kestirilemez. Toplanmış veriden hesaplanan "post hoc güç" yaygın bir
  hatadır ve **sunulmamalı** — sunulacaksa açıkça kötü bir uygulama
  olduğu yazılmalı. ArvoLab'ın "asistan sayı üretmez" kuralıyla
  tutarlı olması için etki büyüklüğü varsayılanı **kullanıcıdan**
  alınmalı, Cohen eşikleri yalnızca açıklama olarak gösterilmeli.
- **Doğrulama planı:** G*Power 3.1'in bastığı n değerleri (yaygın
  senaryoların tablosu), `statsmodels.stats.power`
  (`TTestIndPower`, `FTestAnovaPower`), R `pwr` paketi. Üç kaynağın
  ikisinde aynı n çıkmalı.
- **Tarayıcı:** Uygun — hesap küçük, veri yok.

---

## B. İkinci aşama — değerli ama ağır; tarayıcı uygunluğu sınırlı

### B1. MANOVA / MANCOVA

- **Var mı:** Yok. Yardım akışı bunu **açıkça** söylüyor ve ayrı
  ANOVA'ları eşdeğer olarak sunmuyor (`lib/analiz-onerisi.ts`).
- **İhtiyaç / öncelik:** **Orta.** Birden çok bağımlı değişkenli
  desenler eğitim ve psikoloji tezlerinde sık; ama öğrencilerin çoğu
  ayrı ANOVA'larla Bonferroni düzeltmesi yaparak da hakem karşısına
  çıkabiliyor.
- **Bağımlılık / maliyet:** **Orta-yüksek.** SSCP matrisleri, Wilks Λ,
  Pillai izi, Hotelling–Lawley, Roy en büyük kökü; Λ'dan F
  yaklaşıklığı (Rao). Matris tersi (`tersAl`) ve öz ayrıştırma
  (`ozAyristir`, `stats-faktor.ts`) **zaten var** — asıl iş genelleştirilmiş
  öz değer problemi ve F yaklaşıklıkları. 2–3 hafta.
- **Varsayım / sınır:** Çok değişkenli normallik ve kovaryans
  matrislerinin homojenliği (Box M). Box M aşırı duyarlıdır; "düştü,
  o yüzden MANOVA yapamazsın" demek yanlış olur — Pillai izi dirençli
  olduğu için o öneriliyor. Bu nüans arayüzde yazılmalı, yoksa
  kullanıcı testi terk eder.
- **Doğrulama planı:** `statsmodels.multivariate.manova.MANOVA`
  (dört istatistiğin tamamı), R `car::Manova` (Tip II/III); en az üç
  veri seti (dengeli, dengesiz, iki bağımlı değişkenli).
- **Tarayıcı:** Uygun (matris boyutları değişken sayısıyla sınırlı,
  gözlem sayısıyla değil).

### B2. Karma etkili modeller (çok düzeyli / mixed-effects)

- **Var mı:** Yok. Karma ANOVA var ama o **dengeli ve eksiksiz** veri
  isteyen klasik bir desen; karma etkili model eksik gözlemi ve
  dengesiz tekrarı kaldırır.
- **İhtiyaç / öncelik:** **Orta.** Boylamsal ve kümelenmiş (sınıf içi
  öğrenci) desenlerde doğru araç bu; ama bu tezlerin oranı görece az ve
  yorumlanması danışman desteği gerektiriyor.
- **Bağımlılık / maliyet:** **YÜKSEK.** REML kestirimi, rastgele etki
  kovaryans yapıları, yakınsama denetimi, Satterthwaite ya da
  Kenward–Roger serbestlik derecesi. ArvoLab'da hiç olmayan bir
  optimizasyon katmanı gerekiyor (DFA'nın BFGS'i örnek, ama REML daha
  kırılgan). 4–6 hafta ve sürekli bakım.
- **Varsayım / sınır:** Model belirtimi kullanıcının kararı (hangi etki
  rastgele?). Yanlış belirtilmiş bir karma model **sessizce** yakınsar
  ve yanlış p üretir. Yakınsamama durumunun kullanıcıya dürüstçe
  bildirilmesi zorunlu; "sonuç yok" demek, kötü bir sonuç vermekten
  iyidir.
- **Doğrulama planı:** R `lme4::lmer` + `lmerTest` (Satterthwaite),
  Python `statsmodels.MixedLM`; iki kaynağın katsayı ve SH'lerinde
  uyuşma. En az dört senaryo: rastgele kesme; rastgele kesme + eğim;
  eksik gözlemli boylamsal; iki düzeyli kümelenmiş.
- **Tarayıcı:** **Sınırlı.** Orta boy veride (binlerce satır, birkaç
  rastgele etki) iterasyon maliyeti sekmeyi dondurabilir; Web Worker'a
  taşımak ve iterasyon/süre sınırı koymak gerekir. Bu yöntem
  seçilirse mimari kararı (worker) ondan önce verilmeli.

### B3. ROC analizi ve eğri altı alan (AUC)

- **Var mı:** Yok.
- **İhtiyaç / öncelik:** **Orta.** Sağlık bilimleri, tanı/tarama ölçeği
  ve kesme noktası belirleme çalışmalarında doğrudan gerekli; eğitim
  bilimlerinde seyrek. İkili lojistik regresyon zaten var, ROC onun
  doğal tamamlayıcısı.
- **Bağımlılık / maliyet:** **Düşük-orta.** Eğri ve AUC yalnızca
  sıralama ve trapez toplamı; AUC = Mann-Whitney U'nun yeniden
  ölçeklenmişi, yani `mannWhitneyU` zaten temeli veriyor. Hanley–McNeil
  ya da DeLong standart hatası ve GA; Youden J ile kesme noktası.
  1 hafta.
- **Varsayım / sınır:** Kesme noktası önerisi **duyarlılık ve
  seçiciliğin eşit ağırlıklı** olduğunu varsayar; klinik maliyetler
  eşit değildir. Tek bir "en iyi kesme noktası" sunmak yanlış olur —
  tablo verilmeli ve seçim kullanıcının olmalı. Aynı veride hem kesme
  noktası belirleyip hem başarımını raporlamak iyimser kestirim üretir;
  bu yazılmalı.
- **Doğrulama planı:** `sklearn.metrics.roc_auc_score` ve `roc_curve`,
  R `pROC::roc` (DeLong GA ile); bağlı değer içeren ve içermeyen iki
  veri seti.
- **Tarayıcı:** Uygun.

### B4. Sağkalım analizi (Kaplan–Meier, log-rank, Cox)

- **Var mı:** Yok.
- **İhtiyaç / öncelik:** **Düşük-orta.** ArvoLab'ın ağırlık merkezi
  (eğitim, sosyal bilimler, psikoloji tezleri) ile en az örtüşen
  yöntem; tıp ve hemşirelik tezlerinde ise vazgeçilmez.
- **Bağımlılık / maliyet:** Kaplan–Meier ve log-rank **düşük**
  (sayım ve ağırlıklı karşılaştırma; Greenwood SH). Cox orantılı
  tehlikeler **orta-yüksek**: kısmi olabilirlik, Newton-Raphson,
  bağlı olay düzeltmeleri (Efron/Breslow). Aşamalı yapılabilir:
  önce KM + log-rank (1 hafta), Cox sonra (3 hafta).
- **Varsayım / sınır:** **Veri biçimi farklı** — süre + olay
  göstergesi; sağdan sansürleme kavramı kullanıcıya anlatılmalı.
  Cox'ta orantılı tehlikeler varsayımı sınanmazsa sonuç yanıltıcıdır
  (Schoenfeld artıkları gerekir); varsayım denetimi olmadan Cox
  sunulmamalı.
- **Doğrulama planı:** `lifelines` (`KaplanMeierFitter`,
  `logrank_test`, `CoxPHFitter`), R `survival::survfit`/`coxph`;
  sansürlü ve sansürsüz, bağlı olaylı veri setleri.
- **Tarayıcı:** KM/log-rank uygun; Cox orta boy veride uygun, çok
  büyük veride worker gerekir.

---

## Öneri — sıra

1. **A1** (`tekrarliIkiliKarsilastirmalar` testi) — yarım gün, en yüksek
   getiri: var olan bir çıktının doğruluğunu güvence altına alır.
2. **A2** (McDonald ω) — mevcut DFA altyapısının üstüne düşük maliyetle
   oturuyor, hakem talebi somut.
3. **A3** (Dunn + Friedman post hoc) — parametrik tarafta kapalı olan
   boşluğu parametrik olmayan tarafta da kapatır; mevcut yardımcılar
   yeterli.
4. **A4** (güç/örneklem) — ayrı ekran olarak; merkezi olmayan
   dağılımlar yazılmalı.
5. **B3** (ROC) — `mannWhitneyU` üzerine düşük maliyetli, lojistik
   regresyonu tamamlar.
6. **B1** (MANOVA) — matris altyapısı hazır; Box M nüansı arayüz işi.
7. **B4** (KM + log-rank, sonra Cox) — kullanıcı tabanına bağlı.
8. **B2** (karma etkili modeller) — en ağır; önce Web Worker mimarisi
   kararı.

Her kalem için ortak kural: **bağımsız referansla doğrulanmadan
arayüze bağlanmaz.** Mevcut 25 analizin 23'ü bu kuralla geldi
(`pingouin`, `statsmodels`, SciPy, `lavaan`, SPSS); yeni yöntemler de
aynı eşikten geçmeli. Yarım çalışan bir yöntemi seçenek olarak sunmak,
hiç sunmamaktan kötüdür: öğrenci onu tezine koyar.
