# İlk kullanım ve plan seçimi — yerel kabul (#155, 25.11.2026)

Dal `claude/ilk-kullanim`. Ortam: yerel yığın (Postgres 17 + GoTrue +
PostgREST + geçit) ve ArvoOS köprüsünün yerel taklidi
(`scripts/yerel-yigin/arvoos-taklidi.mjs`). **Üretim derlemesi**
(`next build` + `next start`); kabul betiği, `.next/BUILD_ID` sunucunun
HTML'inde geçmeden başlamıyor. Production'a ve paylaşılan Test'e hiçbir
istek yapılmadı. **Gerçek ödeme yok:** taklit bir https ödeme adresi
döndürüyor, betik onu yakalayıp uygulamaya geri yönlendiriyor.

**190 kontrol · 190 geçti · 0 kaldı**, 1440 ve 390 px × açık ve koyu tema.
Betik: `scripts/yerel-yigin/ilk-kullanim-kabul.mjs`.

## Bugünkü ArvoOS kataloğuyla: kartlar kapalı, mevcut ödeme yolu çalışıyor

Bu bölüm **üretimin bugün bulunduğu durumu** yeniden üretiyor: köprü
yalnızca kod, dönem ve tutar bildiriyor (ücret tek bir
`individual_monthly_fee` sütununda; `lib/billing-plan.ts`'teki kayıtlı
gözlem), plan **adı**, **dahil kredi** ve **avantajlar** gelmiyor. Taklitteki
karşılığı `KATALOG_BUGUN`.

| # | Sınama | Gözlenen (dört görünümde aynı) | |
|---|---|---|---|
| G1 | Üç kartlı bölüm, kullanıcı DENEMEDE iken | `bölüm=false deneme=true` — bölüm **çizilmiyor** | PASS |
| G2 | Lisans kartında gerçek ödeme düğmesi, tutarıyla | `["Kartla öde · Aylık 149,00 ₺", "Kartla öde · Yıllık 1.490,00 ₺"]` | PASS |
| G3 | Deneme bitiş tarihi lisans kartında | `tarih=true` | PASS |
| G4 | Ödeme yolu **çalışıyor**: düğme akışı açıyor ve plan kodu gidiyor | `ödeme ekranındaki plan=arvolab-aylik` | PASS |

Kapı `lib/plan-satis.ts` → `planKartlari()`: bir satırın karta dönüşmesi için
kod, ad, fiyat, dönem, pozitif kredi ve en az bir avantaj gerekiyor; ad'ın
satış metni tanınan bir kademe olmalı (`standart`/`plus`/`pro`); sonunda tam
üç kademe ve tekil kodlar şart. Bugünkü katalogda ad, kredi ve avantaj
eksik olduğu için `[]` dönüyor, `PlanSecimi` `null` çiziyor ve `satisHazir`
false kaldığı için lisans kartındaki ödeme bölümü de susturulmuyor.

**İkinci kilit:** ArvoOS `ad` alanını plan *koduyla* doldursa bile
(`"arvolab-aylik"`) o ad tanınan bir kademe değil → kart yok → bölüm kapalı.
Yarım dolmuş bir katalog satışı kazara açamıyor.

### Ölçüm düzeltmesi — eski G bloğu iki şeyi yanlış yerden geçiyordu

Bu blok ilk turda `ik-bos` kullanıcısında koşuyordu ve **iki iddiayı da
ölçmüyordu**; incelemede görüldü ve düzeltildi:

- O kullanıcı taklitte `active` (deneme DEĞİL) ve yenilemeye 14 günden fazla
  var. `PlanSecimi` yalnızca denemede çizildiği için bölüm "katalog eksik"
  diye değil, **kullanıcı denemede olmadığı** için gizliydi: katalog kapısı
  hiç sınanmıyordu.
- `showPayment` etkin abonede (yenileme uzakken) false, yani ödeme düğmesi
  zaten çizilmiyordu. Eski ölçüt `main` metninde "abonelik" kelimesini
  arıyordu ve o kelime **"Abonelik planı henüz tanımlanmadı"** cümlesinden
  geliyordu — düğme hiç olmadan da geçiyordu. Eski G3 `ödemeDüğmesi=false`
  ölçüp bu değeri kaydetmiş ama geçme koşuluna katmamıştı.

Yeni blok deneme üyesiyle ve `KATALOG_BUGUN` ile koşuyor; düğmenin tutar
taşıması ve akışı gerçekten açması da ölçütte.

## Öteki bölümler

| # | Ölçülen | |
|---|---|---|
| I1–I2 | "İlk çalışmanızı oluşturun" kartı var ve karşılamanın HEMEN altında (lisans kartı sonra) | PASS |
| P1–P7 | Katalog dolu senaryoda üç eşit kart; başlık; deneme bitiş satırı kartların üstünde; her kartta ad/fiyat/dönem/kredi/satış metni/kod/düğme; avantajlar katalogdan; 390'da tek sütun, sıra Standart→Plus→Pro, üç düğmeye kaydırarak erişim | PASS |
| B0 | Denemede navigasyonda ücretli etiket YOK (`nav=""`), üç kademede de | PASS |
| B0b–B0c | Lisans kartında tekrar eden "Kartla öde" yok; sözleşme notu tek ve üç kartın altında | PASS |
| B0d | Masaüstünde üç ana düğme aynı yatay çizgide (`[717,717,717]`) | PASS |
| B0e–B0g | Yıllık seçenek kendi planına ad ve KODLA bağlı (`standart-yil` ≠ `standart-ay`), kendi ana düğmesinin altında, boş düğme yok; deneme tarihi tek yerde | PASS |
| B1–B4 × Standart/Plus/Pro | Her kademe ayrı: ödeme ekranına **seçilen** kod gidiyor; etkinleşen plan Abonelik, Ana Sayfa, navigasyon ve Ayarlar'da aynı | PASS |
| V1–V2 | İptalde deneme sürüyor ve seçim yine sunuluyor | PASS |
| H1–H2 | Hatada kullanıcıya mesaj gösteriliyor, deneme sürüyor | PASS |

## Ölçümün sınırı

Kabul **taklit köprüyle** koştu. Dolu katalog senaryosundaki fiyatlar,
krediler ve avantajlar **test verisi**; ödeme sonrası etkinleşme taklidin
döndürdüğü durumla sağlandı. Ölçülen şey ArvoLab'ın bu veriyi doğru okuyup
doğru çizdiği ve doğru plan kodunu ödeme akışına gönderdiğidir — ArvoOS'un
bunları gerçekten bildirdiği **değil**. Canlı köprünün yanıtı bu oturumdan
doğrulanamadı: **UNVERIFIED**.

Üç planı satışa açmadan önce gereken ArvoOS işleri ve test ortamı
doğrulaması: `tasarim/tek-deneyim/PLAN-SATISI-ACILIS.md`.
