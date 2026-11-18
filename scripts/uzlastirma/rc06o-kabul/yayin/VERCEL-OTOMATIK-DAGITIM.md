# `main` birleştirmesi neden otomatik Production dağıtımı başlatmadı? (18.11.2026)

**DURUM: KAPANDI (18.11.2026).** Kök neden kanıtlanamadı; ayar değiştirilmedi; gerçek tetikleme sonraki onaylı `main` birleştirmesinde doğrulanacak (UNVERIFIED).

Kapsam: yalnızca Vercel otomatik dağıtımı. Supabase, Auth, tasarım, bağımlılıklar kapsam dışı.
Bu incelemede **hiçbir ayar değiştirilmedi, dal açılmadı, commit/merge/dağıtım oluşturulmadı.**

## Salt okunur bulgular

| Kontrol | Kaynak | Sonuç |
|---|---|---|
| Bağlı depo | Vercel `get_git_deployment_context` | `arvo-lab` → GitHub `buraker1903be-star/ArvoLab` (bağlı) |
| Production dalı | Vercel dağıtım geçmişi | `main` push'ları daha önce Production'a gitti: `b62bfcf` (12.11 13:39 push → 13:40:02 Vercel GitHub deployment, olay metni "deployed … to production", `via` yok = Git tetiklemesi) |
| Vercel GitHub App erişimi | Vercel olayları | Aynı gün dal push'ları otomatik dağıtıldı: `7a1a3a8`, `b775f82`, `60d57c5` (09:08, birleştirmeden SONRA da çalışıyor) |
| Ignored Build Step | dağıtım listesi (CANCELED/ERROR/BLOCKED dahil) | `ce23df7` için hiçbir kayıt yok. Ignored Build Step adımı iptal edilmiş (CANCELED) bir dağıtım bırakırdı → **dışlandı** |
| Production dalı yanlışlığı | aynı | `main` Production dalı olmasaydı Preview dağıtımı oluşurdu; o da yok → **dışlandı** |
| Commit yazarı / doğrulama | git, Vercel meta | `ce23df7` yazarı Burak ERDOĞAN, işleyen GitHub, imzalı (verified) — otomatik dağıtılan `b62bfcf` ile aynı → **dışlandı** |
| Push GitHub'da oldu mu | GitHub check-runs (`ce23df7`) | `kontrol` (GitHub Actions, event=push) 08:58:24, `Supabase Preview` (Supabase GitHub App) 08:58:21 → push gerçekleşti ve **başka GitHub App'lere ulaştı** |
| Vercel'in push'u işlemesi | Vercel hesap olayları 08:40–09:10 | 08:58 için **hiçbir olay yok** (dağıtım, iptal, engel). İlk `ce23df7` kaydı 09:01:43 elle başlatılan dağıtım (`via Claude.ai`) |
| GitHub deployment kaydı | GitHub API `deployments?sha=ce23df7` | yalnızca 09:02:35 (elle başlatılan dağıtımın kaydı). `b62bfcf`'de push'tan ~1 dk sonra Git kaynaklı kayıt var |
| vercel.json | depo | `git` ayarı yok (dağıtımı kapatan `deploymentEnabled` yok); yalnızca bölge ve cron |

## Sonuç

- **Kanıtlanmış kök neden: yok.** Vercel bu push'u hiç işlememiş görünüyor (işleyip atlasaydı iz kalırdı).
  GitHub tarafında push oldu ve diğer uygulamalara iletildi; Vercel'in kendi kaydında 08:58'e ait hiçbir şey yok.
- Bu noktadan sonrası ancak iki yerden görülebilir, ikisi de bu oturumun erişiminde değil:
  Vercel GitHub App'in webhook teslim kayıtları (GitHub → uygulama sahibinin "Recent Deliveries"
  listesi) ve Vercel iç işlem günlükleri (Vercel destek).
- Önceki başarılı `main` birleştirmesinden gözlenen tek fark büyüklük: #108, 129 commit / 606 dosya
  taşıyordu (#74 yalnızca iki dosya). Bunun neden olduğu **kanıtlanmadı**; tahmin olarak kaydedildi.

## Değişen ayar

**Yok.** Bulgular Ignored Build Step, Production dalı, depo bağlantısı, uygulama erişimi ve yazar
doğrulamasını dışladı; değiştirilebilecek, bulguyla desteklenen bir ayar kalmadı.
Tahmine dayalı değişiklik (ör. Git bağlantısını kopar-bağla) yapılmadı: Production'ın bağlantısını
riske atar ve neden kanıtlanmadan bir şey düzeltmez.

## Doğrulama (bekliyor)

**UNVERIFIED** — gerçek tetikleme, bir sonraki onaylı `main` birleştirmesinde doğrulanacak.
O birleştirmede:
1. Birleştirmeden sonra 2 dakika içinde Vercel'de `githubCommitRef: main` ve `target: production`
   olan, `via` alanı OLMAYAN bir dağıtım oluşmalı (olay metni "deployed … to production").
2. GitHub `repos/…/deployments?sha=<merge>` altında `vercel[bot]` kaydı push'tan ~1 dk sonra görünmeli.
3. Oluşmazsa: GitHub → Settings → Integrations → Applications → Vercel → depo erişiminde ArvoLab
   seçili mi; Vercel → Project arvo-lab → Settings → Git (bağlı depo, Production Branch = main,
   Ignored Build Step boş) panelden okunur; olmuyorsa birleştirme commit'inin SHA'sı ve saatiyle
   Vercel desteğine webhook teslim kaydı sorulur. Bu arada yayın, bu raporda kullanılan Git kaynaklı
   elle dağıtımla (`create_deployment`, `gitSource` = `main` @ merge SHA, `target: production`) yapılır.

## Geri alma

Değişiklik yapılmadığı için geri alınacak bir şey yok. Elle başlatılan Production dağıtımında
geri dönüş: Vercel'de önceki Production dağıtımına anında dönüş (`dpl_APyCvwtvTpZQLwEThF3aDxiF76LX`,
`b62bfcf`) — K3 notu geçerli: eski koda dönüş P5 kaynaklı etkiyi durdurmaz.
