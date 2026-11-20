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
| 7 | Otomatik mod saatlik hakkı tüketiyor | Hak sohbetle ortak (kullanıcı başına tek sayaç, bilerek) | Otomatik yolun istemci sınırı: 12 sn aralık, saatte 12 (`lib/oneri-siniri.ts`); elle istek sınırsız |
| 8 | Bulgu uydurma riski | Sayı ve atıf denetleniyor, "bulgular gösterdi" sayısız da kurulabiliyor | `bulguIddiasi`: öncesinde dayanağı yoksa öneri düşer (red nedeni migration gerektirmesin diye boş, ayrıntı `findings.neden = "bulgu"`) |

Korunanlar: öneri süslemedir, belgeye/kayda/kelime sayısına/çıktılara girmez;
yazma ve imleç hareketi siler; geç cevap belge değiştiyse gösterilmez;
Tab yalnızca öneri görünürken kabul eder (yoksa tabloda hücre değiştirir).

## Kabul

`node tasarim/satir-ici-oneri/betikler/kabul.mjs` — yerel yığın + model
taklidi, **28/28** (`kabul-sonucu.json`). Masaüstü TR, masaüstü EN (İngilizce
arayüz + İngilizce belge), telefon (iPhone 13 öykünmesi).

**Gerçek servisle doğrulanmadı:** cevaplar model taklidinden
(`scripts/yerel-yigin/model-taklidi.mjs`). Gerçek modelin tek cümle
kuralına, bulgu yasağına uyumu ve önerilerin kalitesi ölçülmedi. Telefon
klavyesi görünüm yüksekliği daraltılarak taklit edildi; gerçek iOS/Android
klavyesiyle denenmedi.
