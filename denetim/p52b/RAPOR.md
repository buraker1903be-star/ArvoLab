# P52b — PDF depolama ve kaynak güvenliği denetimi (AUDIT-ONLY)

- Dal: `audit/p52b-pdf-guvenligi`, taban `design/os5` `174dbac`.
- Üretim kodu DEĞİŞMEDİ. Migration yok. Production ve Test Supabase'e bağlanılmadı.
- Kanıtlar: yerel Postgres 17 + PostgREST + GoTrue (docker, `denetim/p52b/yigin`), gerçek RLS, sahte Storage, kontrollü OpenAlex/indirme taklidi. Dış ağ YOK.
- Koşturma:
  - `node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b/butunluk.mjs`
  - `psql -f denetim/p52b/depo-rls.sql`
  - `node --import ./tests/register.mjs --test denetim/p52b/saf-bulgular.test.ts`

## 1. Veri akışı

| Akış | İstemci | Sunucu | Tablo | Depo yolu | Yetki | Hata/geri alma | Test |
|---|---|---|---|---|---|---|---|
| DOI ile kaynak ekleme | literatür / kaynak aktarımı | `app/actions/literature.ts`, `kaynak-aktarim.ts` | `literature_sources` | — | RLS; `rate_limit_take` | Sabit adres (api.crossref.org / api.openalex.org) | birim + db |
| Açık erişim PDF keşfi/indirme | `kaynak-pdf-satiri.tsx` → "PDF'leri bul" | `kaynakPdfleriniBul` (`app/actions/kaynak-pdf.ts:83-210`) | `kaynak_pdfleri` | `project-files/<çalışma>/kaynak-pdf/<sha1>-<ts>.pdf` | RLS `can_write_project`; depo `calisma_klasoru` | Upload'dan sonra DB düşerse dosya kalır; eski dosya silme hatası yutulur | saf modül; **eylem testi yok** |
| Öğrenci yüklemesi | tarayıcıdan doğrudan depoya (`kaynak-pdf-satiri.tsx:67-77`) → `kaynakPdfiYuklendi` | `app/actions/kaynak-pdf.ts:218-284` | `kaynak_pdfleri` | `<çalışma>/kaynak-pdf/y-<ts>.pdf` | aynı | PDF değilse siler; DB düşerse dosya kalır | **yok** |
| PDF açma | `createSignedUrl(…, 600)` (`kaynak-pdf-satiri.tsx:48`) | — (istemci, RLS) | — | aynı | depo SELECT: `can_view_project` + kurum gözetimi | — | db (kurum-kapsamli-okuma) |
| Teslim paketi (ZIP) | `teslim-paketi.tsx` | `teslimPaketi` (`kaynak-pdf.ts:295-336`), imzalı adres 600 sn | `kaynak_pdfleri` | aynı | abonelik kapısı; RLS | — | saf modül |
| AI kaynak sohbeti | `kaynak-sohbet-penceresi.tsx` | `kaynaklaSohbet` (`app/actions/ai-kaynak-sohbeti.ts`) | `kaynak_pdfleri`, `ai_assistant_runs` | okuma | `asistanKapisi` + `asistanHakkiVar` (`rate_limit_hit`, atomik) | kayıt her durumda | saf modül |
| Proje silme | `delete-project-button.tsx` | `deleteProject` (`app/actions/projects.ts:579-596`) | kaskat | **dosyalar silinmez** | RLS | — | yok |
| Hesap silme | cron | `app/api/cron/hesap-silme/route.ts:139-186` (servis anahtarı) | — | `<kullanıcı>/` + SAHİBİ OLDUĞU çalışmalar | servis anahtarı | — | db |

Servis anahtarı PDF akışlarında **kullanılmıyor**. Kullanıldığı yerler: hesap silme cron'u, paylaşım sayfası ve dışa aktarım (resim imzası).

## 2. Storage/DB bütünlük matrisi (gerçek eylem + gerçek DB, sahte depo)

| Kimlik | Senaryo | Bugün | Kanıt |
|---|---|---|---|
| B-DB-1 | PDF depoya yazıldı, DB upsert düştü | **FAIL**: yetim dosya | `kaynak-pdf.ts:173-199`: hata dönüşünde yüklenen `hedef` silinmiyor |
| B-DB-2 | Öğrenci yükledi, DB düştü | **FAIL**: yetim dosya | `kaynak-pdf.ts:256-276` |
| B-RACE-1 | "Bul" sürerken öğrenci yükledi | **FAIL**: `yuklendi` → `erisilemedi`; öğrencinin dosyası yetim | `hazir` kümesi çağrının başında okunuyor (`:96-106`), upsert koşulsuz (`:193-196`) |
| B-RACE-2 | Aynı künyeye eşzamanlı iki "Bul" | **FAIL**: 2 dosya indi, 1 yetim | aynı |
| B-RACE-3 | Hızlı sekme `indirildi` yazdı, yavaş sekme sonra bitti | **FAIL**: `indirildi` → `erisilemedi`, dosya yetim | aynı; `pdfHazirMi` koruması yarışta atlanıyor |
| B-DEL-1 | PDF değiştirilirken eski dosya silinemedi | **FAIL**: sessiz yetim, kullanıcıya "başarılı" | `kaynak-pdf.ts:204` ve `:280`: `remove` hatası okunmuyor |
| B-DEL-2 | Proje silindi | **FAIL** (koddan): bütün `<çalışma>/` klasörü kalıyor; hesap silme de artık bulamıyor | `projects.ts:584`; `hesap-silme/route.ts:165-176` yalnız mevcut çalışmaları geziyor |
| B-NET-1 | Yükleme sırasında ağ kesildi | Dosya yarım yazılırsa storage-api reddeder; tam yazılıp `kaynakPdfiYuklendi` çağrılmazsa yetim | **UNVERIFIED** (gerçek storage-api yok) |

Hiçbir senaryoda başka kullanıcının dosyası silinmedi ya da görünür olmadı (bkz. §3).

## 3. RLS ve yetkilendirme matrisi

Gerçek `storage.objects` ve `kaynak_pdfleri` politikaları, Supabase rolleriyle sınandı (`depo-rls.sql`, `butunluk.mjs` B-AUTH-1).

| Aktör | Kayıt okuma | Kayıt yazma | Depo okuma | Depo silme | Depo yazma |
|---|---|---|---|---|---|
| Sahip | ✔ | ✔ | ✔ (1) | ✔ | ✔ |
| Yabancı | 0 satır | reddedildi | 0 | 0 | reddedildi |
| Başka kurumun kontrolörü | — | — | 0 | — | — |
| `kendi/../A` anahtarı | — | — | — | — | Kabul; anahtar DÜZ metin, `foldername[1]` = yazanın kendi klasörü |

- `..` anahtarının gerçek storage-api'de normalleştirilip normalleştirilmediği **UNVERIFIED**.
- Proje kimliği ya da yol değiştirerek yetki aşımı bulunmadı: **P0 yok**.
- İmzalı adresler 600 sn geçerli ve RLS'li istemciyle üretiliyor. Paylaşılabilir bir adres; okuma yetkisiyle aynı kapsamda.
- B-AUTH-1 yan bulgusu: yabancının çağrısında dış indirme, yazma yetkisi denetlenmeden ÖNCE yapılıyor (P1-4). Gerçek depo politikası yazmayı reddeder; sahte depo bunu taklit etmiyor.

## 4. SSRF ve PDF içerik güvenliği

**Korunanlar:**
- yalnızca http/https; kimlik bilgisi ve standart dışı port yok;
- her yönlendirme adımında yeniden denetim, en fazla 5 adım;
- toplam süre 20 sn, boyut 20 MB (Content-Length ve akış);
- iç IPv4 blokları ve IPv4 eşlemeli IPv6;
- adaylar yalnızca OpenAlex açık erişim konumlarından (kapalı erişim otomatik indirilmiyor; giriş sayfası HTML'i `pdfMi` ile eleniyor).

**Bulgular:**
- **B-SSRF-1 (P2):** `isPrivateAddress` NAT64 (`64:ff9b::/96`) ve 6to4 (`2002::/16`) öneklerini genel sayıyor (`lib/safe-official-fetch.ts:58-61`). Yeniden üretildi.
- **DNS rebinding:** belgelenmiş, P2. Ad iki kez çözülüyor (`lib/guvenli-indir.ts:19-23`).
- **B-PDF-1/2 (P2):** `pdfMi` ilk 1 KB'nin herhangi bir yerinde `%PDF-` arıyor. Önü HTML olan yanıtı ve gövdesi bozuk / `%%EOF`'suz dosyayı PDF sayıyor (`lib/kaynak-pdf.ts:72-78`). Yeniden üretildi.
- **Gerçek dış ağ indirmesi:** **UNVERIFIED**; geliştirme ortamında DNS yok.

## 5. Kota ve AI maliyeti

- **P1-4:** `kaynakPdfleriniBul`'da kullanıcı başına sınır yok.
  - Çağrı başına en çok 3 DOI × 5 aday × 20 MB indirme ve depoya yazma; çağrı sayısı sınırsız.
  - DOI eklemede var olan `rate_limit_take` burada kullanılmıyor.
  - Dış çağrılar yazma yetkisinden önce yapılıyor; yetkisiz kullanıcı da sunucuya indirme yaptırabiliyor.
- **P2-5:** `kaynaklaSohbet` saatlik hakkı (`:105`) PDF'in indirilmesi (`:80`) ve TAM metin çıkarımından (`:89`) SONRA düşüyor. Sınırı aşan istek de bu CPU'yu harcıyor.
  - Metin her soruda yeniden çıkarılıyor.
  - Metin çıkarımında süre ve sayfa sınırı yok.
  - Model tarafında giriş bütçesi (`ilgiliSayfalar`) ve en çok 2 500 çıktı jetonu var.
- **P2-6:** `kaynakPdfiYuklendi` her yüklemede 20 MB'a kadar dosyayı indirip metin çıkarıyor; sınır yok.
- Eşzamanlı istekle hak aşımı: `rate_limit_hit` atomik, aşım yok (kodda doğrulandı).

## 6. Bulgu listesi

| No | Önem | Bulgu | Dosya:satır | Yeniden üretim | Etki | En dar düzeltme | Migration |
|---|---|---|---|---|---|---|---|
| P1-1 | **P1** | Yarışta hazır PDF kaydı ezilir (öğrenci yüklemesi ya da indirilen PDF kaybolur) | `kaynak-pdf.ts:96-106, 193-196` | B-RACE-1, B-RACE-3 | Öğrencinin yüklediği PDF çalışmadan kopar, dosya yetim kalır | Otomatik aramanın yazması koşullu: önce `ignoreDuplicates` ile ekle, sonra `.not("durum","in","(indirildi,yuklendi)")` ile güncelle; 0 satırsa kendi yüklediği dosyayı sil | Hayır (istenirse koşullu upsert RPC'si) |
| P1-2 | **P1** | Hata yollarında yetim dosya: DB düştü, eski dosya silinemedi, eşzamanlı ikinci indirme | `kaynak-pdf.ts:197-204, 256-280` | B-DB-1, B-DB-2, B-DEL-1, B-RACE-2 | Kullanıcının göremediği ve silemediği telifli PDF'ler; depo maliyeti | Telafi: DB düşünce yeni dosyayı sil; `remove` hatasını oku ve günlüğe yaz | Hayır |
| P1-3 | **P1** | Proje silinince `<çalışma>/` klasörü (kaynak PDF'leri, editör resimleri) kalıcı yetim | `projects.ts:579-596` | B-DEL-2 (koddan) | Silinen çalışmanın kişisel ve telifli dosyaları süresiz kalır; hesap silme de bulamaz (KVKK) | Silmeden önce klasörü listele ve sil (RLS izin veriyor) + sahipsiz klasör taraması (servis anahtarlı cron) | Hayır |
| P1-4 | **P1** | PDF bulmada kota yok; dış indirme yetki denetiminden önce | `kaynak-pdf.ts:83-150` | B-AUTH-1 + kod | Bant genişliği ve depo maliyeti, kötüye kullanım | `rate_limit_take` bütçesi; dış çağrıdan önce `can_write_project` denetimi | Hayır (işlev var) |
| P2-1 | P2 | `pdfMi` zayıf | `lib/kaynak-pdf.ts:72-78` | B-PDF-1/2 | HTML ya da bozuk dosya "PDF" diye saklanır | İmza 0. bayttan (yalnız boşluk/BOM izinli) + son 1 KB'de `%%EOF` | Hayır |
| P2-2 | P2 | NAT64/6to4 süzülmüyor; DNS rebinding penceresi | `safe-official-fetch.ts:58-61`; `guvenli-indir.ts:92-111` | B-SSRF-1 | NAT64'lü ağda iç adrese istek | Önekleri ekle; çözülen IP'ye bağlanan özel lookup (undici dispatcher) | Hayır |
| P2-3 | P2 | Yükleme kaydı aynı çalışmadaki başka künyenin dosyasını gösterebiliyor | `kaynak-pdf.ts:226` | B-PATH-1 | Biri değiştirilince ötekinin dosyası silinir (çalışma içi) | Yol kalıbı `y-<ts>.pdf` + başka satırda kullanılmıyor denetimi | Hayır |
| P2-4 | P2 | Depoya doğrudan yüklenip kaydedilmeyen dosyalar doğrulanmıyor | `kaynak-pdf-satiri.tsx:67-77`; depo politikası | koddan | Yetim ve kovanın izin verdiği her türde dosya | Sunucunun verdiği imzalı yükleme adresi ya da tarama | Hayır |
| P2-5 | P2 | AI kaynak sohbetinde hak, pahalı işten sonra; metin çıkarımı sınırsız ve her soruda | `ai-kaynak-sohbeti.ts:80-106` | koddan | CPU maliyeti, PDF bombası | Hak denetimini indirmeden önceye al; metin çıkarımına süre/sayfa sınırı | Hayır (önbellek isterse evet) |
| P2-6 | P2 | Yükleme doğrulamasında sınır yok | `kaynak-pdf.ts:229-245` | koddan | CPU maliyeti | P1-4 ile aynı bütçe | Hayır |
| P2-7 | P2 | `..` anahtarı gerçek storage-api'de normalleşiyor mu | `kaynak-pdf.ts:226` | **UNVERIFIED** | — | Yolda `..` ve izinli karakter denetimi | Hayır |

**P0 bulgu yok:** kullanıcılar arası okuma, yazma ya da silme yeniden üretilemedi.

## 7. Test boşlukları

- PDF sunucu eylemlerinin hiçbirine eylem düzeyinde test yok (`kaynakPdfleriniBul`, `kaynakPdfiYuklendi`, `teslimPaketi`, `kaynaklaSohbet`).
- Hata ve geri alma yolları ile yarışlar sınanmıyor.
- `storage.objects` politikaları için `kaynak-pdf` klasörüne özel DB testi yok (genel klasör testi var).
- Proje silmede depo temizliği sınanmıyor.
- SSRF süzgecinde NAT64/6to4 testi yok.
- Gerçek storage-api, gerçek dış ağ ve PDF bombası: yerel düzenekte yok.

## 8. Önerilen PR sırası (küçük ve bağımsız)

1. **P52b-1:** yarışa dayanıklı yazma + telafi (P1-1, P1-2). Uygulama kodu, migration yok.
2. **P52b-2:** proje silmede depo temizliği + sahipsiz klasör taraması (P1-3). Cron eklenir, migration yok.
3. **P52b-3:** kota ve erken yetki (P1-4, P2-5, P2-6). Mevcut `rate_limit_take`; migration yok.
4. **P52b-4:** PDF yapısı, SSRF önekleri, yol sahipliği (P2-1, P2-2, P2-3, P2-7).
5. **P52b-5 (isteğe bağlı):** imzalı yükleme adresi ya da yetim taraması (P2-4).

Migration gerektiren tek isteğe bağlı kalem: koşullu upsert RPC'si (P1-1'in DB tarafında atomik hâli). İkinci isteğe bağlı kalem: proje başına depo kotası.

## 9. Kabul kriterleri (her PR)

- İlgili denetim senaryosu düzeltmeden önce FAIL, sonra PASS.
- `butunluk.mjs` ve `depo-rls.sql` yeşil; B-AUTH ve depo RLS satırları değişmeden.
- tsc, lint, `check:*`, unit, editor, db ve build yeşil; CI push ve pull_request yeşil.
- Gerçek dış ağ ve storage-api gerektiren maddeler **UNVERIFIED** olarak raporlanır, PASS sayılmaz.
