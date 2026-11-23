# McDONALD OMEGA — BAĞIMSIZ REFERANS (R + lavaan + semTools).
#
# ArvoLab'ın omega hesabı kendi DFA kestirimine (lib/stats-dfa.ts) dayanıyor.
# Beklenen değerler o koddan ÜRETİLMEZ: burada lavaan tek faktörlü modeli
# kendi en çok olabilirlik kestirimiyle kuruyor, omega'yı semTools veriyor.
#
# MODEL:    tek faktör, bütün maddeler ona yüklenir, hatalar ilişkisiz,
#           faktör varyansı 1'e sabit (std.lv = TRUE) — ArvoLab ile aynı.
# KESTİRİM: ML. likelihood = "wishart" (S'nin paydası n − 1), ArvoLab ile aynı.
# EKSİK VERİ: listwise — ArvoLab da bütün maddeleri dolu satırları kullanıyor.
# OMEGA:    ham madde toplam puanı için ω = (Σλ)² / ((Σλ)² + Σθ),
#           standartlaştırılmamış yükler ve madde ölçeğindeki hata
#           varyanslarıyla. Standartlaştırılmış karşılığı ayrıca yazılıyor
#           (ω_std); farklı madde varyanslarında ikisi AYRILIR ve test bu
#           ayrımı sınıyor.
#
# Çalıştırma: Rscript scripts/referans/omega-referans.R
# Çıktı:      tests/fixtures/omega-referans.json

suppressMessages({ library(lavaan); library(semTools) })

cikti_yolu <- "tests/fixtures/omega-referans.json"

# ---- JSON yazıcı (bağımlılık eklememek için elle) ----
say <- function(x) {
  if (length(x) == 0) return("[]")
  if (is.null(x)) return("null")
  v <- vapply(x, function(y) if (is.na(y) || !is.finite(y)) "null" else formatC(y, digits = 17, format = "g"), "")
  if (length(v) == 1) v else paste0("[", paste(v, collapse = ","), "]")
}
metin <- function(x) paste0("\"", gsub("\"", "\\\\\"", x), "\"")
metinler <- function(x) paste0("[", paste(vapply(x, metin, ""), collapse = ","), "]")

set.seed(20261123)

# ---- Veri setleri ----
# Hepsi sentetik; bir yayından alınmadı. Maddeler tamsayıya YUVARLANMIYOR:
# TS tarafı aynı sayıları okuyacak.
tek_faktor <- function(n, lambda, theta_sd, taban = 0) {
  f <- rnorm(n)
  sapply(seq_along(lambda), function(j) taban + lambda[j] * f + rnorm(n, sd = theta_sd[j]))
}

veri <- list()
# 1) Benzer varyanslı altı madde.
veri$esitVaryans <- tek_faktor(200, lambda = c(.8, .75, .7, .85, .65, .78), theta_sd = rep(.6, 6))
# 2) FARKLI madde varyansları: ham ve standartlaştırılmış omega ayrılsın.
veri$farkliVaryans <- tek_faktor(180, lambda = c(3.0, 0.4, 1.6, 0.25, 2.2), theta_sd = c(2.4, 0.3, 1.1, 0.5, 1.7))
# 3) İki madde: omega için model tanımlanamaz, alfa çalışmalı.
veri$ikiMadde <- tek_faktor(150, lambda = c(.8, .75), theta_sd = c(.6, .6))
# 4) Bir madde TERS yönlü (çevrilmemiş): ham toplam puanda omega düşmeli.
{
  d <- tek_faktor(160, lambda = c(.8, .75, .7, .85), theta_sd = rep(.5, 4))
  d[, 3] <- 6 - d[, 3]
  veri$tersMadde <- d
}
# 5) İki madde BİREBİR aynı: kovaryans tekil.
{
  d <- tek_faktor(120, lambda = c(.8, .7, .75), theta_sd = rep(.5, 3))
  veri$tekil <- cbind(d, d[, 1])
}
# 6) Eksik veri: bazı hücreler NA; liste bazlı eleme ile kullanılan n azalır.
{
  d <- tek_faktor(140, lambda = c(.8, .7, .75, .82), theta_sd = rep(.55, 4))
  d[3, 2] <- NA; d[10, 1] <- NA; d[10, 4] <- NA; d[77, 3] <- NA
  veri$eksikVeri <- d
}

alfa_degeri <- function(X) {
  k <- ncol(X)
  S <- cov(X)
  (k / (k - 1)) * (1 - sum(diag(S)) / sum(S))
}

hesapla <- function(ad, X) {
  adlar <- paste0("m", seq_len(ncol(X)))
  colnames(X) <- adlar
  df <- as.data.frame(X)
  tam <- df[stats::complete.cases(df), , drop = FALSE]
  n_tam <- nrow(tam)
  dusen <- nrow(df) - n_tam
  alpha <- tryCatch(alfa_degeri(as.matrix(tam)), error = function(e) NA_real_)

  sonuc <- list(ad = ad, n_satir = nrow(df), n = n_tam, dusen = dusen,
                madde = ncol(X), adlar = adlar, alpha = alpha,
                durum = "tamam", omega = NA_real_, omega_std = NA_real_,
                omega_semtools = NA_real_, lambda = numeric(0), theta = numeric(0),
                yakinsadi = FALSE)

  if (ncol(X) < 3) { sonuc$durum <- "az-madde"; return(sonuc) }

  model <- paste0("F =~ ", paste(adlar, collapse = " + "))
  fit <- tryCatch(
    cfa(model, data = tam, std.lv = TRUE, likelihood = "wishart", missing = "listwise", estimator = "ML"),
    error = function(e) NULL, warning = function(w) NULL)
  if (is.null(fit) || !lavInspect(fit, "converged")) { sonuc$durum <- "kestirilemedi"; return(sonuc) }

  est <- parameterEstimates(fit)
  lambda <- est$est[est$op == "=~"]
  theta <- est$est[est$op == "~~" & est$lhs == est$rhs & est$lhs != "F"]
  sonuc$lambda <- lambda
  sonuc$theta <- theta
  sonuc$yakinsadi <- TRUE
  if (any(theta <= 0)) { sonuc$durum <- "gecersiz-hata-varyansi"; return(sonuc) }

  sonuc$omega <- sum(lambda)^2 / (sum(lambda)^2 + sum(theta))
  std <- standardizedSolution(fit)
  l_std <- std$est.std[std$op == "=~"]
  sonuc$omega_std <- sum(l_std)^2 / (sum(l_std)^2 + sum(1 - l_std^2))
  rel <- tryCatch(semTools::reliability(fit), error = function(e) NULL)
  if (!is.null(rel) && "omega" %in% rownames(rel)) sonuc$omega_semtools <- unname(rel["omega", 1])
  sonuc
}

parcalar <- c()
veri_parcalari <- c()
for (ad in names(veri)) {
  r <- hesapla(ad, veri[[ad]])
  parcalar <- c(parcalar, paste0(
    "{\"ad\":", metin(r$ad),
    ",\"nSatir\":", r$n_satir, ",\"n\":", r$n, ",\"dusen\":", r$dusen,
    ",\"maddeSayisi\":", r$madde, ",\"adlar\":", metinler(r$adlar),
    ",\"durum\":", metin(r$durum),
    ",\"alpha\":", say(r$alpha),
    ",\"omega\":", say(r$omega),
    ",\"omegaStd\":", say(r$omega_std),
    ",\"omegaSemTools\":", say(r$omega_semtools),
    ",\"lambda\":", say(r$lambda), ",\"theta\":", say(r$theta),
    ",\"yakinsadi\":", tolower(as.character(r$yakinsadi)), "}"))
  # Ham veri: TS tarafı AYNI sayıları okusun (NA -> null).
  X <- veri[[ad]]
  sutunlar <- apply(X, 2, function(s) paste0("[", paste(vapply(s, function(v) if (is.na(v)) "null" else formatC(v, digits = 17, format = "g"), ""), collapse = ","), "]"))
  veri_parcalari <- c(veri_parcalari, paste0("\"", ad, "\":[", paste(sutunlar, collapse = ","), "]"))
}

json <- paste0(
  "{\n  \"uretim\": {",
  "\"R\":", metin(paste(R.version$major, R.version$minor, sep = ".")),
  ",\"lavaan\":", metin(as.character(packageVersion("lavaan"))),
  ",\"semTools\":", metin(as.character(packageVersion("semTools"))),
  ",\"model\":", metin("F =~ m1 + ... + mk ; std.lv = TRUE ; hatalar ilişkisiz"),
  ",\"kestirim\":", metin("lavaan::cfa(estimator = \"ML\", likelihood = \"wishart\", missing = \"listwise\")"),
  ",\"omegaFormulu\":", metin("(sum(lambda))^2 / ((sum(lambda))^2 + sum(theta)) — ham madde toplam puanı"),
  ",\"tolerans\":{\"omega\":1e-6,\"alpha\":1e-9,\"lambda\":1e-5,\"theta\":1e-5}",
  ",\"not\":", metin("Veri setleri sentetik; set.seed(20261123). Sayılar bu dosyadan okunuyor."),
  "},\n  \"setler\": [\n    ", paste(parcalar, collapse = ",\n    "), "\n  ],\n",
  "  \"veri\": {", paste(veri_parcalari, collapse = ","), "}\n}\n")

dir.create(dirname(cikti_yolu), showWarnings = FALSE, recursive = TRUE)
cat(json, file = cikti_yolu)
cat("yazildi:", cikti_yolu, "\n")
for (p in parcalar) {
  o <- regmatches(p, regexpr("\"ad\":\"[^\"]+\"", p))
  cat(" ", o, "\n")
}
