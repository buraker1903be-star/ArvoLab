# GÜÇ ve ÖRNEKLEM — BAĞIMSIZ REFERANS (R: pwr + stats).
#
# ArvoLab'ın güç hesabı kendi merkezi olmayan dağılım kodunu kullanıyor.
# Beklenen değerler o koddan ÜRETİLMEZ: burada R'nin kendi noncentral t /
# noncentral F dağılımları (pt, pf) ve `pwr` paketi kullanılıyor.
#
# İKİ KATMAN:
#   1) Dağılım noktaları: pt(q, df, ncp) ve pf(q, df1, df2, ncp) ızgarası.
#      ArvoLab'ın noncentralTCDF / noncentralFCDF'i bunlara karşı sınanıyor.
#   2) Senaryolar: her yöntem için N ızgarası ve R'nin o N'deki GÜCÜ.
#      En küçük N, R'nin kendi sayılarından türetiliyor; ArvoLab'ın
#      bulduğu N onunla karşılaştırılıyor.
#
# Çalıştırma: Rscript scripts/referans/guc-referans.R
# Çıktı:      tests/fixtures/guc-referans.json

suppressMessages(library(pwr))

say <- function(x) {
  v <- vapply(x, function(y) if (is.na(y) || !is.finite(y)) "null" else formatC(y, digits = 17, format = "g"), "")
  if (length(v) == 1) v else paste0("[", paste(v, collapse = ","), "]")
}
dizi <- function(x) paste0("[", paste(vapply(x, function(y) if (is.na(y) || !is.finite(y)) "null" else formatC(y, digits = 17, format = "g"), ""), collapse = ","), "]")
metin <- function(x) paste0("\"", gsub("\"", "\\\\\"", x), "\"")

# ---- 1) Merkezi olmayan dağılım noktaları ----
t_noktalari <- list()
for (df in c(1, 2, 5, 10, 38, 120)) {
  for (ncp in c(0, 0.5, 2, 2.8, 5)) {
    for (q in c(-2, -0.5, 0, 1, 1.96, 2.6, 4)) {
      t_noktalari[[length(t_noktalari) + 1]] <-
        paste0("{\"df\":", df, ",\"ncp\":", say(ncp), ",\"q\":", say(q), ",\"p\":", say(pt(q, df, ncp)), "}")
    }
  }
}
f_noktalari <- list()
for (d1 in c(1, 2, 3, 5)) {
  for (d2 in c(5, 20, 56, 200)) {
    for (lam in c(0, 1, 7, 12.8, 40)) {
      for (q in c(0.5, 1, 2.5, 4, 8)) {
        f_noktalari[[length(f_noktalari) + 1]] <-
          paste0("{\"df1\":", d1, ",\"df2\":", d2, ",\"lambda\":", say(lam), ",\"q\":", say(q),
                 ",\"p\":", say(pf(q, d1, d2, lam)), "}")
      }
    }
  }
}

# ---- 2) Senaryolar ----
# Güç, R'nin kendi dağılımlarıyla: t ailesinde iki kuyruk da sayılıyor
# (G*Power ve statsmodels böyle yapar).
guc_t <- function(ncp, df, alfa, yon) {
  if (yon == "tek") {
    1 - pt(qt(1 - alfa, df), df, ncp)
  } else {
    tc <- qt(1 - alfa / 2, df)
    (1 - pt(tc, df, ncp)) + pt(-tc, df, ncp)
  }
}
guc_bagimsiz <- function(N, d, alfa, yon, oran = 1) {
  n1 <- max(2, round(N / (1 + oran))); n2 <- max(2, N - n1)
  guc_t(d * sqrt(n1 * n2 / (n1 + n2)), n1 + n2 - 2, alfa, yon)
}
guc_eslestirilmis <- function(N, dz, alfa, yon) guc_t(dz * sqrt(N), N - 1, alfa, yon)
guc_anova <- function(N, k, f, alfa) 1 - pf(qf(1 - alfa, k - 1, N - k), k - 1, N - k, f^2 * N)
guc_regresyon <- function(N, p, f2, alfa) 1 - pf(qf(1 - alfa, p, N - p - 1), p, N - p - 1, f2 * N)
# KORELASYON: r'nin TAM örnekleme yoğunluğu (Hotelling) — G*Power'ın
# "Exact: Bivariate normal model" seçeneğiyle aynı. Yaygın Fisher z
# yaklaşıklığı (pwr.r.test) gücü biraz düşük gösterip bir katılımcı
# fazla istiyor; ikisi de yazılıyor ki fark görülsün.
hyp2f1 <- function(a, b, cc, z) {
  terim <- rep(1, length(z)); toplam <- rep(1, length(z))
  for (k in 0:6000) {
    terim <- terim * ((a + k) * (b + k)) / ((cc + k) * (1 + k)) * z
    toplam <- toplam + terim
    if (all(abs(terim) < 1e-16 * abs(toplam))) break
  }
  toplam
}
r_yogunlugu <- function(r, rho, n) {
  (n - 2) / sqrt(2 * pi) * exp(lgamma(n - 1) - lgamma(n - 0.5)) *
    (1 - rho^2)^((n - 1) / 2) * (1 - r^2)^((n - 4) / 2) * (1 - rho * r)^(-(n - 1.5)) *
    hyp2f1(0.5, 0.5, n - 0.5, (1 + rho * r) / 2)
}
guc_korelasyon <- function(N, r, alfa, yon) {
  if (N < 5) return(0)
  tc <- qt(1 - if (yon == "tek") alfa else alfa / 2, N - 2)
  rc <- tc / sqrt(tc^2 + N - 2)
  ust <- integrate(function(x) r_yogunlugu(x, r, N), rc, 1, rel.tol = 1e-11)$value
  if (yon == "tek") ust else ust + integrate(function(x) r_yogunlugu(x, r, N), -1, -rc, rel.tol = 1e-11)$value
}
guc_korelasyon_fisher <- function(N, r, alfa, yon) {
  z <- atanh(r) * sqrt(N - 3)
  zc <- qnorm(if (yon == "tek") 1 - alfa else 1 - alfa / 2)
  if (yon == "tek") 1 - pnorm(zc - z) else (1 - pnorm(zc - z)) + pnorm(-zc - z)
}

senaryolar <- list(
  list(ad = "bagimsizT-d05", yontem = "bagimsizT", etki = 0.5, alfa = 0.05, hedef = 0.80, yon = "iki", adim = 1,
       guc = function(N) guc_bagimsiz(N, 0.5, 0.05, "iki"),
       pwrN = ceiling(pwr.t.test(d = 0.5, sig.level = 0.05, power = 0.80, type = "two.sample")$n) * 2),
  list(ad = "bagimsizT-d08-tek", yontem = "bagimsizT", etki = 0.8, alfa = 0.05, hedef = 0.90, yon = "tek", adim = 1,
       guc = function(N) guc_bagimsiz(N, 0.8, 0.05, "tek"),
       pwrN = ceiling(pwr.t.test(d = 0.8, sig.level = 0.05, power = 0.90, type = "two.sample", alternative = "greater")$n) * 2),
  list(ad = "bagimsizT-oran2", yontem = "bagimsizT", etki = 0.5, alfa = 0.05, hedef = 0.80, yon = "iki", adim = 1, oran = 2,
       guc = function(N) guc_bagimsiz(N, 0.5, 0.05, "iki", 2), pwrN = NA),
  list(ad = "eslestirilmisT-dz04", yontem = "eslestirilmisT", etki = 0.4, alfa = 0.05, hedef = 0.80, yon = "iki", adim = 1,
       guc = function(N) guc_eslestirilmis(N, 0.4, 0.05, "iki"),
       pwrN = ceiling(pwr.t.test(d = 0.4, sig.level = 0.05, power = 0.80, type = "paired")$n)),
  list(ad = "eslestirilmisT-dz025-tek", yontem = "eslestirilmisT", etki = 0.25, alfa = 0.01, hedef = 0.90, yon = "tek", adim = 1,
       guc = function(N) guc_eslestirilmis(N, 0.25, 0.01, "tek"),
       pwrN = ceiling(pwr.t.test(d = 0.25, sig.level = 0.01, power = 0.90, type = "paired", alternative = "greater")$n)),
  list(ad = "anova-k3-f025", yontem = "tekYonluAnova", etki = 0.25, alfa = 0.05, hedef = 0.80, k = 3, adim = 3,
       guc = function(N) guc_anova(N, 3, 0.25, 0.05),
       pwrN = ceiling(pwr.anova.test(k = 3, f = 0.25, sig.level = 0.05, power = 0.80)$n) * 3),
  list(ad = "anova-k4-f040", yontem = "tekYonluAnova", etki = 0.40, alfa = 0.05, hedef = 0.95, k = 4, adim = 4,
       guc = function(N) guc_anova(N, 4, 0.40, 0.05),
       pwrN = ceiling(pwr.anova.test(k = 4, f = 0.40, sig.level = 0.05, power = 0.95)$n) * 4),
  list(ad = "korelasyon-r03", yontem = "korelasyon", etki = 0.3, alfa = 0.05, hedef = 0.80, yon = "iki", adim = 1,
       guc = function(N) guc_korelasyon(N, 0.3, 0.05, "iki"),
       pwrN = ceiling(pwr.r.test(r = 0.3, sig.level = 0.05, power = 0.80)$n)),
  list(ad = "korelasyon-r05-tek", yontem = "korelasyon", etki = 0.5, alfa = 0.05, hedef = 0.90, yon = "tek", adim = 1,
       guc = function(N) guc_korelasyon(N, 0.5, 0.05, "tek"),
       pwrN = ceiling(pwr.r.test(r = 0.5, sig.level = 0.05, power = 0.90, alternative = "greater")$n)),
  list(ad = "regresyon-p3-f2015", yontem = "regresyon", etki = 0.15, alfa = 0.05, hedef = 0.80, yordayici = 3, adim = 1,
       guc = function(N) guc_regresyon(N, 3, 0.15, 0.05),
       pwrN = ceiling(pwr.f2.test(u = 3, f2 = 0.15, sig.level = 0.05, power = 0.80)$v) + 3 + 1),
  list(ad = "regresyon-p5-f2035", yontem = "regresyon", etki = 0.35, alfa = 0.01, hedef = 0.90, yordayici = 5, adim = 1,
       guc = function(N) guc_regresyon(N, 5, 0.35, 0.01),
       pwrN = ceiling(pwr.f2.test(u = 5, f2 = 0.35, sig.level = 0.01, power = 0.90)$v) + 5 + 1)
)

parcalar <- c()
for (s in senaryolar) {
  # En küçük N: R'nin kendi güç değerlerinden.
  # R'de `$` kısmi eşleşme yapıyor (s$p → pwrN); her yerde [[ ]] kullanılıyor.
  bas <- if (!is.null(s[["k"]])) s[["k"]] * 2 else if (!is.null(s[["yordayici"]])) s[["yordayici"]] + 2 else if (s[["yontem"]] == "eslestirilmisT") 3 else if (s[["yontem"]] == "korelasyon") 5 else 4
  bas <- ceiling(bas / s[["adim"]]) * s[["adim"]]
  enKucuk <- NA
  N <- bas
  while (N <= 100000) {
    if (s[["guc"]](N) >= s[["hedef"]]) { enKucuk <- N; break }
    N <- N + s[["adim"]]
  }
  izgara <- sort(unique(c(seq(max(bas, enKucuk - 5 * s[["adim"]]), enKucuk + 5 * s[["adim"]], by = s[["adim"]]))))
  gucler <- vapply(izgara, s[["guc"]], 0)
  parcalar <- c(parcalar, paste0(
    "{\"ad\":", metin(s[["ad"]]), ",\"yontem\":", metin(s[["yontem"]]),
    ",\"etki\":", say(s[["etki"]]), ",\"alfa\":", say(s[["alfa"]]), ",\"hedefGuc\":", say(s[["hedef"]]),
    ",\"yon\":", metin(if (is.null(s[["yon"]])) "iki" else s[["yon"]]),
    ",\"grupSayisi\":", if (is.null(s[["k"]])) "null" else s[["k"]],
    ",\"yordayiciSayisi\":", if (is.null(s[["yordayici"]])) "null" else s[["yordayici"]],
    ",\"dagilimOrani\":", if (is.null(s[["oran"]])) "null" else say(s[["oran"]]),
    ",\"adim\":", s[["adim"]],
    ",\"enKucukN\":", enKucuk, ",\"ulasilanGuc\":", say(s[["guc"]](enKucuk)),
    ",\"birKucukGuc\":", if (enKucuk - s[["adim"]] >= bas) say(s[["guc"]](enKucuk - s[["adim"]])) else "null",
    ",\"pwrPaketiN\":", if (is.na(s[["pwrN"]])) "null" else s[["pwrN"]],
    ",\"fisherZGuc\":", if (s[["yontem"]] == "korelasyon") say(guc_korelasyon_fisher(enKucuk, s[["etki"]], s[["alfa"]], s[["yon"]])) else "null",
    ",\"izgara\":", dizi(izgara), ",\"izgaraGuc\":", dizi(gucler), "}"))
}

json <- paste0(
  "{\n  \"uretim\": {",
  "\"R\":", metin(paste(R.version$major, R.version$minor, sep = ".")),
  ",\"pwr\":", metin(as.character(packageVersion("pwr"))),
  ",\"yol\":", metin("noncentral t (pt) ve noncentral F (pf); iki kuyruklu t gücünde her iki kuyruk"),
  ",\"korelasyonYolu\":", metin("r'nin tam yoğunluğu (Hotelling, 2F1 serisi) — G*Power Exact ile aynı model"),
  ",\"tolerans\":{\"dagilim\":1e-9,\"guc\":1e-8}",
  "},\n  \"tNoktalari\": [", paste(unlist(t_noktalari), collapse = ","), "],\n",
  "  \"fNoktalari\": [", paste(unlist(f_noktalari), collapse = ","), "],\n",
  "  \"senaryolar\": [\n    ", paste(parcalar, collapse = ",\n    "), "\n  ]\n}\n")
dir.create("tests/fixtures", showWarnings = FALSE, recursive = TRUE)
cat(json, file = "tests/fixtures/guc-referans.json")
cat("yazildi: tests/fixtures/guc-referans.json\n")
for (s in senaryolar) cat(" ", s[["ad"]], "\n")
