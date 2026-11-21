# Satır içi öneri (otomatik cümle tamamlama) — M10, 20.11.2026

Mevcut altyapı yeniden yazılmadı (`lib/tiptap-satir-ici-oneri.ts`,
`app/dashboard/editor/[id]/write/satir-ici-oneri.tsx`, yazım asistanının
`tamamla` görevi). Neden çalışmıyor göründüğü gerçek uygulamada izlendi ve
düzeltildi.

## Bulunan nedenler

| # | Belirti | Kök neden | Düzeltme |
|---|---|---|---|
| 1 | "Öneri"ye tıklayınca hiçbir şey olmuyor | Düğme yalnızca otomatik modu sessizce açıp kapatıyordu | Açınca/kapatınca ne olacağını söyleyen bildirim, odak editöre döner |
| 2 | Alt+/ sonrası sunucu öneri döndürüyor, ekranda yok | Konum tuşa basıldığı ANDA okunuyordu; ProseMirror imleci `selectionchange` ile sonra güncelliyor → `oneriGoster` konum tutmadığı için öneriyi sessizce düşürüyordu (ölçüm: istek konumu 67, imleç 147) | Okuma bir sonraki göreve ertelendi |
| 3 | İlk cümlede otomatik öneri yok | 80 karakter eşiği | 40 |
| 4 | Telefonda kabul yolu yok | Tab yok | Kaba işaretçide öneriyle birlikte "Ekle" düğmesi; dokunuş ProseMirror'a geçmez (`stopEvent`), yoksa imleç taşınıp öneri düşüyordu |
| 5 | Gri metin paragrafı kaplıyor | İstem "en çok iki cümle", istemci 400 karakter | İstem: en çok bir kısa cümle; istemci ilk cümle sonunda keser (`ilkCumle`) |
| 6 | Ctrl+Z son yazılan sözcüğü de siliyor | Kabul, hemen önce yazılan harflerle aynı geçmiş grubuna giriyordu | `closeHistory` önce ve sonra: kabul tek adım |
| 7 | Otomatik mod hak/kota dolunca sessizce kapanıyordu | İstemcide sabit "saatte 12" (localStorage) bir ürün sınırı gibi davranıyordu; sunucunun reddi görünmüyordu | Sınır SUNUCUDA (aşağıda); istemcide sabit sınır yok. Red nedeni görünür bir duruma çevrilir |
| 8 | Bulgu uydurma riski | Sayı ve atıf denetleniyor, "bulgular gösterdi" sayısız da kurulabiliyor | `bulguIddiasi`: öncesinde dayanağı yoksa öneri düşer (red nedeni migration gerektirmesin diye boş, ayrıntı `findings.neden = "bulgu"`) |

## Sınır sunucuda (20.11.2026, ikinci tur)

İstemcideki "12 sn aralık, saatte 12" (`lib/oneri-siniri.ts`) kaldırıldı.
Bir öneri yazım asistanının bir çağrısıdır ve onun kapısından geçer
(`app/actions/ai-yazim.ts`, `lib/ai/erisim.ts`):

- abonelik, deneme ve kurum kredisi (kapı; diğer yeteneklerle aynı),
- kullanıcı başına saatlik asistan hakkı (sohbetle ORTAK, `lib/ai/sinirlar.ts`;
  yetenek başına ayrı sayaç tutulmaz — AGENTS.md),
- yalnızca tamamlamaya özgü **en az 3 sn aralık** (`TAMAMLAMA_EN_AZ_ARALIK_SN`):
  ayrı bir hak DEĞİL, daha sıkı bir fren; frene takılan istek saatlik hakkı
  tüketmez.

Sunucu reddi `sinir` alanıyla döner (`aralik` / `saatlik` / `kapi` / `deneme`).
Aralıkta otomatik yol kısa süre sonra kendisi yeniden dener; diğerlerinde öneri
"duraklatıldı" durumuna geçer: düğme "Öneri · N dk" ya da "Öneri · duraklatıldı"
der, ipucunda nedeni yazar, Alt+/ aynı nedeni bildirir. Saatlik hak açılınca
durum kendiliğinden "hazır"a döner; düğmeyi yeniden açmak duraklatmayı sıfırlar.

**Açık ürün kararı:** öneri, sohbetle ortak saatlik 20 hakkı ve kurum
kredisini harcıyor. Otomatik mod açık bir öğrenci yoğun yazarken bu hakkı
sohbetten önce tüketebilir. Ayrı bir öneri kotası istenirse bu AGENTS.md'deki
"yetenek başına ayrı sayaç tutulmaz" kuralının bilinçli bir istisnası olur.

Korunanlar: öneri süslemedir, belgeye/kayda/kelime sayısına/çıktılara girmez;
yazma ve imleç hareketi siler; geç cevap belge değiştiyse gösterilmez;
Tab yalnızca öneri görünürken kabul eder (yoksa tabloda hücre değiştirir).

## Kabul

`node tasarim/satir-ici-oneri/betikler/kabul.mjs` — yerel yığın + model
taklidi, **31/31** (`kabul-sonucu.json`). Sunucu freni (art arda ikinci istek
saatlik hakkı tüketmeden reddedilir ve söylenir) ve hak doluyken duraklatma
(düğme kalan süreyi gösterir, otomatik istek gitmez, Alt+/ nedeni söyler) dahil. Masaüstü TR, masaüstü EN (İngilizce
arayüz + İngilizce belge), telefon (iPhone 13 öykünmesi).

**Gerçek servisle doğrulanmadı:** cevaplar model taklidinden
(`scripts/yerel-yigin/model-taklidi.mjs`). Gerçek modelin tek cümle
kuralına, bulgu yasağına uyumu ve önerilerin kalitesi ölçülmedi. Telefon
klavyesi görünüm yüksekliği daraltılarak taklit edildi; gerçek iOS/Android
klavyesiyle denenmedi.
