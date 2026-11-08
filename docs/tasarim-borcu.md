# Tasarım borcu (Signature Academic OS 2.0)

Bilerek ertelenen tasarım işleri. Her madde ilgili ekranın kendi tasarım
aşamasında, ayrı onayla ele alınır; toplu uygulanmaz (kurum sahibinin
kararı, 08.11.2026). Kapanan madde silinmez, "Kapandı" satırıyla tarihlenir.

## T1 — Arvo AI paneli (AÇIK, sonraki AI aşaması)

- **Yer:** editörün sağ paneli, Arvo AI görünümü
  (`app/dashboard/editor/[id]/write/yazim-paneli.tsx`, `yan-panel.tsx`,
  stiller `app/styles/workspace.css`).
- **Gözlem** (Signature OS 2.0 Aşama 1 ekran görüntüsü, 1440, koyu tema):
  1. **Büyük sekmeler:** dört görünüm sekmesi (Arvo AI / İnceleme /
     Kaynaklar / Teslim) simge + iki satırlık yazıyla ~110 px yükseklik
     kaplıyor; panelin ilk ekranının yaklaşık yedide biri.
  2. **Uzun açıklamalar:** "Satır içi öneri" anahtarının altında üç
     satırlık açıklama her açılışta görünüyor; sohbet alanını aşağı itiyor.
  3. **Öneri kartı:** öneri metni, "ÖNERİ" başlığı, kopyala düğmesi ve
     iki ayrı düğme satırı ayrı ayrı çerçeveli; kartın içinde üç katman var.
  4. **Eylem hiyerarşisi:** dolgulu "Paragrafın altına ekle", çerçeveli
     "Düzenleyerek ekle" ve bağlantı biçimli "Reddet" iki satıra dağılıyor;
     görev çipleri satırı (Paragraf yaz, Devam ettir, Ana hat,
     Akademikleştir…) yatayda taşıp kesiliyor.
- **Kapsam sınırı:** yalnızca görünüm. AI iş mantığı (istemler,
  atıf/sayı denetimi, asistan izi, kayıt, kredi kapısı, "metin belgeye
  yalnızca kullanıcının düğmesiyle girer" kuralı) değişmez.
- **Kabul (taslak):** sekmeler tek satır ve ≤ 44 px; açıklamalar ipucuna ya
  da ilk kullanıma; öneri kartı tek yüzey ve tek birincil eylem; görev
  çipleri taşmadan (kaydırma ya da "Daha fazla"); `asistan-paneli-kabul`,
  `ai-kabul` ve `odak-kabul` yeşil; açık/koyu, 1440/1024/390.

## T2 — Kart gölgeleri (AÇIK, ilgili ekranın aşamasında)

- Yüzey hiyerarşisinde "gölge yalnız üst düzeyde" kuralı tek satırla
  uygulanabilir (`--yuzey-kart-golge: none`, `app/styles/tokens.css`), ama
  14 kart kuralını birden değiştirir. Toplu değil, ekran ekran.

## T3 — Token'a eşit olmayan 16 köşe yarıçapı (AÇIK)

- Liste ve yeri: `scripts/check-css-tokens.mjs` → `HAM_YARICAP_BORCU`.
  Her biri görünür bir değişiklik; ekranının aşamasında taşınır, liste
  kendiliğinden küçülür (denetim "listeden düşün" der).

## T4 — Sistem dışı kırılımlar (AÇIK)

- Liste: `scripts/check-css-tokens.mjs` → `KIRILIM_BORCU`. Öncelikli:
  `max-width:1200px` (Dashboard ızgarası TAM 1200'de, masaüstü kabuğunun
  içinde 2 sütuna iniyor) — Dashboard aşamasında.

## T5 — Açılır menü gölgeleri (AÇIK)

- `secici-liste`, `tarih-secici-pencere`, `secim-ai-menu` ötekilerden ağır
  gölge (`--shadow-lg`) kullanıyor; ötekiler `--yuzey-acilir-golge`. Seçici
  ve tarih seçici formların, seçim menüsü editörün aşamasında.
