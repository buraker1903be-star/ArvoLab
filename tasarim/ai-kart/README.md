# AI kartı, kısaltma uyarısı ve B-16 (M4, 20.11.2026)

Bu dal **M2'ye bağlıdır** (`claude/m2-alinti-ekleme`): kaynakça girdisini
yazan saf işlem (`kaynakcaGirdisiIslemi`) M2'nin `atifIslemi`'nden ayrıldı.

| Konu | Eski davranış | Şimdi |
|---|---|---|
| Kart geri alma | "Eklendi" kilitli kalıyordu; Ctrl+Z sonrası öneri yeniden eklenemiyordu | Kart belgeye bakar (asistan izi duruyor mu); geri alınca yeniden etkin |
| Kısaltma | İstem "anlamını koruyarak kısalt"; olumsuzluk/atıf düşebiliyordu | İstem korunacakları sayar; panel somut kayıpları (kısalmama, olumsuzluk, atıf, sayı) uyarı olarak gösterir — örtüşme oranı kullanılmaz, karar öğrencinin |
| B-16 | AI metni düz atıfla giriyor, Kaynakça güncellenmiyordu | Tek kaynakla eşleşen atıfın künyesi metinle AYNI işlemde Kaynakça'ya yazılır (tek Ctrl+Z ikisini birlikte alır); aynı eserin kopyaları tek eser sayılır; ayrı eserlere uyan atıf belirsizdir, eklenmez ve söylenir; CSL stilinde künye önceden citeproc'tan alınır, alınamazsa metin de girmez |

Kabul: `node tasarim/ai-kart/betikler/kabul.mjs` — **14/14** (`kabul-sonucu.json`),
model taklidiyle.

**İkinci adım (20.11.2026):** tek atıf içeren ve tek esere uyan parantez,
`aiAtiflariniBagla` ile mevcut `atifIslemi` üzerinden belgenin stilinde yeniden
üretilir: APA'da metin içi atıf, IEEE'de `[n]`, dipnotlu stilde dipnot düğümü;
CSL'de citeproc çıktısı. Kabul: 14/14 (IEEE ve dipnot senaryoları dahil).

Kalan / doğrulanmayan:
- Çoklu parantez ("(A, 2019; B, 2020)") ve anlatı atfı ("Demir (2019)")
  çevrilmez; eşleşen kaynağın künyesi Kaynakça'ya yazılır.
- CSL stil yolu (citeproc'tan künye) tarayıcıda sınanmadı; birim/editör
  testleri yerleşik APA ile.
- Gerçek modelin yeni kısaltma istemine uyumu ölçülmedi.
