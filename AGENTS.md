<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# ArvoLab

Akademik çalışma yazım ve analiz platformu. Next.js 16 · React 19 · Supabase.
Genel tanıtım, kurulum ve komutlar için `README.md`.

## Dil

Arayüz metinleri, hata mesajları ve kod yorumları **Türkçe**. Yorumlar "ne
yaptığını" değil **neden öyle olduğunu** anlatır; bir hata düzeltiliyorsa eski
davranış da yazılır ("Eskiden … oluyordu"). Yeni kod bu üsluba uyar.

## Değişmezler

- **Abonelik kapısı.** Dış maliyet üreten (OpenAI, depolama, ağır çözümleme)
  ya da yeni içerik yazan her server action `isSubscriptionBlocked()`
  çağırmalı. Paneldeki kapı yalnızca ekranı kapatır; sunucu işlemi doğrudan
  çağrılabilir. Hangi işlemde kapı var, hangisinde bilerek yok — listesi
  `lib/access.ts` içinde. Ödeme, giriş ve destek yolları **asla** kapatılmaz:
  engellenen kullanıcı kendi kilidini açabilmeli.
- **Kapıyı yalnızca net bir "hayır" kapatır.** Kurum kaydı okunamazsa,
  ArvoOS'a ulaşılamazsa ya da lisans hiç bildirilmemişse kimse engellenmez
  (`lib/license-decision.ts`). Geçici bir arıza kullanıcıları dışarıda
  bırakmamalı. İç ekip (`system_admin`, `founder`) hiçbir koşulda engellenmez.
- **`ADMIN_ROLES` yalnızca `system_admin` ve `founder`.** `academic_manager`,
  `controller`, `expert` ve `employee` abonelik kapısından geçer; personel
  akışlarına kapı eklerken bunu hesaba katın.
- **`lib/auth-guards.ts` bilerek `"use server"` DEĞİL.** "use server"
  dosyasındaki her export dışarıdan çağrılabilir bir uç noktaya dönüşür.
  Yardımcılar ve tipler böyle dosyalarda durmaz.
- **RLS asıl güvenlik katmanıdır.** Sunucudaki rol kontrolü yetkisiz isteğin
  sessizce "başarılı" görünmesini engeller ve kullanıcıya anlaşılır mesaj
  verir; RLS'in yerini tutmaz.
- **Paylaşım belirteci veritabanında ham tutulmaz.** Yalnızca SHA-256 özeti
  yazılır, belirtecin kendisi bir kez gösterilir (`lib/share-token.ts`).
- **E-posta gönderimi akışı düşürmez.** `RESEND_API_KEY` yoksa gönderim
  sessizce atlanır; davet ve şifre sıfırlama istekleri çalışmaya devam eder
  (hesabın varlığını sızdırmamak için de gerekli).

## Migration

**`supabase migration new` kullanmayın**, `npm run db:new -- <ad>` kullanın.
Dosyalar bir dönem gerçek tarihle değil "bir sonraki gün" mantığıyla
adlandırıldı; bugünün damgasıyla açılan dosya uygulanmışların önüne sıralanır.
Gerekçe ve denetim: `scripts/check-migrations.mjs`. Mevcut migration
düzenlenmez, yenisi eklenir. Yeni tablo eklerken RLS'i açıp politikalarını
aynı migration içinde yazın.

## Testler

`tests/unit/` yalnızca Next, React ya da Supabase'e dokunmayan saf mantık
modülleri içindir. Bir mantık parçası test edilemiyorsa nedeni genellikle
böyle bir dosyanın içinde durmasıdır — ayırın. Bir hata düzeltince onu
sabitleyen testi de ekleyin.

## Kontroller

`npx tsc --noEmit`, `npm run lint`, `npm run check:css`,
`npm run check:migrations`, `npm run test:unit` — beşi de CI'da
(`.github/workflows/ci.yml`) çalışır. Derleme CI'da yapılmaz, Vercel tarafında.

## Stil

TSX'te satır içi stil ve ham hex renk yok; ham renk yalnızca
`app/styles/tokens.css`'te. En küçük yazı 11px. `npm run check:css` denetler.
