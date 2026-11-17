# RC06n — PR #106 sonrası gerçek dizin kabulü (yanlış "doğrulandı")

- **Aday:** `design/os5` @ `aaa05613bad12808f25e1181fcdda2eeb3e289be` (PR #106 birleşimi; ebeveynler `a0b6834` + `418b14a`).
- **Birleştirme öncesi:** PR #106 HEAD `418b14a880b41ecd44e80c685d2d1cfe064cab58`; iki `kontrol` işi başarılı (44153492756, 44153404642). Yalnızca `design/os5`'e birleştirildi.
- **Push CI (GitHub Actions):** Kontrol #1047, run 44155659888, `success`.
- **Vercel Preview (ayrı):** `dpl_7KnPgqfon8vPeCWmTaD6W6M5VHXa`, `READY`.
- **Derleme:** temiz worktree, `npm ci` + `next build` → BUILD_ID `qYarcy0SbYqXO9_amILVC`; `next start` sunucu HTML'inde aynı BUILD_ID doğrulandı; çalışma ağacı temiz.
- **Ortam:** izole yerel yığın (Postgres 17 + GoTrue + PostgREST). Production, paylaşılan Test, main (`b62bfcf`), PR #96 ve ArvoOS'a dokunulmadı.
- **AI:** çağrı yok; `next start` sürecinde AI anahtarı yoktu. Sağlayıcı sayacı **21/30**, değişmedi.
- **Dizinler:** Crossref ve OpenAlex **gerçek**; istekler değiştirilmeden iletildi, yalnızca (zaman, alan, yol, durum) kaydedildi (`kanit/dizin-istekleri.jsonl`). Resend yerel yakalayıcıda, gerçek gönderim yok.

## Sonuç

| # | Ölçüt | Sonuç |
|---|---|---|
| 1 | İki gerçek "Guest editorial" künyesi soğuk okumada yanlış esere (`10.1093/jof/70.7.395`, 1972, yazarsız) `verified` olmuyor | **PASS** |
| 2 | Aynı iki künye sıcak okumada `verified` olmuyor | **PASS** |
| 3 | Bu künyelerde PDF satırına DOI geçmiyor (`pdfSatirinaDoi` = null) | **PASS** |
| 4 | Doğru yıl/yazar eşleşen olumlu örnek (DOI'siz) doğrulanıyor | **PASS** |
| 5 | RC06l'nin yerel veritabanına yazdığı GERÇEK yanlış `verified` satırlar yeniden sunulmuyor ve değiştiriliyor | **PASS** |
| 6 | DOI'li kimlik doğrulaması korunuyor (sıcak, dizine gitmeden `verified`) | **PASS** |
| 7 | Sıcak okuma dizine gitmiyor | **PASS** (C adımı: 0 istek) |
| — | OpenAlex anonim erişim | Gözlem: 4 isteğin 3'ü **429**. Bu kabulü etkilemedi (Crossref yanıtladı); Production'daki oranı UNVERIFIED. |

## Adımlar

### Başlangıç durumu (`kanit/onbellek-oncesi.json`)
Yerel `kaynak_dogrulama_onbellegi`'nde RC06l gerçek koşusundan kalan iki yanlış satır vardı (taklit değil, RC06l'de gerçek Crossref yanıtıyla yazıldı):
- `v2|heidingsfelder|guest editorial|2021` → `verified`, `10.1093/jof/70.7.395`, 1972, yazar 0
- `v2|sohret|guest editorial|2021` → `verified`, `10.1093/jof/70.7.395`, 1972, yazar 0

### Adım A — kullanıcı A (eski yanlış satırlarla) — `kanit/k1-onbellek.json`
Künyeler editöre yazıldı, uygulamanın kendi "Kaynakçamı denetle" akışıyla denetlendi; sonuç uygulamanın yazdığı `citation_checks` satırından okundu.

| Künye | Durum | En iyi aday | PDF satırına DOI |
|---|---|---|---|
| Heidingsfelder, M. (2021). Guest editorial. Kybernetes. | `possible_match` | 10.1093/jof/70.7.395 (1972, yazarsız) | null |
| Sohret, Y. (2021). Guest editorial. Aircraft Engineering… | `possible_match` | 10.1093/jof/66.1.9 (1968, yazarsız) | null |
| Braun, V. ve Clarke, V. (2006). Using thematic analysis in psychology. … (DOI'siz) | `verified` | 10.1191/1478088706qp063oa (2006, Braun, Clarke) | 10.1191/1478088706qp063oa |
| Leitón, R. (2021). Editorial. … https://doi.org/10.15517/aie.v21i3.48220 | `verified` | aynı DOI | aynı DOI |

- Dizin istekleri: 6 (Crossref 3 × 200; OpenAlex 3: 2 × 429, 1 × 200). Leitón için istek yok: DOI'li kayıt sıcak okundu.
- Eski iki yanlış satır **sunulmadı**: dizine yeniden soruldu ve satırlar `possible_match` ile **değiştirildi** (OpenAlex 429 yüzünden sonuç kısmi olduğu hâlde; `kanit/onbellek-sonrasi.json`).
- Ekranda iki künye "Olası eşleşme", aday "Yazar bilgisi yok · 1972 · Journal of Forestry" olarak görünüyor; "Doğrulandı" yalnızca Braun ve Leitón'da.

### Adım B — kullanıcı B — GEÇERSİZ GİRDİ (betik kaynaklı), sonuç yine güvenli
Betik metni hızlı yazınca "Sohret" künyesinin ilk harfi önceki satırın sonuna kaydı: künye "ohret, Y. …" olarak girildi. Bu farklı bir önbellek anahtarı, dolayısıyla soğuk sorgu oldu (2 dizin isteği). Sohret'in sıcak okuması bu adımda ölçülmüş sayılmaz. Gözlem olarak: bozuk künye de `possible_match` kaldı, `verified` olmadı; Heidingsfelder ve Braun önbellekten geldi. Aynı ölçüm C adımında yavaş yazımla yeniden yapıldı.

### Adım C — kullanıcı C, sıcak — `kanit/c/k1-onbellek.json`
Künye metinleri birebir doğru girildi (kayıtta doğrulandı).

| Künye | Durum | PDF satırına DOI |
|---|---|---|
| Heidingsfelder … | `possible_match` (70.7.395) | null |
| Sohret … | `possible_match` (66.1.9) | null |
| Braun & Clarke … | `verified` | 10.1191/1478088706qp063oa |

- **Dizin isteği: 0** — üçü de önbellekten.

### PDF satırı
`pdfSatirinaDoi` adayın kendi kodundan (`lib/academic-reference-verification.ts`) kaydedilmiş 10 sonuca uygulandı (`betikler/pdf-doi.ts.txt`, `kanit/pdf-satiri-doi.jsonl`): `possible_match` olan 5 sonucun hepsinde null, `verified` olan 5 sonucun hepsinde kendi DOI'si.

## Sınırlar ve gözlemler
- **Olası eşleşmede DOI ekranda görünüyor** ("DOI: 10.1093/jof/70.7.395"), aday kayıt olarak ve "Olası eşleşme" etiketiyle. Bu PR'ın kararı (aday gösterilir, kesin sayılmaz); yanıltıcı bulunursa ayrı bir tasarım kararı.
- **Sohret için en iyi aday değişti** (RC06l'de 70.7.395, bu koşuda 66.1.9): Crossref'in "Guest editorial" araması aynı puanlı birden çok yazarsız Journal of Forestry kaydı döndürüyor. İkisi de doğrulanmadı.
- **OpenAlex:** anonim istekler büyük ölçüde 429 (RC06l Bulgu 2, RC06m'de "Insufficient budget… no API key"). Bu PR'ın kapsamında değil.
- **B adımındaki yazım kayması** test betiğinin hızından; elle yazımda (RC06m) görülmedi. Ürün hatası olarak sayılmadı.
- **Arama dizesi sözdizimi** (parantezsiz OR, `site:`) bilinen kullanım sorunu olarak kalıyor; bu kabulde literatür çalıştırılmadı.

## Güvenlik ve temizlik
- Kanıtlarda anahtar, JWT ya da doğrulama belirteci yok; yakalanan posta (`posta.jsonl`, doğrulama bağlantıları içerir) teslime konmadı.
- Kullanıcılar sentetik (`@yerel.test`); veriler yalnızca yerel yığında.
- `next start` (3127) kapatıldı; AI anahtarı taşıyan süreç yok.
- Onay K, P9, Auth A1 ve hak iadesi bu onayın dışında; Production HOLD sürüyor.
