# Eski kaynaklar için onaylı düzeltme önerisi (20.11.2026)

**Bağımlılık:** M1 dalı (`claude/m1-atif-dogrulugu`; `lib/html-varlik.ts`).

- Toplu dönüştürme YOK. Kaynak listesinde yazar biçimi belirsiz
  ("A. Smith and B. Jones", "et al.", ad önce) ya da kaynakça için alanı eksik
  olan, DOI'li kayıtlarda "Dizinden düzeltme öner" düğmesi çıkar.
- Öneri, Crossref'teki kayıtla **alan alan farkı** gösterir (şimdiki / dizindeki).
  Dizinde boş alan önerilmez (hiçbir alan silinmez); yalnızca biçim farkı
  (boşluk, büyük/küçük harf, HTML varlığı, tire türü) öneri sayılmaz.
- Başlangıçta **hiçbir alan işaretli değil**; öğrenci seçer, "Seçilenleri uygula".
- Uygulama sunucuda dizini **yeniden sorgular** ve yalnızca seçilen alanları
  dizinin şu anki değeriyle yazar; istemciden gelen değer künyeye yazılmaz.
  DOI sorgusu `lookupDoi`'nin kapılarından (oturum, abonelik, saatlik hak) geçer.

Kabul: `node tasarim/eski-kaynak-duzeltme/betikler/kabul.mjs` — **6/6**, canlı
Crossref ile (sunucu `NODE_USE_ENV_PROXY=1` ile başlatılmalı).
