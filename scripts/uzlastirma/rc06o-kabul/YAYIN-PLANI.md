# Yayın planı — aday `a08b61d5c7404f305b2e4c4a8e8dedd8e2b056f7` (RC06o)

18.11.2026 (RC06p güncellemesi: eski kod uyumu ölçüldü, tek yayın onayı §7, dal temizliği §8) · **Karar: HOLD** (gerekçeler §6). Bu belge `RAPOR-RC06c.md` §6'daki yayın planının
yerini alır; çelişkide bu geçerli. Hazırlık sırasında Production'a ve paylaşılan Test'e hiçbir
şey yazılmadı. Migration repair, paket uygulaması, Auth değişikliği, main birleştirmesi,
Production dağıtımı ve restore YAPILMADI. Production'da bu turda sorgu da çalıştırılmadı.

## 1. Adayın durumu (planın girdisi)

| Madde | Değer | Kaynak |
|---|---|---|
| Aday | `design/os5` @ `a08b61d` (PR #107 birleşmesi; ebeveynler `aaa0561` + `bcfd0fb`) | `git ls-remote`, 18.11 |
| `main` | `b62bfcf` — değişmedi; Vercel Production bu daldan | `git ls-remote`, RC06c §8.2a |
| Push CI | "Kontrol" #1061, dokuz adım başarılı | `RAPOR.md` §1 |
| Vercel | `dpl_FeuEpYmp2C2dKgCJEMAPbwQzcCNK`, READY, **Preview** | `RAPOR.md` §1 |
| Yer tutucular (eski plan 0d) | **tamam** — adayda 121 migration dosyası (109 + 12 boş yer tutucu); `check:migrations` CI'da geçti | `supabase/migrations/` |
| Yerel entegrasyon kabulü | 125 PASS · 0 FAIL · 2 UNVERIFIED (dokunma, Preview çalışma anı) | `RAPOR.md` |
| Gerçek AI kabulü | RC06k (`6880ddc`) ve RC06l (`a0b6834`) adaylarında yapıldı, sayaç 21/30. `a0b6834..a08b61d` farkında `lib/ai/`, `app/actions/` ve `supabase/` altında **hiçbir dosya değişmedi** (48 dosya; arayüz, `lib/academic-reference-verification.ts`, `lib/calisma-ozeti.ts`, `lib/os/uygulamalar.ts`, kılavuz metni). Yeni gerçek çağrı yapılmadı | `git diff --name-only a0b6834 a08b61d` |
| Şema hedefi | P1–P6 + P8 uygulanmış yerel şema, `sema-ozeti` md5(ham) `358efe9c…` (RC06i/k/l/o ile aynı) | `kanit/sema-ozeti.txt` |

Adayın değişmesi (yeni birleştirme) bu planı ve §1'deki kabulü geçersiz kılar; yerel kabul yeni SHA'da yeniden koşulur.

## 2. Yedek ve geri yükleme hazırlığı

| Madde | Durum | Not |
|---|---|---|
| Son bilinen fiziksel yedek | **17.11.2026 05:00:49 UTC** (panel, kullanıcının okuması; RC06c §8) | 18.11 yedeğinin varlığı **UNVERIFIED**: MCP'de yedek listesi yok, Management API anahtarı istenmedi. Panelde yeniden okunmalı |
| PITR | **kapalı** | Veri değiştiren adımın tek dönüşü bütün veritabanını yedek anına geri yüklemek (aradaki her yazma kaybolur) |
| Yedeğin kapsamı | yalnızca veritabanı; **Storage dosyaları yok** | PDF, ek, görsel dosyaları geri gelmez |
| İzole geri yükleme provası | **YAPILMADI** → **AÇIK ENGEL** | Yedeğin gerçekten açılabildiği, süresi ve şemanın yerinde geldiği hiç gösterilmedi |
| Production'da restore | başlatılmadı ve başlatılmayacak | — |

**Engeli kapatacak prova (kullanıcı onayıyla; Production'a dokunmaz):**
1. Supabase panelinde son yedeğin tarih/saatini oku ve kaydet.
2. Yedeği **yeni, ayrı bir projeye** geri yükle (panel: Backups → "Restore to a new project", ya da
   yedeğin indirilip yerel/izole bir Postgres'e yüklenmesi). Kaynak Production değişmez.
3. Geri yüklenen kopyada `scripts/uzlastirma/sema-ozeti.sql`'i çalıştır; Production'ın 17.11 kataloğu
   ve RC06 provasındaki Production taklidinin özetiyle karşılaştır (beklenen: aynı; fark varsa listele).
4. Toplu sayımlar (içerik okumadan): `auth.users`, `profiles`, `academic_projects`,
   `project_manuscripts`, `supabase_migrations.schema_migrations` (beklenen 12).
5. Geri yükleme süresini kaydet (Production'da olası kesinti süresinin tahmini).
6. Kopyayı sil. Kişisel veri taşıdığı için kopyadan hiçbir satır depoya ya da rapora geçmez.

Ücret ve kişisel veri içeren bir kopya oluşturduğu için bu adım **ayrı onay** ister; bu turda yapılmadı.

## 3. Uygulanabilir kontrol listesi

Kurallar: Production'a yazan bütün satırlar (A.1, K.1, B.1–B.8, M.1) **tek yayın onayıyla** (§7) yürür;
satır başına ayrıca onay istenmez. Onay verilmeden hiçbir satır uygulanmaz. Bir satırın beklenen
sonucu tutmazsa **dur**, sonraki satıra geçme; durulan noktadan devam yeni bir onay ister. "Özet" = Production'da `sema-ozeti.sql` (salt okunur) ↔ provanın aynı adımındaki özet
(`sonuclar/prova-gecmis-rc06d.txt`, `ozet-*.txt`). Production proje kimliği Latin harfli
`zpfpocyajnxcketdjbxm`; Kiril `х`'li kopya hiçbir komuta yapıştırılmaz (RC06c §8).

### Dalga 0 — Production'a SQL yok

| # | Adım | Ön koşul | Beklenen sonuç | Durma koşulu | Geri alma |
|---|---|---|---|---|---|
| 0.1 | Supabase entegrasyonunu yeniden oku: Deploy to production, Automatic branching, Production branch | — | ikisi kapalı, dal alanı pasif (17.11 ile aynı) | biri açıksa: Production'a SQL yok, `main`'e birleştirme yok; önce kapatma kararı | yok (okuma) |
| 0.2 | Vercel: Production branch = `main`, Preview = diğer dallar | — | 17.11 ile aynı | farklıysa dur | yok |
| 0.3 | Son fiziksel yedeğin saatini oku | — | uygulama günü yedeği var, saat kayıtlı | yedek yok ya da 24 saatten eski | yok |
| 0.4 | **İzole geri yükleme provası** (§2) | 0.3 | kopya açılır, özet ve sayımlar tutar, süre kayıtlı | kopya açılmaz ya da özet tutmaz | kopyayı sil |
| 0.5 | Production geçmiş tablosu ve katalog farkı (salt okunur) | 0.1 | geçmişte yalnızca eski 12 kayıt; özet 17.11 Production özetiyle aynı | yeni kayıt ya da şema sapması | yok |
| 0.6 | P5 ön koşul sorgusu (`P5_g1_kimlik.sql` başlığı) ve P3/P7 ön koşulları | 0.5 | P5 veri adımı 0 satır (17.11: 0) | 0 değilse: kimlik listesini depo DIŞINDA kaydet, P5'i bu pencerede yeniden değerlendir | yok |
| 0.7 | Bakım penceresi: 0.3'teki yedeğe yakın; B.6 (P5) → B.7 → B.8 → M.1 → M.2 arka arkaya, arada bekleme yok (ölçülen ara dönem etkisi §5 R1) | 0.1–0.6 | pencere ve geri dönüş sorumlusu belli; P5 uygulama anı kaydedilecek | — | — |

### Dalga A — yalnızca geçmiş, şema değişmez (97 sürüm)

| # | Adım | Ön koşul | Beklenen sonuç | Durma koşulu | Geri alma |
|---|---|---|---|---|---|
| A.1 | `migration repair --status applied` × `gecmis/dalga-A.txt` (97) | Dalga 0 tamam | geçmiş 12 → 109 kayıt; **özet değişmez (0 satır fark)**; `db push --dry-run` bekleyen 12 (3 KISMİ + 9 paket) | özet değişirse ya da bekleyen ≠ 12 | `migration repair --status reverted` aynı 97 sürüm (yalnızca geçmiş satırı; şemaya dokunmaz). Eski 12 kayda asla dokunulmaz |

### Onay K — üç KISMİ sürüm (ayrı onay)

| # | Adım | Ön koşul | Beklenen sonuç | Durma koşulu | Geri alma |
|---|---|---|---|---|---|
| K.1 | `migration repair --status applied` × `gecmis/dalga-A-kismi.txt` (20260806234000, 20260806235500, 20260924100033) | A.1 + **Onay K kararı** (§4.3) | özet değişmez; bekleyen 9 | özet değişirse | aynı 3 sürüm `--status reverted` |

Onay K verilmezse: K.1 atlanır, Dalga B yine uygulanabilir ama CLI temiz olmaz ve **main birleştirmesi yapılmaz** (3 sürüm yeniden çalıştırılmaya kalkar).

### Paketler — Dalga B (sıra: P1 → P2 → P6 → P4 → P3 → P5 → P8)

Her paket tek işlem; hata olursa hiçbir şey değişmez (provada gösterildi). Her paketten sonra özet
karşılaştırması, sonra o paketin `gecmis/dalga-B-<P>.txt` sürümleri `repair --status applied`.

| # | Paket | Ön koşul | Beklenen sonuç | Durma koşulu (paket başlığı) | Geri alma |
|---|---|---|---|---|---|
| B.1 | P1 `rate_limit_take` | K.1 (ya da Onay K yoksa A.1) | fonksiyon var; anon/authenticated EXECUTE yok; repair 1 sürüm | fonksiyon yok ya da anon/authenticated EXECUTE | R1 (ancak kod geri alındıktan sonra; yoksa DOI ekleme kapanır) |
| B.2 | P2 metin sürüm damgası | B.1 | tetikleyici var; geri alınan örnek UPDATE hatasız; repair 1 | tetikleyici yok ya da örnek UPDATE hata | R2 |
| B.3 | P6 destek/danışmanlık koruması | B.2 | 2 tetikleyici; repair 1 | tetikleyici yok | R6 |
| B.4 | P4 kılavuz seçimi | B.3 | fonksiyon derlenir; repair 1 | derlenmez | R4 |
| B.5 | P3 KVKK + deneme işareti | B.4 | 2 sütun NULL eklenir, `handle_new_user` derlenir, satıra veri yazılmaz; repair 2 | sütun yok ya da fonksiyon derlenmez | R3 (varsayılan kip; **`tam=1` kullanılmaz** — KVKK onay zamanlarını siler) |
| B.6 | P5 G1 kimlik | B.5 + 0.6 bu pencerede yeniden ölçüldü; M.1 hazır (CI yeşil PR) | `auth.users` üzerinde 2 tetikleyici; veri adımı beklenen satır (0); repair 3 (NET-EŞDEĞER dahil); **uygulama anı kaydedilir** | tetikleyici eklenemezse ya da veri adımı beklenenden fazla satır | şema: R5, **yalnızca yeni kod geri alındıktan sonra**; veri adımı: yalnızca 0.6'da kaydedilen listeden elle |
| B.7 | P8 rol varsayılanı → `client` | B.6 + P8 kararı (§4.1) | `profiles.role` varsayılanı `client`; **hiçbir satır güncellenmez** | satır güncellenirse | R8 (varsayılan `employee`; arada açılan hesapların rolü değişmez) |
| B.8 | Son durum | B.7 | `db push --dry-run` bekleyen **0** (Onay K varsa); özet = prova son durum; depo hedefine fark 142 satır (kabul edilen liste, RC06c §2) | bekleyen ≠ 0 ya da fark listesi dışında satır | ters sıra R8 → R1 |
| (B.9) | P9 — **bu yayından ertelenebilir** (§4.5) | ayrı onay + 0.4 kapalı | `service_role` DELETE true, `authenticated` false | authenticated/anon yetkisi değişirse | R9 (yalnızca yetki; silinen veri yalnızca yedekten döner) |

### main — Production dağıtımı

| # | Adım | Ön koşul | Beklenen sonuç | Durma koşulu | Geri alma |
|---|---|---|---|---|---|
| M.1 | `design/os5` (`a08b61d`) → `main` birleştirmesi (PR) | 0.1 kapalı, B.8 tamam, Onay K verilmiş, CI yeşil | merge commit ağacı = `a08b61d` ağacı | aday SHA değişmişse ya da CI kırmızı | merge'i geri alan commit (`git revert -m 1`) — yalnızca kod |
| M.2 | Vercel Production dağıtımı READY | M.1 | `target: production`, kaynak `main` merge commit'i | derleme düşerse (önceki Production çalışmaya devam eder) | Vercel'de önceki Production dağıtımına anında geri dönüş (`b62bfcf` dağıtımı) |
| M.3 | Duman: giriş sayfası, oturum açma (iç ekip hesabı), Ana Sayfa, editör açılışı, Kaynaklar/Kaynakça, Ayarlar; Vercel çalışma zamanı hataları | M.2 | sayfa hatası yok; çalışma zamanı hatası yok | 5xx ya da hata sınırı ekranı | Vercel geri dönüşü; şema paketleri yerinde kalabilir: eski kod paketli şemada yerelde sınandı, 8/9 — tek fark yeni kayıtların şifresi (§5 R1) |
| M.5 | Ara dönemde onaylanıp şifresi silinen hesap sayısı (`eski-kod-uyumu/RAPOR.md` sorgusu, P5 anı → M.2 anı; salt okunur, yalnızca sayı) | M.2 | 0 ya da küçük, kayıtlı sayı | — (durma değil) | kişiler "Şifremi unuttum" yoluyla şifre belirler (yerelde S1/S2 PASS); gerekirse destek bildirimi |
| M.4 | Cron'lar (`vercel.json`: hesap-silme, deneme-hatirlatma, kaynak-onbellegi-temizle, academic-directory-refresh) ilk koşu günlüğü | M.2 | hata yok; hesap silmede yetim dal "ertelendi" (P9 yoksa beklenen) | hata | ilgili cron'u Vercel'de durdurma kararı |

**Geri alma sırası:** önce kod (Vercel geri dönüşü / revert), sonra gerekiyorsa şema (R8 → R1). R1 ve
R5 yeni kod çalışırken uygulanmaz. Geçmiş tablosu satırları geri alınmak zorunda değildir; şemayı değiştirmezler.

## 4. Kararlar

### 4.1 P8 — rol varsayılanı
**Karar verildi:** hedef `client` (RC06c §1). Kalan tek şey Production uygulama onayı (B.7).
Neden gerekli: Production'da `profiles.role` varsayılanı `employee`; kendi kaydolan her yeni
kullanıcı personel rolüyle açılıyor.

### 4.2 Mevcut `employee` hesapları
Production'da iki `employee` hesabı var (sayım; kimlikleri okunmadı). P8 onlara **dokunmaz**.
**Karar gereken:** bu iki hesap gerçekten personel mi?
- (a) Evet, personel → hiçbir şey yapılmaz. **Önerilen varsayılan.**
- (b) Hayır, yanlışlıkla `employee` açılmış müşteri → yayından SONRA, kişi bazında, panelden ya da
  ayrı onaylı tek satırlık güncelleme. Bu planın parçası değil; P8'e eklenmez.
Yayını engellemez: (b) seçilse bile bugünkü davranış sürer, yeni bir zarar oluşmaz.

### 4.3 Onay K — üç KISMİ sürümün geçmişe "uygulandı" yazılması
**Karar gereken:** evet / hayır.
- **Evet (önerilen):** K.1 uygulanır; CLI temiz olur; eksik parçalar (P7 tetikleyicileri, iki dizin,
  staging yapısı) ileride yeni bir migration'la gelir. Uygulama davranışı değişmez.
- **Hayır:** CLI bu üç sürümü yeniden çalıştırmaya kalkar → main birleştirmesi yapılamaz, yayın HOLD kalır.
Ayrıntı: RC06c §2 (K1–K3 tablosu).

### 4.4 Auth A1 — mevcut şifre korumasının yalnızca uygulamada olması
Bulgu: geçerli bir oturum belirteci olan biri Auth API'sine doğrudan şifre değişikliği gönderebilir;
mevcut şifre sorulmaz, 8 karakter yeter. **Bugünkü Production davranışıyla aynı** (yayın kötüleştirmiyor).
**Karar gereken** (biri seçilmeden madde açık kalır):
- (a) yayından önce ayar + kod + kabul → yayını geciktirir (ayar tek başına Ayarlar akışını kırabilir);
- (b) **yayından sonra ayrı iş** (önerilen): "Require current password" + küçük kod değişikliği + yerel kabul;
- (c) riski kabul edip belgelemek.
Hangisi seçilirse seçilsin, G1 metinlerde "uygulama içinden yapılan değişiklikler için" diye anlatılır.

### 4.5 Bu yayından ertelenebilecekler (ayrı)

| Madde | Ertelemenin etkisi | Neden ertelemek güvenli | Önkoşulu |
|---|---|---|---|
| **P9** (`service_role`'e `profiles` DELETE) | hesap silme cron'unun yalnızca **yetim profil** dalı silmez, "ertelendi / yetimSilinemedi" raporlar (bugünkü davranış: eski kod yanlışlıkla "silindi" diyordu, yeni kod doğru raporluyor). Olağan hesap silme (GoTrue `deleteUser` + kaskat) çalışır | veri değişikliği yok; düzeltilmiş kod durumu doğru raporluyor | uygulanacaksa: 0.4 (geri yükleme provası) kapalı + ayrı onay; R9 silinen veriyi geri getirmez |
| **Hak iadesi** (teknik arızada yanan asistan hakkının iadesi) | sağlayıcıya ulaşılamazsa kullanıcının saatlik hakkı yanar (20/saat) — bugünkü davranış | politika değişikliği; güvenlik ya da veri bütünlüğü riski değil, yalnızca kullanıcı deneyimi | ayrı tasarım + kod + test; bu yayının kapsamında değil |

Öneri: ikisi de bu yayından **ertelenir**; P9 geri yükleme provası kapandıktan sonra ayrı onayla.

## 5. Kalan riskler ve dar kontroller

**R1 — ara dönem (eski kod + paketli şema) — ÖLÇÜLDÜ (RC06p, `eski-kod-uyumu/RAPOR.md`).**
`b62bfcf` üretim derlemesi, gerçek yerel Postgres + GoTrue; aynı betik paketsiz (bugünkü Production
karşılığı) ve paketli şemada koşuldu. Paketsiz 9/9, paketli 8/9. Kayıt, e-posta onayı, şifre sıfırlama,
mevcut hesapla giriş, mevcut belgeyi açma ve kaydetme iki durumda da PASS; önceden var olan bir hata
çıkmadı. **Tek yeni etki (K3):** ara dönemde eski kodla kaydolup e-postasını onaylayan kişi ilk
oturumda panele girer, oturum kapandıktan sonra kayıtta seçtiği şifreyle giremez — P5 onaydan önce
konmuş şifreyi bilerek siliyor. Kurtarma yolu çalışıyor ("Şifremi unuttum", S1/S2 PASS); veri kaybı yok.
Ters sıra (önce yeni kod, sonra P5) aynı etkiyi yeni kodla üretir (kod okunarak; koşulmadı), yani
etkiyi sıfırlayan sıra yok. Etki ara dönemin süresiyle sınırlı: plan bu yüzden B.6 → M.2'yi arka arkaya
yürütür (0.7) ve dağıtımdan sonra etkilenen hesapları sayar (M.5). Bu etkinin kabulü tek yayın
onayının parçasıdır (§7).

**R2 — dokunmatik kaydırma (Stüdyo U5-dokunma, UNVERIFIED).** Başsız tarayıcıda üretilemiyor.
Dar kontrol: gerçek bir telefonda (iOS Safari ve Android Chrome) yazım ekranı açıkken asistan yaprağı
açık, parmakla yukarı-aşağı kaydırma; araç çubuğu düğmeleri yaprağın altında kalmamalı, "Geri al"
dokunulabilir olmalı. Tekerlek/klavye varyantları ve U3K PASS olduğu için kalan risk görsel bir anlık
örtüşme. Yer: yerel üretim derlemesi telefona açılarak (Production'a ve Test'e yazmaz) ya da Preview.

**R3 — Preview çalışma anı (UNVERIFIED).** Preview'un READY olduğu doğrulandı; bağlandığı Supabase
projesinin Test projesi olduğu değer okunmadan bilinmiyor (kod koruması yalnızca "Production değil"i
garanti eder). Dar kontrol, **yazmadan**: Preview giriş sayfasının yanıt başlığındaki CSP `connect-src`
içindeki `*.supabase.co` proje kimliğini okumak (oturum açmadan; Test'e yazma yok). Preview'da oturum
açmak oturum kaydı yazar → **paylaşılan Test'e yazmadır**, ayrı onay ister; bu turda yapılmadı.
Not: Vercel MCP ile korumalı Preview'u okumak geçici bir paylaşım bağlantısı oluşturur; bu da onayla yapılır.

**R4 — gerçek e-posta (Resend).** Yerel kabullerde posta yakalayıcıyla sınandı; gerçek gönderim
sınanmadı. Production anahtarı zaten Production'da; M.3'te kendi hesabına bir şifre sıfırlama e-postası
istenerek doğrulanabilir (gerçek kullanıcıya gönderim yok).

## 6. GO / HOLD

| Madde | Karar | Gerekçe | Kapanması için |
|---|---|---|---|
| Aday kodu (`a08b61d`) | **GO** | CI yeşil, Vercel Preview READY, yerel entegrasyon 125/0/2, gerçek AI yolu son AI kabulünden beri değişmedi | — |
| Yer tutucular / `check:migrations` | **GO** | adayda 121 dosya, CI geçti | — |
| Supabase entegrasyonu (otomatik Production migration) | **GO** (koşullu) | 17.11'de kapalı (panel) | 0.1'de uygulama günü yeniden okunur |
| Vercel Production dalı | **GO** (koşullu) | `main` (panel) | 0.2'de yeniden okunur |
| **Yedek güncelliği** | **HOLD** | son okunan yedek 17.11 05:00 UTC; 18.11 ve sonrası okunmadı | 0.3: panelde uygulama günü yedeğinin saatini oku ve kaydet |
| **İzole geri yükleme provası** | **HOLD (açık engel)** | hiç yapılmadı; PITR kapalı, veri değiştiren adımların tek dönüşü bu yedek | §2'deki prova (ayrı proje/izole Postgres, Production'a dokunmadan) + onay |
| **Onay K** | **HOLD** | karar verilmedi; verilmeden CLI temiz olmaz, main birleştirmesi yapılamaz | §4.3: evet/hayır kararı |
| P8 | **GO** (karar) / uygulama onayı bekliyor | hedef `client` kararlaştırıldı, satır güncellemez | B.7 için Production uygulama onayı |
| Mevcut 2 `employee` hesabı | **GO** | P8 dokunmaz; yayını engellemez | §4.2'de (a)/(b) kararı — yayından bağımsız |
| **Auth A1** | **HOLD** | açık karar maddesi; "eski davranışla aynı" maddeyi kapatmaz | §4.4: (a), (b) ya da (c) seçimi (önerilen b) |
| Ara dönem uyumu (R1) | **GO** (ölçüldü; etkinin kabulü onayda) | eski kod paketli şemada 8/9; tek yeni etki: ara dönemde kaydolanlar şifre sıfırlamayla girer; önceden var hata yok | §7 onayında K3 etkisinin kabulü; M.5 ölçümü |
| Dokunmatik kaydırma (R2) | **HOLD** (dar) | UNVERIFIED; başsız tarayıcıda üretilemez | §5 R2: gerçek telefonda kontrol (kullanıcı) ya da riskin kabulü |
| Preview çalışma anı (R3) | **HOLD** (dar) | bağlanılan projenin Test olduğu UNVERIFIED | §5 R3: CSP okuma (yazmasız; paylaşım bağlantısı için onay) ya da riskin kabulü. Uygulama kabulü yerel üretim derlemesinde yapıldığı için yayın kodunu doğrudan etkilemez |
| P9 | **ERTELENDİ** (öneri) | geri yükleme provası yok; R9 veri getirmez | yayından sonra: 0.4 kapalı + ayrı onay |
| Hak iadesi | **ERTELENDİ** (öneri) | politika değişikliği, yayın riski değil | ayrı iş |
| Production'a uygulama (Dalga A, K, B, main) | **HOLD** | yukarıdaki HOLD'lar açık | HOLD satırları kapandıktan sonra §7'deki **tek yayın onayı**; onay yoksa uygulama yok |

**Sonuç:** kod tarafı hazır (GO); eski kod–yeni şema uyumu ölçüldü (8/9, tek sınırlı yeni etki).
Yayın, Production tarafında dört karar/kanıt yüzünden **HOLD**: geri yükleme provası, güncel yedek
okuması, Onay K ve Auth A1 kararı. Dokunma ve Preview maddeleri dar ve kullanıcının kabulüyle
kapanabilir. Hepsi kapanınca tek onay (§7) yeterli.

## 7. Tek yayın onayı (önerilen metin)

Aşağıdaki onay verilene kadar Production'a hiçbir şey uygulanmaz. Onay yalnızca burada sayılanları
kapsar; durma koşullarından biri gerçekleşirse yayın o noktada durur ve devam yeni onay ister.

**Ön koşullar (onayın geçerli olması için hepsi):** 0.1 ve 0.2 yeniden okundu ve aynı; 0.3 uygulama
günü yedeği kayıtlı; 0.4 izole geri yükleme provası PASS; Onay K = evet; Auth A1 için seçim yapıldı;
aday hâlâ `a08b61d` ve CI yeşil.

**Onaylanan işlemler (bu sırayla, tek pencerede):**
1. Dalga A — `gecmis/dalga-A.txt`, 97 sürüm, `migration repair --status applied` (şema değişmez).
2. Onay K — `gecmis/dalga-A-kismi.txt`, 3 sürüm, aynı komut (şema değişmez).
3. Paketler, her biri tek işlem ve ardından kendi `dalga-B-<P>.txt` repair'i:
   P1 `rate_limit_take` → P2 metin sürüm damgası → P6 destek/danışmanlık koruması → P4 kılavuz seçimi →
   P3 KVKK + deneme işareti (varsayılan kip) → P5 G1 kimlik → P8 rol varsayılanı `client`.
4. `design/os5` @ `a08b61d` → `main` birleştirmesi ve Vercel Production dağıtımı (M.1–M.2), ardından M.3–M.5.

**Durma koşulları (biri gerçekleşirse dur, sonraki adıma geçme):**
- herhangi bir adımdan sonra Production şema özeti provanın aynı adımıyla eşleşmiyor;
- Dalga A sonrası bekleyen ≠ 12, Onay K sonrası ≠ 9, B.8'de ≠ 0;
- bir paketin başlığındaki DURDURMA koşulu (P1: anon/authenticated EXECUTE; P2: örnek UPDATE hatası;
  P3/P4/P6: nesne oluşmuyor; P5: tetikleyici eklenemiyor ya da veri adımı 0.6'daki sayıdan fazla satır;
  P8: herhangi bir satır güncelleniyor);
- P5 ön koşul sorgusu pencerede 0 değil ve kimlik listesi kaydedilmedi;
- M.1'de aday SHA değişmiş ya da CI kırmızı; M.2 derlemesi düşüyor; M.3'te 5xx ya da hata sınırı ekranı.

**Durunca geri alma:** önce kod (Vercel önceki dağıtım), sonra gerekirse şema R8 → R1
(`paketler/GERI_DONUS.md`; R1 ve R5 yeni kod çalışırken uygulanmaz). Geçmiş satırları şemayı
değiştirmediği için yerinde kalabilir. P5 veri adımı yalnızca kaydedilen listeden elle döner.

**Onayla kabul edilen bilinen etki:** P5 uygulandığı andan yeni kod dağıtılana kadar eski kodla
kaydolup onaylayan kişiler kendi şifreleriyle yeniden giremez, "Şifremi unuttum" ile girer (§5 R1);
M.5 sayısı rapora yazılır.

**Kapsam DIŞI (bu onay vermez):** P7, P9, Auth ayarı değişikliği (A1), hak iadesi politikası, mevcut
`employee` hesaplarına dokunma, Production'da restore, PITR/ücret ayarı, ArvoOS, PR #96.

## 8. Uzak dal temizliği (18.11.2026)

Kural ve listeler: `dal-temizligi/` (silmeden önce dal adı + tam SHA, rapor dalına `bbaf1d7` ile
kaydedildi). 153 uzak dal tarandı: **32 dal silme ölçütünü karşılıyor** (birleşmiş PR head'i = dal
HEAD'i ve `design/os5` @ `a08b61d`'nin atası), **121 dal korunuyor** (2 ana dal, 4 açık PR dalı,
5 kabul raporu dalı, oturumun geliştirme dalı, 49 PR'sız dal, 59 birleşmiş ama `design/os5`'in atası
olmayan — squash/rebase olasılığı incelenmedi, 1 PR'dan sonra commit almış dal).
**Silinen: 0.** Uzak dal silme bu oturumda izin katmanınca engellendi; 32 dal `dal-temizligi/silme-sonucu.tsv`'de
"SİLİNMEDİ" olarak duruyor. Aday `a08b61d`, `main` ve ayrışan dallar değişmedi.

