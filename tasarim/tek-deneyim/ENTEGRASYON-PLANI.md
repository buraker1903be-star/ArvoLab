# ArvoLab ↔ ArvoOS entegrasyon planı (taslak, onay bekliyor)

20.11.2026. Bu belge bir **plan**dır. ArvoOS deposunda hiçbir şey yazılmadı, ArvoLab'da yeni bir geçici akış geliştirilmedi.
Merge ve dağıtım yok. Erişim kuralları (past_due, deneme süresi) **kendiliğinden değiştirilmedi**; ayrı bölümde karar bekliyor.

## 1. Hedef

| Konu | Sahibi | ArvoLab'da ne kalır |
|---|---|---|
| Üyelik, davet, rol, ekip yönetimi | ArvoOS | Hiçbir ekran ve işlem yok; yalnızca ArvoOS'un yansıttığı bilgi okunur |
| Lisans ve kurum hakkı | ArvoOS | Yansıtılmış lisans + üyelikten sunucuda doğrulanan hak |
| Talep (Uzmana sor) | ArvoOS Talepler | Talep formu, kullanıcının yazışması ve durum (ArvoOS'tan döner) |
| İş ve görevlendirme | ArvoOS İşler | Personelin **kendisine yetkilendirilmiş** işin çalışması |
| Akademik çalışma | ArvoLab | Editör, kaynaklar, denetimler |
| Teknik asistan kayıtları | ArvoLab (teknik iç ekip) | Operasyon yönetimi değil, ürün ve model kalitesi aracı olarak kalır |

İlke: bir personel ArvoLab'da yalnızca **kendi kişisel çalışmalarını** ve **ArvoOS'ta kendisine verilmiş işlerin çalışmalarını** görür. Kurumun
bütün çalışmalarına rol üzerinden erişim olmaz. Üyeliği biten ya da pasifleşen personelin kurum hakkı ve iş yetkileri düşer.

## 2. Bugünkü durum (kodda doğrulandı)

- **Üyelik:** ArvoOS `pushArvolabMembers` etkin `organization_memberships` e-postalarını ArvoLab'daki `arvoos_members`'a yazar. ArvoLab bağı
  onaylı e-postayla kurar (`arvoos_uyeligini_bagla`) ama **hiç geri almaz**: üyelikten çıkan kişinin `profiles.organization_id` değeri kalır.
- **Lisans kapanınca** ArvoOS üye listesini **tamamen siler** (`lib/arvolab.ts`, lisans açık değilse delete). Geri alma bu silmeye
  bağlanırsa lisans kesintisi bütün personeli kurumdan koparır ve onları bireysel deneme/ödeme yoluna düşürür.
- **Rol:** ArvoLab'da roller (controller, academic_manager, expert, employee) Ekip Yönetimi'nden elle veriliyor. ArvoOS rolü yansıtmıyor.
- **Kurum geneli okuma:** `can_view_project`, `can_write_project` ve `academic_projects` select politikası
  `gozetim_kapsami(kurum, [controller, academic_manager])` ile kurumun bütün çalışmalarını açıyor; `assignee_id` de erişim veriyor.
  Arayüz bunu artık kullanmıyor ama **API üzerinden okuma hâlâ açık**.
- **Uzmana sor:** `consultancy_requests` ArvoLab içinde kalıyor; ArvoOS'a çağrı yok, ArvoOS'ta talebi üründen alan uç yok.
- **İşler:** ArvoOS'ta `operation_workflows` + `operation_workflow_assignees(workflow_id, employee_id)` +
  `operation_steps.assigned_employee_id`; çalışan `hr_employees(user_id, email, employment_status)`. ArvoLab'da işle bağ yok.

## 3. Bileşenler

### A. Üyelik yaşam döngüsü ve hakkın geri alınması

**ArvoOS**
1. Üye listesinin anlamı değişir: "lisansı açık kurumun üyeleri" değil, **"kurumun etkin üyeleri"**. Lisans kapanınca liste
   **silinmez**; kapı zaten yansıtılmış lisanstan kapanıyor. (`pushArvolabMembers`'taki "lisans açık değilse sil" dalı kalkar.)
2. Üyelik kaldırılınca ya da pasifleşince (`organization_memberships.is_active=false`, `hr_employees.employment_status` ayrıldı)
   anında `syncArvolabMembers` çağrılır. Bugün İK/ekip işlemlerinden çağrılıyor; pasifleştirme ve silme yollarının hepsi kapsanmalı.
   Cron eşitlemesi yedek olarak kalır.
3. Listeye satır başına `uyelik_durumu` (`aktif`) ve `guncellendi` gönderilir; ArvoLab tarafında "bu e-posta artık listede yok" kararı
   tam liste yazımından sonra verilir (bugünkü "eski damgalı satırları sil" yöntemi korunur).

**ArvoLab** (migration + PGlite testi)
1. `profiles`'a `kurum_bagi_kaynagi` (`arvoos` | `eski_elle`) ve `kurum_bagi_at`. Var olan bağlar `eski_elle` işaretlenir;
   `arvoos_uyeligini_bagla` yeni bağları `arvoos` yazar.
2. `arvoos_members` silme tetikleyicisi (security definer, yalnızca servis rolünden gelen silmede çalışır):
   aynı kurum ve e-postayla `kurum_bagi_kaynagi='arvoos'` olan profilin `organization_id`'si NULL'a çekilir, iş yetkileri (C) kapanır.
   Rol tetikleyicisinin istisnası bugünkü bağlama istisnasıyla aynı dar bayrakla.
3. `eski_elle` bağlar için tek seferlik karar: listede olmayanlar raporlanır, otomatik kopartılmaz (Faz 1 sonunda ayrı onay).
4. Erişim isteğe göre hesaplandığı için (lib/access.ts) kesilme bir sonraki istekte geçerli olur; açık oturum ayrıca kapatılmaz.
5. Testler: üyelik silinince bağ kopar; lisans kapanınca bağ **kopmaz**, kapı kapanır; elle bağlar dokunulmaz; başka kurumun satırı etkilenmez.

### B. Ekip Yönetimi, davet ve rol ArvoLab'dan çıkar

**ArvoLab**
1. `/dashboard/team` sayfası, `app/actions/team.ts` (getAllProfiles, updateUserRole, inviteUser, setUserAccess), hesap menüsündeki
   "Ekip Yönetimi" ve Ctrl+K girişi kaldırılır; eski adres Ana Sayfa'ya yönlenir. Kullanılmayan `"use server"` uçları silinir.
2. Rollerin anlamı daralır: herkes `client`; `system_admin`/`founder` yalnızca **teknik iç ekip** (asistan kayıtları, iç araçlar).
   Personel rolleri (controller, academic_manager, expert, employee) erişim kararında kullanılmaz (bkz. D).
3. Asistan Kayıtları kalır; görüntüleyen rol listesi (`KAYIT_ROLLERI`) teknik iç ekiple sınırlanır.
4. Teknik iç ekip nasıl belirlenecek: **karar gerekli** (bkz. 6). Öneri: ArvoOS'taki Arvo platform kurumunun üyeleri için
   `arvoos_members.urun_rolu='teknik'` yansıtılır, ArvoLab bunu `system_admin`'e eşler; ArvoLab'da rol değiştiren ekran olmaz.

**ArvoOS**
1. Davet ve rol: ArvoLab hesabı açmak için ArvoOS'taki mevcut "ArvoLab'a git" (sihirli bağlantı + onaylı hesap) kullanılır;
   ayrı davet ekranı gerekmez. Teknik ekip bayrağı (öneri) üye listesine eklenir.

### C. İş yetkisi: personel kendisine verilen işi ArvoLab'da açar

**ArvoOS**
1. Bir iş (`operation_workflows`) için yetkili kişi kümesi: `operation_workflow_assignees` + işin adımlarındaki
   `assigned_employee_id`'ler (hangisinin sayılacağı **karar**: yalnızca iş sorumluları mı, adım sorumluları da mı).
   Çalışan → e-posta: `hr_employees.email` ya da `user_id` → auth e-postası (üye listesiyle aynı kaynak).
2. Yetki değiştiğinde (atama, çıkarma, iş arşivlendi/iptal, çalışan pasif) ArvoLab'a yansıtma: `pushArvolabIsYetkileri(workflowId)`,
   üç hâlli sonuç (`synced | not_configured | failed`) ve `lib/urun-yansitma.ts` tablosuna satır. Cron yedeği.
3. İş kartına "ArvoLab'da aç" bağlantısı: `https://<arvolab>/dashboard/isler/<workflowId>`. Bağlantı yetki vermez; yetki ArvoLab'da
   yansıtılmış satırdan doğrulanır.

**ArvoLab** (migration + RLS + PGlite testleri)
1. Tablolar (RLS açık, yazma yalnızca servis rolü; okuma kişinin kendi satırı):
   - `arvoos_isleri(workflow_id pk, organization_id, baslik, musteri_gorunen_ad, durum, project_id null, guncellendi)`
   - `arvoos_is_yetkileri(workflow_id, email, organization_id, aktif, guncellendi, pk(workflow_id, email))`
2. İşi açma: `/dashboard/isler/[workflowId]` sunucuda yetkiyi doğrular (aktif yetki + profilin kurumu = işin kurumu + kurum lisansı açık).
   İşin çalışması yoksa oluşturulur: `academic_projects` + yeni sütun `arvoos_is_id` (tekil), `organization_id` = işin kurumu.
3. Erişim kuralı tek yerde: `public.is_yetkisi_var(project_id)` (aktif yetki, e-posta = çağıranın onaylı e-postası, kurum eşleşmesi).
   `can_view_project`, `can_write_project` ve `academic_projects` select politikası: **iş çalışmasında** yalnızca `is_yetkisi_var`;
   sahiplik iş çalışmasında hak vermez (yetkisi kalkan açan personel erişimini kaybeder). Kişisel çalışmada bugünkü sahiplik kuralı.
   Depo (`project-files`) ve alt tablolar `can_view_project` üzerinden zaten bağlı; `calisma_klasoru` gözden geçirilir.
4. Arayüz: Çalışmalarım'da iki ayrı bölüm: **Kişisel** ve **İşlerim (AkademikMerkez)**. Ana Sayfa'nın "Kaldığınız yer"i yalnızca kişisel
   çalışmalardan (ya da karar: ikisinden; bkz. 6). Yeni çalışma her zaman kişisel; iş çalışması yalnızca ArvoOS'tan açılır.
5. Testler: yetkili açar ve yazar; yetkisi kalkınca okuyamaz/yazamaz (API dahil); başka işin çalışması görünmez; başka kurumun işi
   görünmez; e-postası onaysız hesap yetkiden yararlanamaz; kişisel çalışmalar etkilenmez.

### D. Kurum geneli okumanın kapanması

**ArvoLab** (migration; sıkılaştırma, gevşetme değil)
1. `can_view_project`, `can_write_project` ve `academic_projects` select politikasından `gozetim_kapsami(..., [controller, academic_manager])`
   çıkar; `assignee_id` erişimi de (C'deki iş yetkisine taşınır). İç ekip için kurumlar arası görüş: **karar** (bkz. 6).
2. Aynı ilke kurumla sınırlı öteki okuma politikalarına uygulanır (uzman talepleri, destek yazışması, dosyalar): liste migration
   sırasında `gozetim_kapsami` çağrılarından çıkarılır, her biri için PGlite'ta "eskiden görüyordu, artık görmüyor" senaryosu yazılır.
3. **Sıra şartı:** C canlıda ve personelin yürüttüğü işler yansıtılmış olmadan D uygulanırsa personel çalıştığı tezlere erişimi kaybeder.

### E. Uzmana sor → ArvoOS Talepler, yanıt ve durum ArvoLab'a döner

**ArvoOS**
1. Migration: `crm_opportunities`'a `external_source text`, `external_id text`, kısmi tekil dizin `(organization_id, external_source, external_id)`.
2. Migration: ürün yazışması için `crm_urun_yazismalari(id, organization_id, opportunity_id, yon gelen|giden, metin, yazan_kullanici, yazan_adi,
   olusturuldu, urun_ref)` (RLS, yetki `lib/yetkiler.ts` anahtarlarıyla: ör. `crm.talep.urun_yanitla`).
3. Uç: `POST /api/bridge/talep` (`kopruYetkili(req, "arvolab")`, admin istemci). Gövde ve cevap 4. bölümde. Talep `stage:'lead'`,
   `source:'ArvoLab'`, aktör kurumun etkin sahibi (`created_by` NOT NULL), panel bildirimi (`dedupeKey = externalId`).
4. Uç: `POST /api/bridge/talep-mesaj` (kullanıcının sonraki mesajları ArvoOS'a).
5. CRM talep ekranında "ArvoLab'a yanıtla" ve durum değişikliği; ikisi ArvoLab'a yazılır: servis anahtarıyla ArvoLab RPC'si
   `arvoos_talep_guncelle(external_id, durum, yanit?)`, üç hâlli sonuç ve yeniden deneme (cron).
6. Hedef kurum: bütün "Uzmana sor" talepleri AkademikMerkez'e mi gider (bireysel kullanıcılarınki dahil)? **Karar** (bkz. 6).
   Öneri: ArvoLab ortam değişkeni `ARVOOS_UZMAN_KURUMU` (kimlik), kurum bağı olan kullanıcıda da aynı hedef.

**ArvoLab**
1. Migration: `consultancy_requests`'e `arvoos_talep_id`, `arvoos_durumu` (`gonderildi | gonderilemedi | kopru_kapali`),
   `arvoos_gonderildi_at`, `arvoos_son_hata`; dışarıdan gelen durum için `durum_kaynagi`.
2. `createConsultancyRequest` kaydı yazar, sonra köprüyü çağırır (`lib/subscription.ts`'teki uç/sağlık kaydı yeniden kullanılır).
   Köprü düşerse talep kaybolmaz; satır `gonderilemedi` kalır, cron yeniden dener. Kullanıcı ekranı durumu dürüstçe söyler.
3. RPC `arvoos_talep_guncelle` (security definer, yalnızca `service_role`): durum ve uzman yanıtını `destek_mesajlari`'na
   `taraf='uzman'`, `yazan_adi`=ArvoOS'taki ad olarak yazar; koruma tetikleyicileri bu yolu tanır.
4. Kullanıcının sonraki mesajı `talep-mesaj` ucuyla ArvoOS'a gider.
5. **Geçiş:** ArvoOS uçları canlıda doğrulanınca ArvoLab'daki personel kuyruğu (`destek-kuyruklari.tsx` uzman kuyrukları, Üstlen/Tamamla
   işlemleri) kaldırılır; açık talepler tek seferlik betikle ArvoOS'a aktarılır (`externalId` yinelemeyi önler).
6. Bildirim: yanıt gelince kullanıcıya ArvoLab bildirimi (bugün yok; kılavuz bu yüzden düzeltildi).

### F. Lisans durumu uyuşmazlıkları (karar bekliyor, değiştirilmedi)

| Konu | ArvoOS | ArvoLab | Etki |
|---|---|---|---|
| `past_due` | Açık sayar (`lib/arvolab.ts` ACIK_LISANSLAR, `uygulama/arvolab/route.ts`, `kopya-denetimi.ts`, `kurum-lisansi-erisim.ts`) | Kapalı sayar (`lib/license-decision.ts`, `subscription_open`) | ArvoOS kişiyi ArvoLab'a yönlendirir, ArvoLab ödeme/kapalı ekranı gösterir. Ayrıca ArvoOS üye listesini korur, ArvoLab kapatır |
| Deneme süresi | `trialing` + `trial_ends_at` geçince kapalı | `trial_ends_at` yansıtılmıyor; `trialing` + boş dönem sonu süresiz açık | Denemesi biten kurum ArvoLab'da açık kalır |

Seçenekler: (1) `past_due` iki tarafta açık (ödeme toleransı) ya da iki tarafta kapalı; (2) `trial_ends_at` yansıtılır ve iki taraf aynı
kuralı kullanır. Karar sonrası iki taraf aynı sabiti/testi alır; ArvoLab'da uygulama + veritabanı kapısı birlikte değişir.

## 4. Sözleşmeler (öneri)

**Üye listesi (ArvoOS → ArvoLab, servis anahtarı, mevcut tablo genişler):**
`arvoos_members(email pk, organization_id, full_name, synced_at, + uyelik_durumu text, + urun_rolu text null)`

**İş yetkisi (ArvoOS → ArvoLab, servis anahtarı):**
```json
{ "workflow_id": "uuid", "organization_id": "uuid", "baslik": "…", "musteri_gorunen_ad": "…", "durum": "in_progress",
  "yetkililer": [{ "email": "…", "aktif": true }] }
```
Yazım: upsert iş + yetkili kümesini tam liste olarak değiştir (listede olmayan `aktif=false`).

**Talep (ArvoLab → ArvoOS):** `POST /api/bridge/talep`, `x-arvo-bridge-secret`
```json
{ "product": "arvolab", "externalId": "<consultancy_requests.id>", "targetOrganizationId": "uuid",
  "requester": { "arvolabUserId": "uuid", "fullName": "…", "email": "…" }, "requesterOrganizationId": "uuid|null",
  "requestType": "analysis|statistics|methodology|editing|full_review|ethics|other", "message": "…",
  "projectTitle": "…", "locale": "tr" }
```
Cevap: `200 {"yazildi": true, "opportunityId": "…"}` · `200 {"yazildi": false, "sebep": "zaten var", "opportunityId": "…"}` ·
`400 invalid_request` · `401 unauthorized` · `404 organization_not_found` · `503 unavailable` · `500 create_failed`.

**Yanıt/durum (ArvoOS → ArvoLab):** RPC `arvoos_talep_guncelle(p_external_id uuid, p_durum text, p_yanit text, p_yazan_adi text, p_mesaj_id text)`;
`p_mesaj_id` yineleme anahtarı.

## 5. Bağımlılık sırası

| Faz | İş | Taraf | Önce gereken |
|---|---|---|---|
| 0 | 6. bölümdeki kararlar | Kurum sahibi | — |
| 1 | A: üyelik geri alma (liste anlamı, anında eşitleme; ArvoLab bağ kaynağı + silme tetikleyicisi) | ArvoOS → ArvoLab | 0 (eski elle bağlar kararı) |
| 2 | B: Ekip Yönetimi/davet/rol kaldırma; teknik ekip bayrağı | ArvoLab (+ ArvoOS bayrak) | 1 |
| 3 | C: iş yetkisi yansıtması (ArvoOS), iş tabloları + `is_yetkisi_var` + "İşlerim" (ArvoLab) | İki taraf; önce ArvoLab tabloları, sonra ArvoOS yazımı | 1 |
| 4 | D: kurum geneli okumanın kapanması | ArvoLab | 3 canlıda ve yürüyen işler yansıtılmış |
| 5 | E: Uzmana sor → Talepler; yanıt/durum dönüşü; ArvoLab personel kuyruğunun kaldırılması | Önce ArvoOS migration + uçlar, sonra ArvoLab gönderimi, sonra dönüş, en son kuyruk kaldırma | 0 (hedef kurum); 3 ile paralel yürüyebilir |
| 6 | F: durum kuralı hizalaması | İki taraf aynı anda | 0 |

Her fazda: migration `npm run db:new` ile, yeni fonksiyonlarda `revoke … from public, anon, authenticated` + gereken `grant`,
PGlite'ta meşru akış ve saldırı senaryoları, yerel yığında tarayıcı kabulü, ArvoOS'ta `check:schema` ve katalog yenileme.
ArvoOS ve ArvoLab migration'ları canlıya **ArvoLab tablosu önce** sırasıyla çıkar (yazan taraf okuyacak tablo hazır olmadan yazmaz).

## 6. Karar gerekenler

1. Teknik iç ekip ArvoLab'da nasıl tanınacak (öneri: ArvoOS üye listesinde `urun_rolu='teknik'`)?
2. İç ekip (founder/system_admin) kurumların çalışmalarını görmeye devam edecek mi, yoksa onlar da yalnızca iş yetkisiyle mi?
3. İş yetkisi: yalnızca iş sorumluları mı, adım sorumluları da mı?
4. Ana Sayfa'nın "Kaldığınız yer"i iş çalışmalarını da kapsasın mı?
5. Uzmana sor hedefi: bireysel kullanıcılar dahil hepsi AkademikMerkez'e mi?
6. Eski elle verilmiş kurum bağları (ArvoOS listesinde olmayanlar): rapor sonrası kopartılsın mı?
7. Eski `assignee_id` atamaları: iş yetkisine taşınsın mı, düşsün mü?
8. `past_due` ve deneme süresi kuralı (F).

## 7. Bu PR'daki durum

- Kaldırılanlar (doçentlik, Yönetim, kurum seçici, kurum atama) bu plana uygun.
- **Henüz duran ve plana göre kalkacaklar:** Ekip Yönetimi sayfası, davet, rol değiştirme ve erişim durdurma (B); destek sayfasındaki
  personel uzman kuyruğu (E-5). Bunlar "yeni geçici akış geliştirme" kapsamına girmesin diye bu turda dokunulmadı.
- Uzman kuyruğundaki not ve kılavuz metni "ArvoLab'da yanıtla" kararı varmış gibi yazılmıştı; düzeltildi: hedef ArvoOS, bağlantı henüz yok.
