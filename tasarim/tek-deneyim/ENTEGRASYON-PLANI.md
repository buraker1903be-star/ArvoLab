# ArvoLab ↔ ArvoOS entegrasyon planı (2. sürüm, 20.11.2026)

Bu belge bir **plan**dır, 20.11.2026'daki kararlarla revize edildi. ArvoOS deposunda bu plan için hiçbir şey yazılmadı; ArvoOS
değişiklikleri **ayrı PR'larda** hazırlanacak (sıra: bölüm 6). Production migration'ı ve veri dönüşümü hiçbir adımda onaysız yapılmaz.

## 1. Kararlar (kurum sahibi, 20.11.2026)

| # | Karar |
|---|---|
| K1 | Tek Çalışmalarım ekranı, tek editör. İş yetkisi olan personelde "Kişisel / İşlerim" yalnızca bir **filtre**; ayrı personel paneli yok. "Kaldığınız yer" erişilebilir son kişisel **veya** iş çalışmasını açar. |
| K2 | Bütün Uzmana sor taleplerinin hedefi **AkademikMerkez**. Talebi açan gerçek kullanıcı korunur; kurum sahibi talebin yazarı gibi kaydedilmez; sistem aktarımı ayrı aktör olarak kaydedilir. |
| K3 | Teknik yetki normal kurum üyeliğinden **ayrı**, açıkça verilir, kapsamı sınırlıdır. Teknik ekip bayrağı sınırsız `system_admin`'e dönüştürülmez. |
| K4 | İş erişimi görev kapsamından gelir. İşten ya da kurum üyeliğinden çıkarılan kişinin o işin belge, kaynak, dosya ve yazma erişimi kapanır. Kişisel çalışmaların sahipliği korunur. |
| K5 | Üyelik ve iş yetkisi eşitlemesi **atomik ve sürümlü**. Yarım kalan eşitleme, iletişim hatası ya da eski bir mesaj hak silmez, kaldırılmış hakkı yeniden açmaz. |
| K6 | E-posta yalnızca **ilk** hesap eşleştirmesinde kullanılır; kalıcı bağ değişmeyen kimliklerle (ArvoOS `auth.users.id` + kurum kimliği). |
| K7 | Talep ve mesaj aktarımında tekrar deneme, yinelenmeme ve sıra dışı güncelleme kuralları açıkça tanımlı (4.4). |
| K8 | Eski kurum bağları ve atamalar için **eşleştirme raporu**; doğrulanmamış kayıt otomatik dönüştürülmez. |
| K9 | Lisans: `past_due` **kapalı**; deneme erişimi `trial_ends_at` ile sınırlı. İki uygulama ve iki veritabanı aynı kuralı uygular. |

Ekip Yönetimi, davet, rol değiştirme ve erişim durdurma ArvoLab'dan kaldırıldı (PR #113). Asistan kayıtları operasyon
yönetiminden ayrı, teknik araç olarak kalır.

## 2. Bugünkü durum (kodda doğrulandı)

- **Kimlik:** ArvoOS üyeliği `organization_memberships(organization_id, user_id, role, is_active)` (ayrı satır kimliği yok; kalıcı
  anahtar `(organization_id, user_id)`), çalışan `hr_employees(id, user_id null, email, employment_status)`.
- **Üye listesi:** ArvoOS `pushArvolabMembers` etkin üyelerin e-postasını ArvoLab `arvoos_members`'a yazar; lisans açık değilse listeyi
  **siler**. ArvoLab bağı onaylı e-postayla kurar (`arvoos_uyeligini_bagla`), **hiç geri almaz**. Eşitleme sürümsüz.
- **Kurum geneli okuma:** `can_view_project`, `can_write_project`, `academic_projects` select politikası controller/academic_manager'a
  `gozetim_kapsami` ile kurumun bütün çalışmalarını açıyor; `assignee_id` de erişim veriyor. Arayüzde kullanılmıyor, API'de açık.
- **Kaynak ve dosya:** `literature_sources(owner_id, project_id null)` kişinin kütüphanesi; `kaynak_pdfleri(project_id)` ve
  `project-files` deposu çalışmaya bağlı (`can_view_project`).
- **Talep:** ArvoOS `crm_opportunities.created_by` NOT NULL (`auth.users`, RESTRICT); dış kaynak/dış kimlik sütunu ve üründen talep
  alan uç yok. ArvoLab'da `consultancy_requests` + `destek_mesajlari` içinde kalıyor.
- **Lisans:** ArvoOS `past_due`'yu açık, ArvoLab kapalı sayıyor; ArvoLab `trial_ends_at` almıyor.

## 3. Bileşenler

### A. Kimlik bağı (K6)
- ArvoLab `arvoos_kimlik_baglari(arvolab_user_id pk, arvoos_user_id unique, eslesme_yontemi, eslesme_at, eslestiren)`.
- İlk eşleştirme: ArvoOS anlık görüntüsündeki `(arvoos_user_id, email)` ile ArvoLab'da **onaylı** e-postası birebir aynı olan TEK hesap.
  Birden çok aday ya da onaysız e-posta → bağ kurulmaz, raporlanır.
- Sonrası yalnızca `arvoos_user_id`: e-posta değişse de haklar aynı kalır; e-postası başkasına geçen hesap hak kazanmaz.

### B. Üyelik eşitlemesi, sürümlü ve atomik (K5, K4)
**ArvoOS**
1. `urun_esitleme_surumleri(organization_id, konu, surum bigint)`: üyelik, çalışan durumu ve iş atamasındaki her değişiklik **aynı
   işlemde** tetikleyiciyle sürümü artırır (konu `uyelik`, `is:<workflow_id>`, `teknik`).
2. Anlık görüntü ve sürüm **tek REPEATABLE READ işleminde** okunur. Okuma hatası boş liste üretmez, fırlatır.
3. Lisans kapanınca liste **silinmez** (kapı yansıtılmış lisanstan kapanır). Üyelik kapanınca anında gönderim, cron yedek; sonuç
   `synced | not_configured | failed`, `lib/urun-yansitma.ts` tablosunda.

**ArvoLab** — RPC `arvoos_uyelik_esitle(p_org, p_surum, p_uyeler jsonb, p_adet, p_bos_onayli)`, security definer, yalnızca `service_role`, tek işlem:
- `p_surum <= saklı sürüm` → değişiklik yok, `eski_surum` (eski ya da tekrar mesaj; kaldırılmış hak geri gelmez).
- `jsonb_array_length(p_uyeler) <> p_adet` → `reddedildi` (kesik gövde). Boş liste yalnızca `p_bos_onayli = true`.
- Küme tam değişir; listeden düşen `arvoos_user_id` için kurum bağı (yalnızca `kurum_bagi_kaynagi = 'arvoos'`) kalkar ve o kurumdaki
  **iş yetkileri** kapanır; sürüm yazılır. Hata olursa tamamı geri alınır, gönderici aynı ya da daha yeni görüntüyü yeniden gönderir.
- Kişisel çalışmalar etkilenmez (`owner_id` aynı); kurum bağı kalkan kişi bireysel kullanıcı kurallarına döner.
- `profiles.kurum_bagi_kaynagi` (`arvoos` | `eski_elle`); mevcutlar `eski_elle`, otomatik dokunulmaz (G).

### C. Teknik yetki (K3)
- ArvoLab `teknik_yetkiler(id, arvolab_user_id, kapsam, veren, verildi_at, bitis_at null, geri_alindi_at null)`; kapsamlar sayılı
  ve dar (`asistan_kayitlari.oku`, `asistan_kayitlari.disa_aktar`); yeni kapsam kod değişikliğiyle eklenir.
- `teknik_yetki_var(kapsam)`; Asistan Kayıtları sayfası ve eylemleri buna bağlanır. `system_admin`/`founder` hiçbir bayraktan türetilmez.
- Kurum üyeliği teknik yetki vermez, üyeliğin bitmesi teknik yetkiyi düşürmez (ayrı kayıt, ayrı geri alma).
- ArvoOS: platform ekranında (yalnızca kurucu) kişi + kapsam + bitiş; RPC `arvoos_teknik_yetki_yaz`, B ile aynı sürüm kuralı.

### D. İş yetkisi ve iş çalışması (K1, K4)
**ArvoOS**
- Yetkili küme: `operation_workflow_assignees` + adımlardaki `assigned_employee_id` → `hr_employees.user_id`. `user_id`'siz çalışan
  yetki alamaz, raporlanır. İş/atama/çalışan değişince işin anlık görüntüsü gönderilir; arşiv/iptal → boş küme.
- İş kartında "ArvoLab'da aç" (`/dashboard/isler/<workflowId>`); bağlantı yetki vermez.

**ArvoLab**
- `arvoos_isleri(workflow_id pk, organization_id, baslik, durum, surum, guncellendi)`,
  `arvoos_is_yetkileri(workflow_id, arvoos_user_id, organization_id, pk(workflow_id, arvoos_user_id))`; yazma yalnızca
  `arvoos_is_esitle(p_workflow, p_org, p_surum, p_baslik, p_durum, p_yetkililer, p_adet, p_bos_onayli)`.
- `academic_projects.arvoos_is_id` (tekil, null = kişisel). İş çalışmasını yalnızca ilk yetkili açılışta sunucu oluşturur.
- Erişim tek fonksiyonda: `is_yetkisi_var(project_id)` = kimlik bağı + etkin satır + profilin kurumu = işin kurumu.
  Proje, yazım, sürüm, `kaynak_pdfleri`, `project-files` politikalarında iş çalışması için **yalnızca** bu; `owner_id` iş
  çalışmasında hak vermez.
- Kaynak: iş çalışmasına bağlı `literature_sources` satırı çalışmanın erişimini izler; kişisel kütüphane kişinin kalır.
- Arayüz: tek Çalışmalarım + tek editör; yetkisi olanda "Tümü / Kişisel / İşlerim" filtresi; "Kaldığınız yer" ikisinden erişilebilir en son.

### E. Kurum geneli okumanın kapanması
- `gozetim_kapsami(..., [controller, academic_manager])` ve `assignee_id` erişimi proje/yazım/dosya politikalarından çıkar; destek
  politikalarındaki gözetim F'de kuyruk kalkınca çıkar. PGlite'ta "eskiden görüyordu, artık görmüyor" + meşru akış.
- **Sıra şartı:** D canlıda ve yürüyen işler yansımış olmadan uygulanmaz.

### F. Uzmana sor → AkademikMerkez Talepler (K2, K7)
**ArvoOS**
1. `crm_opportunities`: `external_source`, `external_id` (kısmi tekil dizin), `talep_eden jsonb`, `aktaran text` (`'arvolab-kopru'`),
   `durum_surumu bigint`.
2. `created_by`: köprü satırında NULL olabilir; kısıt `created_by is not null or external_source is not null`. Talep kurum sahibine ya
   da personele yazılmaz; `created_by` okuyan ekranlar "ArvoLab üzerinden: <talep eden>" gösterir.
3. `crm_urun_yazismalari(id, organization_id, opportunity_id, yon, sira, dis_mesaj_id unique, metin, yazan jsonb, olusturuldu)`; RLS;
   yanıt yetkisi `crm.talep.urun_yanitla`.
4. Uçlar (`kopruYetkili(req, "arvolab")`): `POST /api/bridge/talep`, `POST /api/bridge/talep-mesaj`. Hedef kurum sabit
   (`ARVOLAB_UZMAN_KURUMU`, AkademikMerkez); gövdedeki kurum eşleşmezse `409`.
5. Yanıt/durum CRM ekranından; ArvoLab RPC `arvoos_talep_guncelle`, giden kutusu + yeniden deneme.

**ArvoLab**
1. `consultancy_requests`: `arvoos_talep_id`, `arvoos_gonderim` (`bekliyor | gonderildi | kalici_hata`), `arvoos_deneme`,
   `arvoos_sonraki_deneme_at`, `arvoos_son_hata`, `arvoos_durum_surumu`.
2. `destek_mesajlari`: `sira` (talep başına artan), `dis_mesaj_id unique null`, `arvoos_gonderim`.
3. Talep önce yazılır (`bekliyor`), sonra gönderilir; düşerse kaybolmaz, cron dener; ekran durumu söyler.
4. ArvoOS uçları canlıda doğrulanınca personel kuyruğu kalkar; açık talepler tek seferlik ve **onaylı** aktarımla gider.

### G. Eski kayıtlar: eşleştirme raporu (K8)
- Salt okunur `scripts/arvoos-eslestirme-raporu.mjs` (iki projeden okur, yazmaz):
  `eski_elle` bağlar → aynı kurumda etkin üyelik + onaylı e-posta birebir ise **doğrulanabilir**, değilse **doğrulanamadı**;
  `assignee_id` atamaları → yalnızca **öneri** (iki tarafta ortak kimlik yok); personel rolleri → iş/teknik yetki önerisi.
- Çıktı CSV + özet; dönüşüm yalnızca kayıt kayıt onayla.

### H. Lisans kuralı (K9)
- Açık = `active` **veya** (`trialing` **ve** `trial_ends_at > now()`), mevcut dönem sonu kuralıyla birlikte. `past_due`, süresi
  dolmuş deneme ve diğerleri kapalı.
- ArvoLab: `organizations.trial_ends_at`; `lib/license-decision.ts` ve `subscription_open` birlikte değişir.
- ArvoOS: `ACIK_LISANSLAR`'dan `past_due` çıkar; `uygulama/arvolab/route.ts`, `kopya-denetimi.ts`, `kurum-lisansi-erisim.ts` tek
  yardımcıyı kullanır; `trial_ends_at` köprüyle gider.
- Ortak örnek tablosu `tests/fixtures/lisans-kurali.json` iki depoda; TS ve SQL aynı tabloya karşı sınanır.
- Etki: bugün `past_due` olan kurumların personeli kapanır; yayından önce liste çıkarılır.

## 4. Veri sözleşmeleri

### 4.1 Üyelik (ArvoOS → ArvoLab `arvoos_uyelik_esitle`)
```json
{ "p_org": "uuid", "p_surum": 1842, "p_adet": 1, "p_bos_onayli": false,
  "p_uyeler": [ { "arvoos_user_id": "uuid", "email": "yalnizca-ilk-eslesme@ornek.org", "ad": "…" } ] }
```
Dönüş: `{"sonuc": "uygulandi" | "eski_surum" | "reddedildi", "surum": 1842, "kaldirilan": 0, "eklenen": 1}`.

### 4.2 İş (ArvoOS → ArvoLab `arvoos_is_esitle`)
```json
{ "p_workflow": "uuid", "p_org": "uuid", "p_surum": 77, "p_baslik": "…", "p_durum": "in_progress",
  "p_adet": 1, "p_bos_onayli": false, "p_yetkililer": [ { "arvoos_user_id": "uuid" } ] }
```

### 4.3 Teknik yetki (ArvoOS → ArvoLab `arvoos_teknik_yetki_yaz`)
```json
{ "p_surum": 12, "p_adet": 1, "p_yetkiler": [ { "arvoos_user_id": "uuid", "kapsam": "asistan_kayitlari.oku", "bitis_at": null } ] }
```

### 4.4 Talep ve mesaj
**ArvoLab → ArvoOS** `POST /api/bridge/talep`
```json
{ "product": "arvolab", "externalId": "<consultancy_requests.id>", "hedefKurum": "<AkademikMerkez id>",
  "talepEden": { "arvolabUserId": "uuid", "arvoosUserId": "uuid|null", "ad": "…", "email": "…" },
  "talepEdenKurum": "uuid|null", "tur": "analysis|statistics|methodology|editing|full_review|ethics|other",
  "mesaj": "…", "calismaBasligi": "…", "olusturuldu": "ISO", "dil": "tr" }
```
Cevap: `200 {"yazildi": true, "opportunityId"}` · `200 {"yazildi": false, "sebep": "zaten_var", "opportunityId"}` · `400` · `401` ·
`409 hedef_kurum_uyusmuyor` · `503` · `500`.

`POST /api/bridge/talep-mesaj`: `{ "externalId", "mesajId", "sira", "metin", "yazan", "olusturuldu" }` →
`200 yazildi | zaten_var` · `409 talep_yok`.

**ArvoOS → ArvoLab** `arvoos_talep_guncelle`
```json
{ "p_external_id": "uuid", "p_durum_surumu": 5, "p_durum": "open|accepted|completed|cancelled",
  "p_mesajlar": [ { "dis_mesaj_id": "uuid", "sira": 4, "metin": "…", "yazan_adi": "…", "olusturuldu": "ISO" } ] }
```

**Kurallar**
- *Yinelenmeme:* talep `(external_source, external_id)`, mesaj `mesajId`/`dis_mesaj_id` tekil; tekrar "zaten var" döner, yazılmaz;
  gönderici bunu başarı sayar.
- *Tekrar deneme:* 1, 5, 15, 60 dk, sonra saatlik; 24 saatte `kalici_hata` + kullanıcıya "iletilemedi" + destek bildirimi.
  `400/401` hemen `kalici_hata`.
- *Sıra:* mesajlar talep başına `sira`'ya göre gönderilir ve gösterilir; önceki iletilmeden sonraki gönderilmez; talepten önce gelen
  mesaj `409 talep_yok` alıp bekler.
- *Sıra dışı durum:* `p_durum_surumu <= saklı` → durum değişmez (mesajlar yinelenmeden eklenir); `completed`/`cancelled` yalnızca
  daha yüksek sürümlü açık "yeniden aç" ile döner.
- *Aktör:* ArvoOS'ta yazar `talep_eden`, aktaran `'arvolab-kopru'`; ArvoLab'da uzman yanıtı `taraf = 'uzman'`, `yazan_adi` ArvoOS'taki ad.

## 5. PR #113'ün durumu

**Tamamlandı (ArvoLab, migration yok):** doçentlik, Yönetim, kurum seçici, kurum atama ve Ekip Yönetimi (davet, rol, erişim durdurma)
kaldırıldı, eski adresler Ana Sayfa'ya iner; kurucu, personel ve bireysel kullanıcı aynı Ana Sayfa / Çalışmalarım / Yeni çalışma /
editörü kullanır; personel kurum lisansından ve ArvoOS üye listesinden sunucuda doğrulanan hakla girer.

**Entegrasyon olarak henüz yok:** A–H'nin hiçbiri. Uzmana sor ArvoLab içinde kalıyor (ekran bunu söylüyor), iş yetkisi yok, üyelik
geri alma yok, lisans uyuşmazlığı duruyor, kurum geneli okuma API'de açık.

## 6. Uygulama sırası ve PR'lar

| Sıra | PR | Depo | İçerik | Önce gereken |
|---|---|---|---|---|
| 0 | L0 | ArvoLab | G: salt okunur eşleştirme raporu | — |
| 1 | L1 | ArvoLab | A + B: kimlik bağı, `arvoos_uyelik_esitle`, bağ kaynağı; PGlite (eski sürüm, kesik gövde, boş liste, kaldırılan hakkın dönmemesi) | #113 |
| 2 | O1 | ArvoOS | B: sürüm tablosu + tetikleyiciler, tutarlı anlık görüntü, lisans kapanınca silmeme, anında gönderim | L1 canlıda |
| 3 | L2 + O2 | ikisi | C: teknik yetki tablosu/RPC + Asistan Kayıtları; ArvoOS platform ekranı | L1 |
| 4 | L3 | ArvoLab | D: iş tabloları, `arvoos_is_esitle`, `is_yetkisi_var`, politikalar, `/dashboard/isler/[id]`, filtre | L1 |
| 5 | O3 | ArvoOS | D: iş anlık görüntüsü gönderimi, "ArvoLab'da aç" | L3 canlıda, O1 |
| 6 | L4 | ArvoLab | E: kurum geneli okumanın kapanması | L3 + O3 canlıda |
| 7 | O4 | ArvoOS | F: dış kaynak sütunları, `created_by` kısıtı, ürün yazışması, uçlar, yanıt/durum gönderimi | — (L3 ile paralel) |
| 8 | L5 | ArvoLab | F: giden kutusu, gönderim, `arvoos_talep_guncelle`, mesaj sırası | O4 canlıda |
| 9 | L6 | ArvoLab | F-4: personel kuyruğunun kaldırılması + onaylı tek seferlik aktarım | L5 doğrulandı |
| 10 | L7 + O5 | ikisi | H: önce ArvoLab `trial_ends_at`, sonra ArvoOS gönderimi, sonra iki kural aynı pencerede | `past_due` listesi onaylandı |

Her PR'da: `npm run db:new`, yeni fonksiyonlarda `revoke … from public, anon, authenticated` + gereken `grant`, PGlite'ta meşru akış
ve saldırı senaryoları, yerel tarayıcı kabulü; ArvoOS'ta `check:schema` + katalog yenileme. Canlıya çıkışta okuyacak tablo yazandan önce.
