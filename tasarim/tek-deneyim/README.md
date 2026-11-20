# Tek tip ArvoLab (20.11.2026, güncellenmiş ürün kararı)

ArvoLab tek tip, editör odaklı bir akademik araştırma ve yazma ürünüdür. Kurucu, personel ve bireysel
kullanıcı aynı ana deneyimi kullanır. ArvoLab başka kurumlara kiralanmaz; çok kurumlu yönetim ürünü
geliştirilmez. Görevlendirme ve operasyon ArvoOS'ta, akademik çalışma ArvoLab'da.

PR #113 önce ayrı bir "Yönetim" alanı kurmuştu (1. ve 2. tur). Karar güncellenince o alan da kalktı;
`betikler/kabul.mjs` ve `betikler/kabul2.mjs` o önceki kapsamı sınar ve artık koşulmaz (kayıt olarak
duruyor). Güncel kabul: `betikler/kabul3.mjs`.

## ArvoLab'da yapılanlar

| Konu | Şimdi |
|---|---|
| Doçentlik | Modül, puanlama ekranları, ÜAK tablosu, yazdırma dökümü, "Doçentlik dosyası oluştur" ve menü/Ctrl+K girişleri kaldırıldı. `/dashboard/associate-professorship` ve `/print/docentlik` Ana Sayfa'ya yönlenir. Sunucu yeni doçentlik dosyasını kabul etmez. |
| Yönetim | `/dashboard/yonetim` ve `/dashboard/yonetim/calismalar` yok (bulunamadı). Onay / onayı geri alma işlemleri, personel sayaçları, dikkat kartları ve toplu tutarsızlık taraması kalktı. |
| Kurum seçici | İç ekibin kurum seçicisi, "Yalnızca X gösteriliyor" şeridi ve kurum çerezi kalktı. Destek kuyrukları, ekip listesi, geri bildirim ve faturalar artık seçime göre süzülmüyor. |
| Kurum değiştirme | Ekip Yönetimi'nde "Kurum ekle", kişinin kurumunu değiştirme ve davette kurum seçimi kalktı. Kurum ve kurum bağı yalnızca ArvoOS'tan gelir (bkz. personel erişimi). |
| Ana deneyim | Ana Sayfa, Çalışmalarım ve Yeni çalışma herkes için aynı; yalnızca kişinin kendi çalışmaları. Yeni çalışma üç türlü (tez, makale, proje). |
| Personel erişimi | Kural kodda açık: `lib/erisim-yolu.ts`. Kuruma bağlı her hesap (rol fark etmez) kurum lisansından geçer, bireysel ödemeye hiç sorulmaz. Personel rolü tek başına hak vermez. Bağsız personelin kapalı erişim ekranı nedenini söyler. |
| Uzmana sor | Talepler şimdilik ArvoLab'da kaydediliyor ve buradan yanıtlanıyor (karar: geçici olarak koru). Personelin kuyruğu "Geçici kuyruk … bağlantı henüz kurulmadı" diyor. Kılavuzdaki "zil simgesiyle haber verilir" cümlesi kaldırıldı: kodda böyle bir bildirim yok. |

## Doçentlik verisi ve bağımlılıklar (silinmedi)

Hiçbir tablo, satır ya da dosya silinmedi; migration yok.

- **Tablolar:** `scoring_criteria`, `academic_score_entries`, `docentlik_hedefleri`, `docentlik_profili`, `uak_tablolari`.
  Dışa bağımlılıkları organizations, auth.users ve ai_assistant_runs'a; **hiçbir tablo bunlara bağlı değil**.
- **Doçentlik dosyaları:** `academic_projects.project_type = 'associate-professorship'` satırları duruyor, editörde açılıyor,
  "Doçentlik dosyası" etiketi ve kapak türü korunuyor. Check kısıtı bu türü hâlâ içeriyor.
- **Depo:** `project-files` kovasında `<kullanıcı>/docentlik/` ve `<kullanıcı>/uak/` klasörleri; depo envanteri onları tanımaya devam ediyor.
- **Asistan kayıtları:** `capability = 'uak'` satırları duruyor; eğitim kümesi onları kendi istemiyle dışa aktarmaya devam ediyor
  (`lib/ai/uak-tablosu.ts` bu yüzden silinmedi).
- **Kullanıcı verisi:** "Verilerimi indir" puan kayıtlarını vermeye devam ediyor.
- **Satır sayıları Production'dan okunmadı.** Okumak için (salt okunur):
  ```sql
  select 'scoring_criteria', count(*) from scoring_criteria union all
  select 'academic_score_entries', count(*) from academic_score_entries union all
  select 'docentlik_hedefleri', count(*) from docentlik_hedefleri union all
  select 'docentlik_profili', count(*) from docentlik_profili union all
  select 'uak_tablolari', count(*) from uak_tablolari union all
  select 'doçentlik dosyası', count(*) from academic_projects where project_type = 'associate-professorship';
  ```
- Silme ya da arşivleme ayrı bir karar ve ayrı bir migration olmalı.

## Mevcut entegrasyon: çalışan, eksik

**Çalışan:**
- ArvoOS → ArvoLab lisans yansıtması: `organizations.license_status / current_period_end / ai_credit_limit / synced_at` (servis anahtarıyla).
- ArvoOS → ArvoLab üye listesi: `arvoos_members` (e-posta). Bağ onaylı e-postayla veritabanında kurulur (`arvoos_uyeligini_bagla`); rol `client` kalır.
- ArvoLab erişim kapısı (uygulama + veritabanı `subscription_open`) bu yansıtılmış satırdan karar verir.
- ArvoLab → ArvoOS abonelik köprüsü (`/api/bridge/subscription`).

**Eksik:**
1. "Uzmana sor" → ArvoOS Talepler: ArvoLab ArvoOS'u çağırmıyor; ArvoOS'ta üründen talep açan bir uç yok.
2. ArvoLab çalışması ↔ ArvoOS İşler: iki tarafta da bağ sütunu yok.
3. Talep/iş durumunun ArvoLab'a geri dönüşü yok.
4. Durum kuralı uyuşmazlığı: ArvoOS `past_due`'yu açık sayıyor, ArvoLab kapalı sayıyor (ArvoLab tarafı bu turda değiştirilmedi: erişim sınırı gevşetilmedi).
5. Deneme bitişi (`trial_ends_at`) yansıtılmıyor; koltuk sayısı ArvoLab'da yok.
6. Kurumdan ayrılan personelin ArvoLab bağı kopmuyor (bağ hiç geri alınmıyor).

## ArvoOS tarafında gerekenler (bu depoda yapılmadı)

**A. AkademikMerkez personeli için (veri, kod değişikliği gerekmez):**
- AkademikMerkez'in `organization_product_licenses` tablosunda `product='arvolab'`, `status='active'` satırı olmalı ve "yeniden yansıt" çalıştırılmalı.
  Satır yoksa yansıtma `inactive` yazar ve üye listesini siler.
- Her personelin etkin `organization_memberships` kaydı olmalı ve ArvoOS e-postası ArvoLab'da kullandığı e-postayla aynı olmalı.
- Kontrol sorguları (ArvoLab, salt okunur): kurum satırının `license_status, current_period_end, synced_at`; `arvoos_members` sayısı;
  bağlanmamış personelin `organization_id` ve `email_confirmed_at` değeri.

**B. Durum kuralı:** `past_due` için tek kural. ArvoOS'ta `lib/arvolab.ts` (ACIK_LISANSLAR), `app/panel/uygulama/arvolab/route.ts`,
`lib/kopya-denetimi.ts`, `lib/kurum-lisansi-erisim.ts` aynı sabiti kullanmalı. ArvoLab'ın kuralı bilerek değiştirilmedi; karar verilince
iki taraf birlikte değişir. `trial_ends_at` da yansıtılmalı.

**C. Uzmana sor → Talepler (öneri sözleşmesi):**
- `POST {ARVOOS_BRIDGE_URL}/api/bridge/talep`, başlık `x-arvo-bridge-secret`, `kopruYetkili(req, "arvolab")`.
- İstek: `{ product:"arvolab", externalId:<consultancy_requests.id>, targetOrganizationId, requester:{arvolabUserId, fullName, email},
  requesterOrganizationId, requestType, message, projectId?, projectTitle? }`.
- Yineleme anahtarı `(organization_id, product, externalId)`: `crm_opportunities`'a `external_source` + `external_id` ve kısmi tekil dizin.
- `created_by` NOT NULL: aktör seçimi (ör. kurumun etkin sahibi), `stage:'lead'`, `source:'ArvoLab'`, panel bildirimi (`dedupeKey=externalId`).
- Cevap: `200 {yazildi:true, opportunityId}` / `200 {yazildi:false, sebep:"zaten var", opportunityId}`; 400/401/404/503/500.
- ArvoLab tarafı sonra: `consultancy_requests`'e `arvoos_opportunity_id`, `arvoos_sync_status (written|failed|bridge_off)`, `arvoos_synced_at`
  (migration), köprü çağrısı ve yeniden deneme; geçici kuyruk o zaman kalkar.

**D. Çalışma ↔ İşler:** `operation_workflows.arvolab_project_id` (kurum başına tekil) ve/veya ArvoLab'da ArvoOS'un yazdığı
`arvoos_is_baglari(project_id, organization_id, arvoos_workflow_id, synced_at)`; talep → sözleşme → iş zincirinde dış referansın taşınması.

**E. İsteğe bağlı:** ürün başına ayrı köprü sırrı (bugün arvoos/arvolab/arc `PRODUCT_BRIDGE_SECRET`'ı paylaşıyor).

## Kabul (yerel üretim derlemesi, sentetik veri)

**18/18 PASS** (`kabul3-sonucu.json`, `gorseller3/`). BUILD_ID `k-Sx_Wedxacn_MRrGlE7l`, yerel yığın 127.0.0.1.
Kurumlar ArvoOS'tan yansıtılmış gibi (`synced_at` dolu); K kurumunun lisansı kapalı.

| Senaryo | Sonuç |
|---|---|
| Doçentlik adresleri (kurucu, personel) | Ana Sayfa'ya iniyor; hesap menüsünde ve Ctrl+K'da doçentlik yok |
| Var olan doçentlik dosyası | Editörde açılıyor, Çalışmalarım'da "Doçentlik dosyası" etiketiyle |
| Yeni çalışma | Üç tür; doçentlik türü elle gönderilse de sunucu kayıt açmıyor |
| Dört hesap türü | Yönetim adresleri bulunamadı; kurum şeridi ve sayaç yok; menüde kurum/Yönetim yok; Ana Sayfa ve Çalışmalarım'da yalnızca kendi çalışması |
| Personel, açık lisans (controller, Kurum A) | Panel açık |
| Personel, kapalı lisans (employee, Kurum K) | Erişim kapalı; "Kartla öde" yok; ArvoOS lisans yolu gösteriliyor |
| Ekip Yönetimi (kurucu) | "Kurum ekle" ve kurum seçimi yok; rol seçimi duruyor; menüde "Ekip araçları" |
| Uzmana sor | Talep ArvoLab'da kaydediliyor; personelin kuyruğunda geçici notu ve kendi kurumunun talebi |
| Yeni çalışma, dört hesap türü | Sahibi kendisi, tez, editör açıldı, kişisel listede |

Yeniden koşmak (depo kökünde, yerel yığın, geçit ve `next start -p 3150` açıkken):

```
node tasarim/tek-deneyim/betikler/tohum.mjs
node tasarim/tek-deneyim/betikler/kabul3.mjs http://localhost:3150
```

`tohum.json` (rastgele şifre) depoya girmez.

**Sınırlama:** Yetkisiz ya da kaldırılmış panel adresleri "bulunamadı" ekranı gösteriyor ama HTTP durumu 200 (panelin `loading.tsx`
sınırının bilinen etkisi).
