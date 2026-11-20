# AI kartı, kısaltma uyarısı ve B-16 (M4, 20.11.2026)

Bu dal **M2'ye bağlıdır** (`claude/m2-alinti-ekleme`): kaynakça girdisini
yazan saf işlem (`kaynakcaGirdisiIslemi`) M2'nin `atifIslemi`'nden ayrıldı.

| Konu | Eski davranış | Şimdi |
|---|---|---|
| Kart geri alma | "Eklendi" kilitli kalıyordu; Ctrl+Z sonrası öneri yeniden eklenemiyordu | Kart belgeye bakar (asistan izi duruyor mu); geri alınca yeniden etkin |
| Kısaltma | İstem "anlamını koruyarak kısalt"; olumsuzluk/atıf düşebiliyordu | İstem korunacakları sayar; panel somut kayıpları (kısalmama, olumsuzluk, atıf, sayı) uyarı olarak gösterir — örtüşme oranı kullanılmaz, karar öğrencinin |
| B-16 | AI metni düz atıfla giriyor, Kaynakça güncellenmiyordu | Tek kaynakla eşleşen atıfın künyesi metinle AYNI işlemde Kaynakça'ya yazılır (tek Ctrl+Z ikisini birlikte alır); aynı eserin kopyaları tek eser sayılır; ayrı eserlere uyan atıf belirsizdir, eklenmez ve söylenir; CSL stilinde künye önceden citeproc'tan alınır, alınamazsa metin de girmez |

Kabul: `node tasarim/ai-kart/betikler/kabul.mjs` — **10/10** (`kabul-sonucu.json`),
model taklidiyle.

Kalan / doğrulanmayan:
- Numaralı (IEEE, Vancouver) ve dipnotlu stillerde AI metnindeki yazar–tarih
  atıfı stile ÇEVRİLMİYOR; yalnızca künye Kaynakça'ya yazılıyor.
- CSL stil yolu (citeproc'tan künye) tarayıcıda sınanmadı; birim/editör
  testleri yerleşik APA ile.
- Gerçek modelin yeni kısaltma istemine uyumu ölçülmedi.
