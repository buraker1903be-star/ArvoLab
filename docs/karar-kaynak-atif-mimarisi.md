# Kaynak ↔ atıf ↔ PDF bütünlüğü — karar ve uygulanabilir teknik plan

**Durum:** Ürün kararları VERİLDİ (07.11.2026). Teknik plan **onay bekliyor**;
bu belge kod, migration ya da veri değişikliği İÇERMEZ. Her dilim ayrı
onayla uygulanır. İlk sürüm: `8e0e56b`; bu sürüm kararları işler ve planı
uygulanabilir ayrıntıya indirir.

## 0. Verilen ürün kararları

| # | Karar | Kapsam |
|---|---|---|
| K1 | DOI ekleme yollarında **ortak doğrulama ve abonelik kuralları** | Kaynaklar sayfası, editör atıf penceresi, toplu DOI/içe aktarma |
| K2 | **Çalışma kapsamında** mükerrer DOI kontrolü | Aynı çalışmada aynı DOI ikinci kez eklenemez; başka çalışmada eklenebilir |
| K3 | Atıflı kaynaklarda **yumuşak silme ve açık uyarı** | Belgede atfı olan kaynak kalıcı silinmez |
| K4 | ZIP paketinde **DOCX, RIS, BibTeX, kaynak PDF'leri ve eksik dosya raporu** | Teslim paketi |
| K5 | Atıflar **kaynak kimlikleriyle** bağlanır; **eski belgeler otomatik değiştirilmez** | Editör |
| K6 | Çalışmaya bağlı OLMAYAN kaynakta tekrar kontrolü **kullanıcının genel kütüphanesi** kapsamında; farklı kullanıcıların kaynakları birbirinden bağımsız (07.11.2026) | Anahtar `(owner_id, doi)`, `project_id is null` |
| K7 | Kaldırılan kaynak için varsayılan **geri alma süresi 30 gün**; belge, atıf, kanıt ya da başka bir kayıtla ilişkili kaynak **otomatik kalıcı silinmez** (07.11.2026) | Yumuşak silme (K3) |
| K8 | Eski belgelerin atıflarını kaynak kimliklerine bağlama aracı **A4'ten ayrı bir dilim**; **otomatik belge değişikliği yok** (07.11.2026) | K5 |

## 1. İlkeler (bütün dilimler)

1. **Mevcut veri kaybolmaz, sessizce yeniden yazılmaz.** Hiçbir migration ya
   da geri doldurma `project_manuscripts.content`'i değiştirmez; hiçbir
   kaynak satırı silinmez ya da birleştirilmez. Kullanıcıya ait veride
   değişiklik yalnızca kullanıcının eylemiyle olur.
2. **Eski kayıt, eski belge çalışmaya devam eder.** Yeni sütunlar NULL
   olabilir; her okuma yolu "bağ yok" hâlini bugünkü davranışla karşılar.
3. **Çıktı değişmez.** Word, yazdırma/PDF ve danışman paylaşımı hiçbir
   dilimde değişmemeli: `tests/editor/cikti-referans.test.ts` ve
   `scripts/onizleme/cikti-kabul.mjs` (R0) her dilimin kabul ölçütüdür.
4. **RLS "kim"i, tetikleyici "ne"yi söyler.** Oturum belirteci tarayıcıda;
   uygulamadaki kural doğrudan REST isteğiyle atlanabilir. Veri bütünlüğü
   kuralları (mükerrer DOI, PDF–kaynak eşleşmesi) veritabanında da
   uygulanır; uygulama yalnızca anlaşılır mesajı verir.
5. AGENTS.md değişmezleri: abonelik kapısı, `gozetim_kapsami`, her yeni
   fonksiyonda `revoke all … from public, anon, authenticated` + gereken
   `grant`, yeni tabloda RLS aynı migration'da, migration `npm run db:new`.

## 2. Bugünkü durum (salt okunur envanter, Test kataloğu ile doğrulandı)

- `literature_sources`: `id, owner_id, project_id (→ academic_projects, set null), title, authors, year, source_type, doi_or_url, status (to_review|read|used), notes, created_at, container_title, volume, issue, pages, publisher, publication_place`.
  - RLS: sahip okur/yazar/siler; gözetim rolleri `gozetim_kapsami(kullanici_kurumu(owner_id), {controller, academic_manager})` ile okur.
  - Tetikleyici: `guard_subscription_trigger` — **yazma yolları veritabanında zaten abonelik kapısından geçiyor.**
  - Dizinler: `owner_id`, `(project_id, status)`. **Tekrar kısıtı yok.**
  - DOI ayrı sütun değil: `doi_or_url` içinde, adreslerle karışık.
  - Ona bağlı tek yabancı anahtar: `kanit_kayitlari.kaynak_id` (`set null`).
- `kaynak_pdfleri`: `(project_id, kunye_anahtari)` benzersiz; `literature_sources`'a
  bağı **yok**; RLS `can_write_project` / çalışmayı gören okur. "PDF sil" işlemi yok.
- DOI normalleştirme **üç yerde**: `lib/doi.ts → normalizeDoi`,
  `lib/kaynak-aktarim.ts → doiAyikla` (metinden liste),
  `lib/kanit/kunye-karsilastirma.ts → doiAyikla` (tek değer).
- DOI ekleme yolları: `doiIleEkle` (`app/actions/kaynak-aktarim.ts`, kapı var,
  tekrarı atlar) ve `lookupDoi` + `createCitationSource`
  (`app/actions/literature.ts`; arama kapısız ve `lib/access.ts` listesinde yok,
  kayıt `used` doğar, tekrar denetimi yok).
- Atıf: `insertCitation` (`editor-navigation.ts:236-290`) düz metin yazar;
  dipnotta `footnoteReference.attrs.text`. Belgede kaynak kimliği yok.
- ZIP: `teslimPaketi` (`app/actions/kaynak-pdf.ts`) imzalı PDF bağlantıları +
  kaynak raporu; ZIP tarayıcıda kurulur; abonelik kapısı var. Belge ve
  kaynakça dosyaları yok.

## 3. Veri modeli

### 3.1 `literature_sources` — yeni sütunlar (K2, K3)

| Sütun | Tür | Anlam | Mevcut satırlar |
|---|---|---|---|
| `doi` | `text null`, `check (doi is null or doi ~ '^10\.\d{4,9}/\S+$' and doi = lower(doi))` | Normalleştirilmiş DOI (küçük harf, `https://doi.org/` öneksiz). Tek doğruluk kaynağı. | Geri doldurma: `doi_or_url`'den `public.doi_normallestir()` ile; çıkarılamayan NULL kalır |
| `silindi_at` | `timestamptz null` | Yumuşak silme zamanı | NULL |
| `silen` | `uuid null references auth.users(id) on delete set null` | Kim sildi | NULL |

- `doi_or_url` **kalır ve değişmez** (geriye dönük uyumluluk; künye
  gösterimi ve dışa aktarma onu okuyor). Yeni yollar ikisini birlikte yazar:
  `doi` normal biçim, `doi_or_url` kullanıcının gördüğü biçim.
- Neden üretilmiş (generated) sütun değil: normalleştirme kuralı
  değiştiğinde üretilmiş sütun bütün tabloyu yeniden yazar ve dizini
  yeniden kurar; ayrıca SQL'deki kural TS ikiziyle aynı örnek tablosuna
  karşı sınanmalı (bkz. 7.2). Tetikleyici yazar, kural tek fonksiyonda.

### 3.2 Yeni fonksiyonlar

| Fonksiyon | Tür | Neden | Yetki |
|---|---|---|---|
| `public.doi_normallestir(text) returns text` | `immutable`, SQL | TS `normalizeDoi`'nin ikizi; geri doldurma ve tetikleyici kullanır | `revoke all … from public, anon, authenticated`; tetikleyici sahibi çağırır |
| `public.kaynak_doi_esle()` | tetikleyici, **security invoker** | `BEFORE INSERT OR UPDATE OF doi_or_url, doi, silindi_at, project_id`: `doi`'yi `doi_or_url`'den doldurur; aynı çalışmada silinmemiş aynı DOI varsa `unique_violation` ile reddeder (K2) | tetikleyici fonksiyonu; çağrılamaz |
| `public.kaynak_pdf_kaynak_esle()` | tetikleyici, security invoker | `kaynak_pdfleri.kaynak_id` doluysa kaynağın `project_id`'si satırınkiyle aynı olmalı (başka çalışmanın kaynağına bağlanamaz) | aynı |

Tetikleyici **invoker**: çağıranın görebildiği satırlara bakar. Aynı
çalışmada iki kullanıcının (öğrenci + atanmış uzman) ayrı kaynakları
olabileceği için mükerrer denetimi sahibin satırlarıyla sınırlı değil,
**çalışmanın** satırlarıyla. İnvoker iken başka kullanıcının satırını RLS
yüzünden göremezse tekrar kaçabilir → denetim sorgusu tek amaçlı,
`security definer` bir yardımcıda (`kaynak_doi_var_mi(project_id, doi, haric_id)`,
yalnızca `boolean` döner, satır sızdırmaz; `authenticated`'a `grant execute`).
Bu, AGENTS.md'deki "anon'a açılan fonksiyon kendi yetkisini denetler"
kuralına uyar: yardımcı yalnızca çağıranın yazabildiği çalışma için
cevap verir (`can_write_project(project_id)` değilse `false` değil HATA).

### 3.3 Dizinler

- `create index … on literature_sources (project_id, doi) where doi is not null and silindi_at is null` — tekrar denetimi ve DOI araması.
- **Kısmi benzersiz dizin** `unique (project_id, doi) where doi is not null and silindi_at is null`
  YALNIZCA mevcut tekrarlar sıfırken (bkz. 6.2). O güne kadar tetikleyici
  yalnızca **yeni** tekrarı reddeder; eski tekrarlar durur.

### 3.4 `kaynak_pdfleri.kaynak_id` (K4 için gerekli)

`kaynak_id uuid null references literature_sources(id) on delete set null`.
`kunye_anahtari` ve `(project_id, kunye_anahtari)` benzersizliği **kalır**:
kütüphanede karşılığı olmayan kaynakça satırının da PDF'i olabiliyor.
Kaynak yumuşak silinince bağ kalır (PDF kaybolmaz); kalıcı silinince NULL.

### 3.5 Belge içi atıf (K5) — veritabanı değişikliği yok

- Yeni TipTap **işareti** `atif` (`lib/tiptap-extensions.ts`), öznitelikleri:
  `{ kaynaklar: string[] /* literature_sources.id */, sayfa: string | null }`.
  `footnoteReference`'a aynı adlı ek öznitelik `kaynaklar`.
- Belge JSON'u `jsonb`; şema değişikliği yok, migration yok.
- **Çıktılar işareti yok sayar**: `lib/tiptap-html.ts`, `lib/tiptap-docx.ts`,
  `lib/latex*`, paylaşım — metin aynen çizilir. R0 referans testleri bunu
  kanıtlar (ilke 3).
- Neden düğüm değil işaret: atıf metni düzenlenebilir kalmalı (sayfa
  numarası, "ve ark."); düğüm onu tek parça yapar, bul-değiştiri ve
  kopyala-yapıştırı bozar.

## 4. Kararların uygulanması

### K1 — DOI yollarında ortak doğrulama ve abonelik kuralı

1. **Tek normalleştirici:** `lib/doi.ts → normalizeDoi` kanonik. Öteki iki
   `doiAyikla` ona bağlanır (metinden liste çıkaran sarmalayıcı kalır,
   normalleştirmeyi `normalizeDoi`'ye bırakır). SQL ikizi
   `doi_normallestir` aynı örnek tablosuyla sınanır (7.2).
2. **Tek karar modülü** `lib/kaynak-ekleme.ts` (saf, `tests/unit`):
   `doiKarari({ girdi, mevcutDoilar }) → { tur: "gecersiz" | "tekrar" | "ekle", doi }`
   ve sonuç sınıfları: `gecersiz | tekrar | bulunamadi | zaman_asimi | dizin_hatasi | eklendi`.
3. **Tek sunucu işlemi** `kaynakEkleDoi({ projectId, doi, baglam: "kutuphane" | "editor" })`.
   Sıra: oturum → `isSubscriptionBlocked()` → çalışmaya yazma yetkisi →
   karar modülü (geçersiz/tekrar dış servise gitmeden döner) → Crossref
   (8 sn) → insert. `doiIleEkle` (toplu) ve editör yolu bunu çağırır.
4. **Abonelik:** `lookupDoi` (yalnızca arama) de kapıya alınır ve
   `lib/access.ts` listesine yazılır — dış servise giden ve içerik
   eklemeye hazırlayan bir yol; kapısız kalması iki yol arasındaki tek
   tutarsızlık. Veritabanı kapısı (`guard_subscription_trigger`) zaten yazma
   yollarını kapsıyor; uygulama kapısı anlaşılır mesaj için.
5. **Durum kuralı:** kaynak `to_review` doğar; editörden eklenip atıf
   belgeye girince `used` olur (bugün kayıt anında `used` yazılıyor ve
   atıf iptal edilse de kalıyor).
6. Tekrar → yeni satır YAZILMAZ; mevcut kaynağın kimliği döner ve editör
   o kaynağa atıf yapar (kullanıcı akışı kesilmez, mesaj: "Bu DOI bu
   çalışmada zaten var: <başlık>").

### K2 — Çalışma kapsamında mükerrer DOI

- Anahtar: çalışmaya bağlı kaynakta `(project_id, doi)`; çalışmaya bağlı
  OLMAYAN kaynakta **kullanıcının genel kütüphanesi**: `(owner_id, doi)`
  ve `project_id is null` (K6). Farklı kullanıcıların kaynakları birbirini
  etkilemez. Her iki kapsamda `silindi_at is null`.
- Uygulama düzeyinde (A1) "çalışma kapsamı" = sahip + çalışma: kaynak
  yalnızca kullanıcının SAHİBİ olduğu çalışmaya bağlanabiliyor
  (`lib/kaynak-hedefi.ts`), yani bugün bir çalışmanın bütün kaynakları
  tek kullanıcınındır ve sahip+çalışma denetimi çalışma kapsamının
  tamamıdır. Atanmış kişinin kaynak eklemesi açılırsa (RLS kararı) bu
  varsayım düşer; veritabanı denetimi (M4) o yüzden çalışmaya bakar.
- Veritabanı: `kaynak_doi_esle` tetikleyicisi yeni tekrarı reddeder
  (`23505`, mesaj Türkçe). Uygulama tetikleyiciye güvenmez, karar modülüyle
  önceden yakalar; tetikleyici doğrudan REST'e karşı son çizgi.
- Künye eşleşmesi (DOI'siz kaynak) **zorlanmaz**, yalnızca uyarı ("Olası
  tekrar" süzgeci bugünkü gibi). Yanlış pozitif riski DOI'de yok, künyede var.
- **Mevcut tekrarlar** engellenmez, silinmez, birleştirilmez (ilke 1):
  6.2'deki rapor + kullanıcı eylemiyle "birini sil (yumuşak)" yolu.

### K3 — Atıflı kaynakta yumuşak silme ve açık uyarı

- Silme işlemi önce **atıf sayısını** hesaplar: belgedeki `atif`
  işaretleri + dipnot `kaynaklar` özniteliği (K5) + işareti olmayan eski
  belgeler için bugünkü metin eşleşmesi (`lib/atif-eslesmesi.ts`, "olası"
  olarak etiketli) + kanıt kayıtları + PDF.
- **Atıf ya da kanıt kaydı varsa** kalıcı silme sunulmaz; onay penceresi
  açıkça yazar: "Bu kaynağa belgede N yerde atıf var (M'si kesin, K'sı
  metin eşleşmesi). Kaynak kütüphaneden kaldırılır ama silinmez; atıflar
  ve kaynakça satırı belgede kalır. Geri alınabilir." → `silindi_at = now()`.
- Atıf yoksa kalıcı silme (bugünkü davranış).
- **Engelin sorgusu hata yutmaz:** atıf sayısı okunamazsa silme yapılmaz
  (yumuşak dahil), "denetlenemedi" denir.
- **Geri alma süresi 30 gün (K7).** Süre dolan kaynak yalnızca hiçbir
  kayıtla ilişkili DEĞİLSE kalıcı silinebilir: belgede atıf (işaret ya da
  metin eşleşmesi), kanıt kaydı (`kanit_kayitlari.kaynak_id`), PDF bağı
  (`kaynak_pdfleri.kaynak_id`) ya da başka bir yabancı anahtar varsa
  **otomatik kalıcı silme yapılmaz**; kaynak "Kaldırılanlar"da süresiz
  kalır ve yalnızca kullanıcının açık eylemiyle (ilişkiler gösterilerek)
  silinebilir. Otomatik temizlik ayrı bir zamanlanmış iş olur ve ilişki
  denetimi okunamazsa HİÇBİR şeyi silmez (engelin sorgusu hata yutmaz).
  Belgedeki atıf JSON'da olduğu için ilişki denetimi müsveddeyi de okur;
  bu yüzden temizlik veritabanında tek bir sorguyla değil, uygulama
  tarafında yapılır (ayrı dilim, A2'nin parçası değil).
- Yumuşak silinmiş kaynak: listede ve sayaçlarda görünmez (tek yardımcı
  `kaynakSorgusu()` her okumaya `silindi_at is null` ekler — iki yerde
  kurulan süzgeç, `check:rakamlar` sınıfı bir sayı hatasının kaynağı);
  "Kaldırılanlar" görünümünde geri alınır; belge ve kaynakça üretimi
  atıflı kaydı okumaya devam eder; yapı denetimi "kütüphaneden
  kaldırılmış kaynağa atıf" uyarısı verir.
- RLS: seçim politikası değişmez (sahip ve gözetim yine görür; süzme
  uygulamada). `silindi_at`/`silen` yalnızca sahip tarafından yazılır
  (mevcut UPDATE politikası); `silen` tetikleyicide `auth.uid()`'den
  yazılır, istemciden gelmez.
- Belgedeki metin **asla otomatik silinmez**.

### K4 — ZIP: DOCX + RIS + BibTeX + kaynak PDF'leri + eksik dosya raporu

Tarayıcıda kurulan mevcut pakete eklenir (sunucunun ~4,5 MB yanıt sınırı
yüzünden sunucuda kurulmaz). İçerik:

```
<çalışma-adı>/
  belge.docx              editörün Word düğmesiyle AYNI buildDocxFromTiptap çağrısı
  kaynakca.ris            bu çalışmanın kaynakları (silinmemiş + atıflı yumuşak silinmiş)
  kaynakca.bib            aynı küme
  kaynak-pdf/<ad>.pdf     indirilebilen her PDF (bugünkü adlandırma: paketDosyalari)
  eksik-dosyalar.txt      her kaynak için: PDF var/yok + neden
  rapor.txt               bugünkü kaynak raporu
```

- **Eksik dosya raporu**, her kaynak için bir satır: `bulunamadi` (açık
  erişim yok), `erisilemedi`, `kayit_yok`, `pdf_hic_aranmadi`, ve paket
  kurulurken **inmeyen** dosya (`imzali_baglanti_alinamadi`,
  `indirme_basarisiz`, `boyut_siniri`). Paketin kendisi eksik dosya
  yüzünden düşmez; eksik olan raporda yazar.
- Kaynak kümesi `kaynak_id` ile (3.4); bağı olmayan PDF satırları künye
  anahtarıyla eklenir ve raporda "kütüphanede karşılığı yok" diye işaretlenir.
- Belgenin PDF'i pakete girmez (sunucuda başsız tarayıcı Vercel'de pahalı;
  tarayıcıda yazdırma kullanıcı etkileşimi ister); `rapor.txt` "PDF için
  Yazdır → PDF olarak kaydet" der.
- Abonelik kapısı bugünkü gibi `teslimPaketi`'nde.
- İmzalı bağlantılar 10 dk; büyük paket için bağlantılar parça parça istenir.

### K5 — Atıfların kaynak kimliğiyle bağlanması

- `insertCitation` ve atıf penceresi `atif` işaretini koyar; dipnotlu
  stilde `footnoteReference.attrs.kaynaklar`.
- Yazım asistanının eklediği atıflar: asistan zaten yalnızca kütüphanedeki
  kaynaklara atıf yapabiliyor; eşleşen kaynağın kimliği işarete yazılır
  (ayrı dilim, asistan izi `lib/tiptap-asistan-izi.ts` ile birlikte).
- **Eski belgeler otomatik değiştirilmez.** İsteğe bağlı araç "Atıfları
  kaynaklara bağla": mevcut eşleştirici aday gösterir, kullanıcı her birini
  onaylar; yalnızca onaylanan yer işaretlenir ve bu bir kullanıcı
  düzenlemesi gibi sürüm geçmişine girer. **Bu araç A4'te DEĞİL, ayrı bir
  dilimde (A4b) gelir (K8).**
- Okuma kuralı: önce işaret; yoksa metin eşleşmesi; "bilinmiyor" ile "yok"
  ayrımı korunur.
- Yabancı kimlik: başka çalışmadan yapıştırılan işaretin kimliği bu
  çalışmanın kaynağı değilse yok sayılır ve yapı denetimi uyarır.
- Yumuşak silinmiş kaynağın işareti geçerli kalır (K3).

## 5. Migration sırası (hiçbiri oluşturulmadı)

Her adım: önce **salt okunur ön rapor** (Test, sonra onayla Production),
sonra migration, sonra `tests/db` meşru akış + saldırı senaryoları, anlık
görüntü (`supabase/schema.sql`) yenilemesi. Production her adımda ayrı onay.

| Sıra | Ad (öneri) | İçerik | Ön rapor | Veri etkisi | Geri alma |
|---|---|---|---|---|---|
| M1 | `kaynak_yumusak_silme` | `literature_sources.silindi_at`, `silen` + `silen`'i yazan tetikleyici | yok | yok (NULL) | sütunları düşür |
| M2 | `doi_normallestir` | `doi_normallestir()` + yetki satırları | TS ↔ SQL örnek tablosu (7.2) | yok | fonksiyonu düşür |
| M3 | `kaynak_doi_sutunu` | `literature_sources.doi` + check + kısmi dizin; tetikleyici `kaynak_doi_esle` (yalnızca DOLDURUR, henüz reddetmez) | `doi_or_url`'den kaç satırın DOI'si çıkıyor, kaçı geçersiz | `doi` geri doldurulur (yalnızca yeni sütun; `doi_or_url` değişmez) | sütunu düşür |
| M4 | `kaynak_doi_tekrar_engeli` | `kaynak_doi_var_mi()` yardımcısı + tetikleyicinin reddetme kolu (yalnızca YENİ tekrar) | çalışma başına mevcut tekrar sayısı (6.2) | yok | tetikleyiciyi önceki sürüme döndür |
| M5 | `kaynak_pdf_kaynak_bagi` | `kaynak_pdfleri.kaynak_id` + `kaynak_pdf_kaynak_esle` | DOI ve künye anahtarı tam eşleşme sayıları, belirsizler | geri doldurma yalnızca **tek** adaylı eşleşmeler; belirsizler NULL ve raporlu | sütunu düşür |
| M6 | `kaynak_doi_benzersiz` | kısmi benzersiz dizin | tekrar sayısı **0** olmalı; değilse ertelenir | yok | dizini düşür |

M1–M2 bağımsız; M3, M2'ye; M4, M3'e; M6, M4'e ve sıfır tekrara bağlı.
K5 ve K4 migration istemez; K4, M5'ten sonra en doğru hâlini alır
(öncesinde künye anahtarıyla çalışır).

## 6. Mevcut kaynakların korunması

### 6.1 Genel
- Hiçbir adım satır silmez ya da birleştirmez. Geri doldurmalar yalnızca
  **yeni** sütunlara yazar, idempotent'tir (`where doi is null` gibi) ve
  her koşu sonunda "yazılan / atlanan / belirsiz" sayısını döker.
- `doi_or_url`, `kunye_anahtari`, belge JSON'u ve kanıt kayıtları
  değişmez.
- Geri doldurma Test'te koşulur, sayıları raporlanır; Production için
  önce aynı sorgunun **salt okunur** sürümü, sonra ayrı onay.

### 6.2 Mevcut mükerrer DOI'ler
- Ön rapor sorgusu (M4 öncesi): `project_id, doi, count(*)` > 1 olan
  gruplar ve her gruptaki kaynakların atıf/kanıt/PDF bağı.
- Bu gruplar **durur**; tetikleyici yalnızca yeni ekleme ve DOI
  değişikliğinde denetler (mevcut satırın notunu güncellemek reddedilmez).
- Kaynaklar sayfası "Olası tekrar" süzgecine "aynı DOI" nedeni eklenir;
  kullanıcı birini (yumuşak) siler. Tekrar sayısı sıfırlanınca M6.
- Otomatik birleştirme YOK (ilk sürümdeki `kaynak_birlesmeleri` önerisi
  bu kararla düştü: birleştirme yerine kullanıcı tarafından yumuşak silme).

### 6.3 Eski belgeler
- İşaretsiz belge bugünkü gibi çalışır (metin eşleşmesi). Bağlama aracı
  isteğe bağlı ve onaylıdır (K5).

## 7. Test stratejisi

### 7.1 Birim (`tests/unit`, CI)
- `normalizeDoi` ve `doiAyikla` sarmalayıcısı: önek, büyük/küçük harf,
  sondaki noktalama, SICI açılı parantez, geçersiz girdiler.
- `lib/kaynak-ekleme.ts` karar modülü: geçersiz / tekrar / ekle; çalışmasız
  kaynak; yumuşak silinmiş kaynak tekrar sayılmaz.
- Silme kararı: atıf kesin / olası / yok × kanıt × PDF → kalıcı mı yumuşak mı,
  okunamadıysa "denetlenemedi".
- ZIP manifesti (saf fonksiyon): kaynak kümesi, dosya adları, eksik dosya
  raporu satırları — inmeyen dosya raporda, paket düşmez.

### 7.2 TS ↔ SQL ikizi
- Ortak örnek tablosu `tests/fixtures/doi-normallestirme.json`: aynı
  girdiler hem `normalizeDoi`'de (`tests/unit`) hem `doi_normallestir`'de
  (`tests/db`) aynı çıktıyı vermeli (AGENTS.md: kanıt metni
  normalleştirmesinin deseni).

### 7.3 Veritabanı (`tests/db`, PGlite, CI)
- **Meşru akışlar** (kuralın önce yazılması gereken kısım):
  ekleme, not güncelleme, durum değiştirme, aynı DOI'yi başka çalışmaya
  ekleme, yumuşak silme ve geri alma, yumuşak silinmiş DOI'yi yeniden
  ekleme, mevcut tekrar satırının notunu güncelleme, PDF'i kendi
  çalışmasının kaynağına bağlama.
- **Reddedilmesi gerekenler:** aynı çalışmaya aynı DOI (farklı yazımla:
  büyük harf, `https://doi.org/` önekli), başka çalışmanın kaynağına PDF
  bağlama, `silen`'i istemciden yazma, başkasının kaynağını yumuşak silme,
  `kaynak_doi_var_mi`'yi yazamadığı çalışma için çağırma, anon erişimi.
- Abonelik tetikleyicisinin yeni sütunlarla da çalıştığı.
- `tests/db/guvenlik.test.mjs`: yeni fonksiyonların kime açık olduğu.
- Test dosyalarının migration listesinde eski gövde sorunu: tetikleyiciyi
  değiştiren migration listeye SONDAN eklenir (eski bir
  `create or replace` yeni gövdeyi ezer ve test sessizce eski kuralı sınar);
  kuralın yürürlükte olduğu reddedilme bekleyen bir senaryoyla kanıtlanır.

### 7.4 Editör (`tests/editor`, CI)
- `atif` işareti şemada; kaydedilip geri yüklenir; bul-değiştir ve
  kopyala-yapıştırda korunur; yabancı kimlik okunurken yok sayılır.
- `cikti-yollari.test.ts`: işaretli ve işaretsiz belge üç çıktıda **aynı**.
- `cikti-referans.test.ts`: referans DEĞİŞMEZ (işaret çıktıya girmez).

### 7.5 Tarayıcı kabulü (önizleme, CI dışı)
- `kabul.mjs`: aynı DOI ikinci kez → mesaj ve mevcut kaynağa yönlendirme
  (iki yol: Kaynaklar ve editör); atıflı kaynakta silme uyarısı ve geri
  alma; "Kaldırılanlar".
- `cikti-kabul.mjs`: Word/PDF referansla aynı (her dilimde).
- ZIP: paket indirilir, içindekiler listelenir, `belge.docx` Word
  özetleyicisinden geçip düğmeden inen belgeyle aynı yapıda, eksik dosya
  raporu beklenen satırları taşıyor.
- Sahte istemci (`scripts/onizleme/sahte-istemci.ts`) tetikleyicileri
  taklit etmez → mükerrer DOI reddi önizlemede uygulama kuralıyla görülür;
  veritabanı kuralı yalnızca `tests/db` ve Test ortamında sınanır.

### 7.6 Test ortamı (Supabase Test)
- Her migration Test'te uygulanır; ön rapor + son durum sayıları;
  uygulamanın meşru akışları Preview'da elle (ekleme, tekrar, silme,
  geri alma, ZIP).

## 8. Uygulama dilimleri (her biri ayrı onay)

| Dilim | İçerik | Migration | Kabul |
|---|---|---|---|
| A1 | Tek DOI kuralı + tekrar karar modülü; bütün ekleme yolları aynı kurala bağlı. **UYGULANDI (07.11.2026, yerel)** — ayrıntı 8.1 | yok (tekrar denetimi uygulamada) | 7.1, `kaynak-ekleme-kabul.mjs`, `tests/db/kaynak-ekleme` |
| A2 | M1 + yumuşak silme akışı, uyarı, "Kaldırılanlar", tek sorgu yardımcısı | M1 | 7.3, 7.5 silme |
| A3 | M2 + M3 + M4: DOI sütunu, geri doldurma raporu, veritabanı tekrar engeli | M2–M4 | 7.2, 7.3 |
| A4 | K5: `atif` işareti, ekleme yolları, okuma kuralı (bağlama aracı YOK) | yok (TipTap şeması — **TipTap mimarisine dokunur**) | 7.4, cikti-kabul |
| A4b | K8: eski belgeler için onaylı bağlama aracı; otomatik değişiklik yok | yok | 7.4, kabul (her bağlama kullanıcı onayıyla, sürüm geçmişinde) |
| A2b | K7: 30 günlük süre ve ilişkisiz kaynakların temizliği (zamanlanmış iş) | yok (M1'in sütunları) | birim: ilişki denetimi; ilişki okunamazsa hiçbir şey silinmez |
| A5 | M5 + K4 ZIP (DOCX, RIS, BibTeX, PDF, eksik dosya raporu) | M5 | 7.1 manifest, 7.5 ZIP |
| A6 | M6 (tekrar sayısı sıfırsa) | M6 | 7.3 |

A3 ile A4 bağımsız; A2, A4'ten önce gelirse silme uyarısı ilk günde yalnızca
metin eşleşmesine dayanır ("olası" etiketiyle) — kabul edilebilir.

### 8.1 A1'in uygulanan kapsamı ve bilerek dışarıda bırakılanlar

Uygulanan (veri modeli, migration, `doi_or_url` değerleri, PDF bağları ve
TipTap yapısı DEĞİŞMEDİ):
- **Tek DOI kuralı** `lib/doi.ts` (`normalizeDoi`, `doiAnahtari`,
  `metindekiDoiler`); `lib/kaynak-aktarim.ts` ve `lib/kanit/kunye-karsilastirma.ts`'teki
  `doiAyikla`'lar ve editördeki yerel anahtar ona bağlandı.
- **Tekrar kararı** `lib/kaynak-ekleme.ts` (saf), **kapsam sorgusu**
  `lib/kaynak-kapsami.ts` (çalışma / genel kütüphane, yalnızca kendi kaynakları).
- Yollar: elle ekleme (aynı DOI artık engel), atıf penceresi ve "Cümleye
  kaynak bul" (aynı DOI yeni satır açmaz, mevcut kaynak döner), arama
  sonucundan ekleme (istemci DOI'si doğrulanır, aynı DOI engel), DOI
  listesi (başlık+yıl ile atlanan künye artık "vardı" raporlanır).
- Kapsam okunamazsa DOI'li kayıt eklenmez (engelin sorgusu hata yutmaz).

Bilerek dışarıda bırakılan (karar ya da ayrı dilim gerekir):
- `lookupDoi` abonelik kapısı / saat hakkı — kullanım politikası (bölüm 10).
- `createCitationSource`'un kaynağı `used` olarak açması — durum kuralı
  (bölüm 4 K1-5) ayrı karar; A1 yalnızca doğrulama/tekrar/kapı/yetki.
- `lib/academic-reference-verification.ts`'teki özel DOI temizleyici —
  kullanıcı girdisi değil, dizin cevabı okuyor; katılaştırmak kaynakça
  denetiminin sonucunu değiştirebilir. Ayrı dilimde, önce/sonra
  karşılaştırmasıyla.
- Uygulama düzeyi tekrar denetimi kapsamı PostgREST satır tavanıyla
  sınırlı (lib/kaynak-kapsami.ts notu); kesin çözüm M3/M4.

## 9. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| `doi_or_url`'den DOI çıkarma hatalı (adres, kısaltılmış DOI) | yanlış tekrar reddi | M3 yalnızca doldurur, reddetmez; ön rapor; M4 ayrı |
| İnvoker tetikleyici başkasının satırını göremez | tekrar kaçar | `kaynak_doi_var_mi` definer yardımcısı, yalnızca boolean, yazma yetkisi şartlı |
| Yumuşak silinmiş kaynak sayılara karışır | sayaç hatası | tek sorgu yardımcısı + `check:rakamlar` kapsamı |
| Atıf işareti çıktıya sızar | teslim belgesi değişir | R0 referans testleri, `cikti-yollari` satırı |
| Yapıştırılan yabancı kimlik | yanlış bağ | okurken çalışma denetimi + yapı uyarısı |
| ZIP'te büyük PDF / dolan imzalı bağlantı | eksik paket | parça parça bağlantı, eksik dosya raporu, paket düşmez |
| Önizleme sahte istemcisi tetikleyici taklit etmez | önizlemede kural görünmez | veritabanı kuralı `tests/db` + Test'te sınanır (7.5 notu) |
| Mevcut tekrarlar M6'yı süresiz erteler | benzersizlik yalnızca tetikleyicide kalır | tetikleyici yeterli koruma; M6 iyileştirme |

## 10. Açık sorular

Önceki üç soru K6, K7, K8 ile kapandı (07.11.2026). Açık olan:

1. **`lookupDoi` (editörde DOI ile künye arama) abonelik kapısı ve saat
   hakkı.** Bugün kapısız ve hak sınırı yok (A1 denetimi); Kaynaklar'daki
   dizin araması (`literaturAramasiYap`) hem kapılı hem saatlik haklı.
   Kullanım politikası değişikliği olduğu için A1'de DEĞİŞTİRİLMEDİ;
   karar bekliyor.
