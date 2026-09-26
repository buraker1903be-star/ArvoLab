<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# ArvoLab

Akademik çalışma yazım ve analiz platformu. Next.js 16 · React 19 · Supabase.
Genel tanıtım, kurulum ve komutlar için `README.md`.

## Dil

Arayüz metinleri, hata mesajları ve kod yorumları **Türkçe**. Yorumlar "ne
yaptığını" değil **neden öyle olduğunu** anlatır; bir hata düzeltiliyorsa eski
davranış da yazılır ("Eskiden … oluyordu"). Yeni kod bu üsluba uyar.

## Değişmezler

- **Abonelik kapısı.** Dış maliyet üreten (OpenAI, depolama, ağır çözümleme)
  ya da yeni içerik yazan her server action `isSubscriptionBlocked()`
  çağırmalı. Paneldeki kapı yalnızca ekranı kapatır; sunucu işlemi doğrudan
  çağrılabilir. Hangi işlemde kapı var, hangisinde bilerek yok — listesi
  `lib/access.ts` içinde. Ödeme, giriş ve destek yolları **asla** kapatılmaz:
  engellenen kullanıcı kendi kilidini açabilmeli.
- **Kapıyı yalnızca net bir "hayır" kapatır.** Kurum kaydı okunamazsa,
  ArvoOS'a ulaşılamazsa ya da lisans hiç bildirilmemişse kimse engellenmez
  (`lib/license-decision.ts`). Geçici bir arıza kullanıcıları dışarıda
  bırakmamalı. İç ekip (`system_admin`, `founder`) hiçbir koşulda engellenmez.
- **Okuma kurumla sınırlıdır.** Gözetim rolleri (`controller`,
  `academic_manager`, `expert`) yalnızca KENDİ kurumunun verisini görür;
  kurumlar arası görüş yalnızca iç ekipte (`system_admin`, `founder`).
  Kural tek yerde: `public.gozetim_kapsami(kurum, roller)`. Yeni bir okuma
  politikasında çıplak `has_role(...)` yazmayın — 20260924100028'e kadar
  öyleydi ve A kurumunun Kontrolörü B kurumunun tezini, dosyasını ve asistan
  kaydını okuyabiliyordu. **NULL kurum asla eşleşmez:** bireysel abonenin
  `organization_id`'si NULL, iki NULL'ı eşit saymak bütün bireysel aboneleri
  birbirine açar.
- **`ADMIN_ROLES` yalnızca `system_admin` ve `founder`.** `academic_manager`,
  `controller`, `expert` ve `employee` abonelik kapısından geçer; personel
  akışlarına kapı eklerken bunu hesaba katın.
- **`lib/auth-guards.ts` bilerek `"use server"` DEĞİL.** "use server"
  dosyasındaki her export dışarıdan çağrılabilir bir uç noktaya dönüşür.
  Yardımcılar ve tipler böyle dosyalarda durmaz.
- **RLS asıl güvenlik katmanıdır.** Sunucudaki rol kontrolü yetkisiz isteğin
  sessizce "başarılı" görünmesini engeller ve kullanıcıya anlaşılır mesaj
  verir; RLS'in yerini tutmaz.
- **Paylaşım belirteci veritabanında ham tutulmaz.** Yalnızca SHA-256 özeti
  yazılır, belirtecin kendisi bir kez gösterilir (`lib/share-token.ts`).
- **Asistan denetler, yazmaz.** Yapay zeka yetenekleri (`lib/ai/`)
  kullanıcının çalışmasına yapıştırabileceği metin üretmez: neyin eksik
  olduğunu ve neden önemli olduğunu söyler, cümlesini kurmaz. Kural hem
  sistem isteminde hem de kodda durur.
- **Asistanın ürettiği her sayı girdide geçmek zorunda.** `lib/ai/bulgu.ts`
  çıktıyı tarar; bağlamda geçmeyen tek bir değer varsa cevabın tamamı düşer
  ve kullanıcıya hiç gösterilmez. Bir kısmı doğru olan listeye güvenmek en
  tehlikelisidir — hangi değerin uydurulduğunu kullanıcı ayıklayamaz.
  Denetim **sayısal bir VERİ değeri** taşıyan yeteneklerde uygulanır: analizde
  p değeri ve etki büyüklüğü, kaynakçada yıl, cilt, sayfa. Literatür
  tavsiyesinde böyle bir değer yoktur ("COVID-19", "2000'ler", "son 15-20
  yıl"); orada denetim yerine `kunyeIzi` çalışır. Yanlış alarm, kaçırılan
  uydurmadan sinsidir: kullanıcı doğru çalışan aracı kullanmayı bırakır.
- **Asistan kaynak önermez.** Literatür yeteneği arama stratejisi üretir;
  yazar, başlık, dergi ya da DOI yazması yasaktır (`kunyeIzi` kodda da
  denetler). Uydurma künye akademik çalışmada en ağır hatadır.
- **Her asistan çalışması kaydedilir** (`lib/ai/kayit.ts` →
  `ai_assistant_runs`). Bu tablo ArvoLab'ın kendi modelini eğitecek veridir;
  asıl varlık model değil, buradaki gerçek girdi/çıktı ve kullanıcının
  değerlendirmesidir. Kayıt akışı düşürmez: yazılamazsa yalnızca log'a gider.
  İçerik sonradan değiştirilemez (`guard_ai_run_update`).
- **Yeni yetenek `lib/ai/erisim.ts` kapısından geçer.** Oturum, abonelik,
  kurulum ve KULLANICI başına saatlik hak orada; yetenek başına ayrı sayaç
  tutulmaz, yoksa aynı kullanıcı her yetenekten ayrı hak kazanır.
- **E-posta gönderimi akışı düşürmez.** `RESEND_API_KEY` yoksa gönderim
  sessizce atlanır; davet ve şifre sıfırlama istekleri çalışmaya devam eder
  (hesabın varlığını sızdırmamak için de gerekli).

## Migration

**`supabase migration new` kullanmayın**, `npm run db:new -- <ad>` kullanın.
Dosyalar bir dönem gerçek tarihle değil "bir sonraki gün" mantığıyla
adlandırıldı; bugünün damgasıyla açılan dosya uygulanmışların önüne sıralanır.
Gerekçe ve denetim: `scripts/check-migrations.mjs`. Mevcut migration
düzenlenmez, yenisi eklenir. Yeni tablo eklerken RLS'i açıp politikalarını
aynı migration içinde yazın.

## Testler

`tests/unit/` yalnızca Next, React ya da Supabase'e dokunmayan saf mantık
modülleri içindir. Bir mantık parçası test edilemiyorsa nedeni genellikle
böyle bir dosyanın içinde durmasıdır — ayırın. Bir hata düzeltince onu
sabitleyen testi de ekleyin.

`tests/editor/` (`npm run test:editor`) editörün eklenti listesinden
(`lib/tiptap-extensions.ts`) belge şemasını **tarayıcı olmadan** kurar
(`getSchema`) ve gerçek ProseMirror belgeleri üzerinde çalışır: şema
sözleşmesi, bul-değiştir, başlık numaraları, yazdırma HTML'i. DOM taklit
edilmiyor — taklidin davranışı tarayıcıyla birebir olmadığı için yeşil bir
test yanlış güven verir; bu yüzden `renderHTML`, `parseHTML`, seçim ve
kısayol davranışı kapsam dışı. Eklenti listesi editör bileşeninden ayrıldı:
test ile üretim AYNI listeyi kullanmalı, yoksa test kendi kopyasını
doğrular.

`tests/db/` (`npm run test:db`) `supabase/schema.sql` ve migration'ları
PGlite'a kurar; kuralları Supabase rolleriyle (anon, authenticated) doğrudan
veritabanına gelen isteklerle sınar. Bir tabloya koruma (tetikleyici, RLS)
eklerken uygulamanın **meşru** akışını da orada sınayın.

**Her yeni fonksiyonun ardından `revoke all on function … from public, anon,
authenticated;` ve yalnızca gereken role `grant`.** Postgres yeni fonksiyonu
herkese açar; yalnızca `from public` yetmez (Supabase anon/authenticated'a
ayrıca verebilir). ArvoARC'ta siparişi "ödendi" yapan fonksiyon bu yüzden
herkese açık kaldı. `tests/db/guvenlik.test.mjs` hangi fonksiyonun kime açık
olduğunu sabitler; RLS politikasında kullanılan yardımcılar açık kalır.

## Kontroller

`npx tsc --noEmit`, `npm run lint`, `npm run check:css`,
`npm run check:migrations`, `npm run check:rakamlar`, `npm run test:unit`,
`npm run test:editor`, `npm run test:db` — sekizi de CI'da (`.github/workflows/ci.yml`) çalışır.
Derleme CI'da yapılmaz, Vercel tarafında.

**Rakam denetimi** (`npm run check:rakamlar`): ekrandaki sayıların iki
bilinen yanlış kaynağını arar. Birincisi `.limit()` ile sınırlı bir
sorgudan sayı çıkarmak — `.reduce()` ile toplamak, döngüde `+=` ile
biriktirmek ya da `.filter(…).length` ile saymak. Sınıra ulaşılana kadar
hiçbir belirti vermez; 26.09.2026'da `ai_assistant_runs` üzerinde iki kez
çıktı (ince ayar dışa aktarımı ve model karşılaştırması, ikisi de
`.limit(5000)` ve sıralamasız). İkincisi tuzak sütun: `extracted_rules`
kılavuzun ÇALIŞMA HÂLİNDEKİ kuralları, öğrencinin editörüne inen sürüm
`approved_snapshot` içindedir (`lib/guideline-rules.ts`). Bilerek
kullanıyorsanız satıra ya da üstündeki yorum bloğuna `tuzak-tamam: <sebep>`
yazın — sebebi yazmak, denetimi susturmanın bedeli. Denetimin kendisi
`tests/unit/check-rakamlar.test.ts` ile sınanır: kör kalan bir denetim,
denetlediği hatadan farksızdır.

## Stil

TSX'te satır içi stil ve ham hex renk yok; ham renk yalnızca
`app/styles/tokens.css`'te. En küçük yazı 11px. `npm run check:css` denetler.
