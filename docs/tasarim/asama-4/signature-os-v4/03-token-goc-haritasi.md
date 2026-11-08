# Token göç haritası — mevcut 242 token → v4 önerisi

Not: V4.0 audit'teki "290 token" tanım SATIRI sayısıydı (242 ayrı ad + koyu temada yeniden tanımlananlar). Doğru sayı 242 ayrı token.

Üretildi: `node docs/tasarim/asama-4/signature-os-v4/araclar/goc-haritasi.mjs`
(app/styles/tokens.css salt okunur; uygulamaya YAZILMADI).
"Kullanım": app/, lib/, components/ içindeki CSS/TS/TSX'te `var(--ad)` sayısı
(tokens.css hariç). Toplam 3719 başvuru.

| Tür | Token sayısı | Anlamı |
|---|---|---|
| eşlenir | 126 | v4 rolüne birebir |
| palet | 43 | ham palet; bileşen okumaz |
| birleşir | 23 | bileşik tipografi token'ına katlanır |
| yeniden | 22 | bileşen token'ı v4 kuralıyla yeniden tanımlanır |
| korunur | 11 | değişmez (belge/yazdırma) |
| kaldırılır | 9 | v4'te karşılığı yok / kullanılmıyor |
| karar | 8 | elle karar gerekir |

## En çok kullanılan 25 token (değişiklik etkisi en geniş)

| Token | Kullanım | v4 karşılığı |
|---|---|---|
| `--ink` | 265 | --metin-1 |
| `--muted` | 265 | --metin-2 |
| `--fs-sm` | 246 | --tip-* bileşik token'ına katlanır |
| `--line-soft` | 202 | --cizgi |
| `--primary-ink` | 194 | --vurgu-metin |
| `--ink-soft` | 133 | --metin-1 |
| `--surface-2` | 130 | --yuzey-2 |
| `--fs-micro` | 124 | --tip-* bileşik token'ına katlanır |
| `--surface` | 98 | --yuzey-1 |
| `--line` | 98 | --cizgi |
| `--s-2` | 89 | --b-2 |
| `--r-sm` | 84 | --r-2 |
| `--danger` | 81 | --hata |
| `--lh-metin` | 81 | --tip-* bileşik token'ına katlanır |
| `--r-pill` | 78 | elle karar (aşağıda) |
| `--fs-base` | 70 | --tip-* bileşik token'ına katlanır |
| `--warning` | 69 | --uyari |
| `--success` | 68 | --basari |
| `--r-md` | 65 | --r-3 |
| `--s-3` | 63 | --b-3 |
| `--s-4` | 61 | --b-4 |
| `--primary-soft` | 59 | --vurgu-yumusak |
| `--r-lg` | 56 | --r-4 |
| `--odak-halkasi` | 56 | --odak (halka gölgesi bileşende) |
| `--fs-body` | 52 | --tip-* bileşik token'ına katlanır |

## Elle karar gerekenler

| Token | Kullanım | Not |
|---|---|---|
| `--secondary-strong` | 2 | --ilerleme (yeşil yalnız ilerleme/başarı) |
| `--secondary-bright` | 7 | --ilerleme |
| `--shadow-inset` | 4 | kaldırılır (v4'te iç gölge yok) |
| `--r-pill` | 78 | korunur yalnız anahtar (switch) ve ilerleme çubuğu için; rozetler v4'te --r-1 (hap biçimi terk ediliyor) |
| `--r-daire` | 22 | korunur (avatar, durum noktası) |
| `--giris-vurgu-cizgi` | 7 | --cizgi (vurgu zeminli kutularda ayrı çizgi rengi yok) |
| `--kenarlik-hover` | 3 | --cizgi-guclu |
| `--tip-okuma-satir` | 3 | --tip-govde-tel satır aralığı (1,47) ve belge alanında kılavuz satır aralığı |

## Tam liste

| Token | Kullanım | Tür | v4 karşılığı |
|---|---|---|---|
| `--brand-50` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-100` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-300` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-400` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-500` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-700` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-800` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-900` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--brand-950` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--accent-100` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--accent-300` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--accent-400` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--accent-500` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--accent-700` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--accent-800` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--n-0` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-50` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-100` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-300` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-400` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-600` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-700` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--mavi-800` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-0` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-25` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-50` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-75` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-100` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-150` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gri-200` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--yazi-900` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--yazi-700` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--yazi-600` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--yazi-500` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--yazi-400` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-950` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-900` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-875` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-850` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-800` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-750` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-700` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-600` | 0 | palet | ham palet → --p-* (bileşen okumaz) |
| `--gece-yazi-100` | 0 | kaldırılır | kullanılmıyor → kaldırılabilir |
| `--gece-yazi-300` | 0 | kaldırılır | kullanılmıyor → kaldırılabilir |
| `--gece-yazi-400` | 0 | kaldırılır | kullanılmıyor → kaldırılabilir |
| `--gece-yazi-500` | 0 | kaldırılır | kullanılmıyor → kaldırılabilir |
| `--bg` | 7 | eşlenir | --yuzey-zemin |
| `--surface` | 98 | eşlenir | --yuzey-1 |
| `--surface-2` | 130 | eşlenir | --yuzey-2 |
| `--surface-sunken` | 14 | eşlenir | --yuzey-cokuk |
| `--surface-raised` | 31 | eşlenir | --yuzey-ust |
| `--kagit` | 8 | eşlenir | --kagit |
| `--kenar-zemin` | 1 | eşlenir | --yuzey-kenar |
| `--overlay` | 5 | eşlenir | --ortu |
| `--ink` | 265 | eşlenir | --metin-1 |
| `--ink-soft` | 133 | eşlenir | --metin-1 |
| `--muted` | 265 | eşlenir | --metin-2 |
| `--dim` | 14 | eşlenir | --metin-3 |
| `--on-brand` | 17 | eşlenir | --metin-ters |
| `--line` | 98 | eşlenir | --cizgi |
| `--line-soft` | 202 | eşlenir | --cizgi |
| `--primary` | 20 | eşlenir | --vurgu |
| `--primary-strong` | 0 | eşlenir | --vurgu |
| `--accent` | 0 | eşlenir | --vurgu-metin |
| `--accent-strong` | 0 | eşlenir | --vurgu-metin |
| `--accent-bright` | 0 | eşlenir | --vurgu |
| `--accent-soft` | 0 | eşlenir | --vurgu-yumusak |
| `--focus` | 13 | eşlenir | --odak |
| `--primary-hover` | 6 | eşlenir | --vurgu-uzerine |
| `--primary-soft` | 59 | eşlenir | --vurgu-yumusak |
| `--primary-ink` | 194 | eşlenir | --vurgu-metin |
| `--on-primary` | 0 | eşlenir | --metin-ters |
| `--primary-focus` | 1 | eşlenir | --odak (halka gölgesi bileşende) |
| `--secondary` | 6 | eşlenir | --basari (ilerleme dışında kullanılmaz) |
| `--secondary-strong` | 2 | karar | elle karar (aşağıda) |
| `--secondary-bright` | 7 | karar | elle karar (aşağıda) |
| `--secondary-soft` | 3 | eşlenir | --basari-yumusak |
| `--success` | 68 | eşlenir | --basari |
| `--success-soft` | 15 | eşlenir | --basari-yumusak |
| `--warning` | 69 | eşlenir | --uyari |
| `--warning-soft` | 17 | eşlenir | --uyari-yumusak |
| `--danger` | 81 | eşlenir | --hata |
| `--danger-soft` | 19 | eşlenir | --hata-yumusak |
| `--info` | 19 | eşlenir | --vurgu-metin |
| `--info-soft` | 10 | eşlenir | --vurgu-yumusak |
| `--neutral` | 3 | eşlenir | --metin-2 |
| `--neutral-soft` | 2 | eşlenir | --notr-yumusak |
| `--sidebar-ink` | 0 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--sidebar-muted` | 0 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--sidebar-line` | 0 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--sidebar-hover` | 0 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--koyu-panel-zemin` | 2 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--koyu-panel-cizgi` | 1 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--golge-tonu` | 1 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--golge-tonu-derin` | 1 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--grafik-cubuk` | 2 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--grafik-cubuk-acik` | 1 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--ilerleme-parlak` | 1 | eşlenir | --ilerleme |
| `--logo-plaka` | 1 | yeniden | bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır |
| `--shadow-sm` | 20 | eşlenir | --golge-1 |
| `--shadow-md` | 10 | eşlenir | --golge-2 |
| `--shadow-lg` | 11 | eşlenir | --golge-3 |
| `--shadow-inset` | 4 | karar | elle karar (aşağıda) |
| `--yuzey-kanvas` | 0 | eşlenir | --yuzey-zemin |
| `--yuzey-duzlem-ayrac` | 1 | eşlenir | --cizgi |
| `--yuzey-kart` | 1 | eşlenir | --yuzey-1 |
| `--yuzey-kart-cizgi` | 1 | eşlenir | --cizgi |
| `--yuzey-kart-golge` | 15 | eşlenir | --golge-1 |
| `--yuzey-ust` | 5 | eşlenir | --yuzey-ust |
| `--yuzey-acilir-golge` | 4 | eşlenir | --golge-2 |
| `--yuzey-pencere-golge` | 1 | eşlenir | --golge-3 |
| `--kontrol-golge` | 2 | eşlenir | --golge-1 |
| `--r-xs` | 29 | eşlenir | --r-1 |
| `--r-sm` | 84 | eşlenir | --r-2 |
| `--r-md` | 65 | eşlenir | --r-3 |
| `--r-lg` | 56 | eşlenir | --r-4 |
| `--r-xl` | 14 | eşlenir | --r-4 |
| `--r-pill` | 78 | karar | elle karar (aşağıda) |
| `--r-daire` | 22 | karar | elle karar (aşağıda) |
| `--kontrol-h` | 21 | eşlenir | --kontrol |
| `--kontrol-h-sik` | 9 | eşlenir | --kontrol-sik |
| `--kontrol-h-dokunma` | 19 | eşlenir | --dokunma |
| `--kontrol-r` | 4 | eşlenir | --r-2 |
| `--kontrol-dolgu` | 1 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--kontrol-dolgu-sik` | 2 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--odak-halkasi` | 56 | eşlenir | --odak (halka gölgesi bileşende) |
| `--dugme-birincil` | 2 | eşlenir | --vurgu |
| `--dugme-birincil-hover` | 2 | eşlenir | --vurgu-uzerine |
| `--giris-vurgu-zemin` | 4 | eşlenir | --yuzey-vurgu |
| `--giris-vurgu-cizgi` | 7 | karar | elle karar (aşağıda) |
| `--dugme-agirlik` | 3 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--dugme-hover-zemin` | 20 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--kenarlik-hover` | 3 | karar | elle karar (aşağıda) |
| `--menu-r` | 2 | eşlenir | --r-3 |
| `--menu-dolgu` | 1 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--menu-golge` | 1 | eşlenir | --golge-2 |
| `--menu-oge-h` | 1 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--menu-oge-r` | 1 | eşlenir | --r-2 |
| `--pencere-r` | 1 | eşlenir | --r-5 |
| `--pencere-golge` | 2 | eşlenir | --golge-3 |
| `--hap-agirlik` | 1 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--kart-araligi` | 7 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--kart-dolgu` | 3 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--kart-r` | 4 | eşlenir | --r-4 |
| `--karo-dolgu` | 5 | yeniden | bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır |
| `--karo-r` | 8 | eşlenir | --r-3 |
| `--font-body` | 2 | eşlenir | --yazi-arayuz |
| `--font-belge` | 1 | korunur | korunur (belge biçimi kılavuzdan; UI token'larından ayrı) |
| `--font-brand` | 1 | eşlenir | --yazi-arayuz |
| `--font-display` | 7 | eşlenir | --yazi-arayuz (başlıklar --yazi-editoryal) |
| `--font-mono` | 8 | eşlenir | --yazi-kod |
| `--fs-micro` | 124 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-sm` | 246 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-base` | 70 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-body` | 52 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-md` | 40 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-lg` | 19 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-xl` | 12 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-title` | 0 | birleşir | --tip-* bileşik token'ına katlanır |
| `--tip-okuma` | 3 | eşlenir | --tip-govde-tel (okuma) |
| `--tip-okuma-satir` | 3 | karar | elle karar (aşağıda) |
| `--tip-arayuz` | 3 | eşlenir | --tip-govde |
| `--tip-meta` | 7 | eşlenir | --tip-meta |
| `--tip-mikro` | 1 | eşlenir | --tip-yardim |
| `--tip-h2` | 0 | eşlenir | --tip-bolum |
| `--tip-h1` | 0 | eşlenir | --tip-sayfa |
| `--tip-display` | 0 | eşlenir | --tip-gosterim |
| `--fs-display` | 1 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-sayfa` | 2 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-sayfa-telefon` | 1 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-calisma` | 3 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-calisma-sik` | 3 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fs-tanitim` | 0 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fw-normal` | 0 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fw-orta` | 0 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fw-yari` | 0 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fw-kalin` | 0 | birleşir | --tip-* bileşik token'ına katlanır |
| `--fw-display` | 7 | birleşir | --tip-* bileşik token'ına katlanır |
| `--lh-display` | 4 | birleşir | --tip-* bileşik token'ına katlanır |
| `--ls-display` | 7 | birleşir | --tip-* bileşik token'ına katlanır |
| `--lh-metin` | 81 | birleşir | --tip-* bileşik token'ına katlanır |
| `--lh-baslik` | 9 | birleşir | --tip-* bileşik token'ına katlanır |
| `--s-1` | 23 | eşlenir | --b-1 |
| `--s-2` | 89 | eşlenir | --b-2 |
| `--s-3` | 63 | eşlenir | --b-3 |
| `--s-4` | 61 | eşlenir | --b-4 |
| `--s-5` | 18 | eşlenir | --b-5 |
| `--s-6` | 11 | eşlenir | --b-6 |
| `--s-8` | 4 | eşlenir | --b-8 |
| `--s-10` | 0 | eşlenir | --b-10 |
| `--s-12` | 0 | eşlenir | --b-12 |
| `--z-taban` | 3 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-ust` | 1 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-sticky` | 7 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-acilir` | 1 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-topbar` | 2 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-panel` | 1 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-menu` | 4 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-gezinme` | 1 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-dock` | 2 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-pencere` | 1 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--z-toast` | 10 | eşlenir | --z-* (ad korunur, ölçek yeniden numaralanır) |
| `--sure-hizli` | 41 | eşlenir | --sure-1 |
| `--sure-orta` | 5 | eşlenir | --sure-2 |
| `--sure-yavas` | 1 | eşlenir | --sure-3 |
| `--ease-spring` | 38 | eşlenir | --egri |
| `--ease-sheet` | 5 | eşlenir | --egri-sayfa |
| `--glass-bg` | 1 | kaldırılır | kaldırılır (v4'te cam/blur yok) |
| `--glass-strong` | 5 | kaldırılır | kaldırılır (v4'te cam/blur yok) |
| `--glass-blur` | 12 | kaldırılır | kaldırılır (v4'te cam/blur yok) |
| `--gezinme-genislik` | 1 | eşlenir | --kenar-genis |
| `--gezinme-ray` | 2 | eşlenir | --ray (64 px; bugün 88 — K2: bu aşamada değişmez) |
| `--alt-cubuk-h` | 2 | eşlenir | --alt-cubuk |
| `--sidebar-width` | 1 | eşlenir | --kenar-genis |
| `--topbar-height` | 8 | eşlenir | --ust |
| `--dock-alani` | 6 | yeniden | yerleşim token'ı; 02 §11 kırılım tablosuna göre |
| `--content-max` | 1 | eşlenir | --icerik-max |
| `--background` | 0 | eşlenir | --yuzey-zemin |
| `--foreground` | 0 | eşlenir | --metin-1 |
| `--muted-foreground` | 0 | eşlenir | --metin-2 |
| `--border` | 1 | eşlenir | --cizgi |
| `--surface-muted` | 0 | eşlenir | --yuzey-cokuk |
| `--primary-foreground` | 2 | eşlenir | --metin-ters |
| `--brand-navy` | 0 | kaldırılır | kullanılmıyor → kaldırılabilir |
| `--brand-green` | 0 | kaldırılır | kullanılmıyor → kaldırılabilir |
| `--radius-sm` | 5 | eşlenir | --r-2 |
| `--radius-md` | 1 | eşlenir | --r-3 |
| `--radius-lg` | 0 | eşlenir | --r-4 |
| `--print-paper` | 2 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-ink` | 10 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-desk` | 1 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-font` | 3 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-size` | 5 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-line` | 1 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-margin-top` | 3 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-margin-right` | 1 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-margin-bottom` | 3 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--print-margin-left` | 1 | korunur | korunur (yazdırma/PDF çıktısı; tasarım dışı) |
| `--belge-masa` | 2 | eşlenir | --masa |
| `--belge-kenar` | 4 | eşlenir | --cizgi-guclu |
| `--yan-panel-genis` | 1 | eşlenir | --baglam-panel |
