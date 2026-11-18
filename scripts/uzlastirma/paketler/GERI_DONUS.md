# Paket geri dönüşleri (RELEASE CLOSURE 06)

Hiçbiri Production'a uygulanmadı. Her paket ve her geri dönüş **tek işlemdir**:
çalışırken hata olursa hiçbir şey değişmez (kısmi hata provası: `../prova-hata.sh`,
bozulmuş P5 sonrası şema farkı 0 satır, veri adımı geri alındı).

Geri dönüşler `geri/R1…R8` altında. Sınama: `../prova-geri.sh` — Production
benzeri şemaya P1..P8 uygulanır, R8..R1 ters sırayla **ikişer kez** uygulanır,
son şema özeti paketlerden önceki özetle **0 satır** farkla eşleşir (17.11.2026).

Production fonksiyon gövdeleri tahmin edilmedi: R3, R4 ve R5'in geri koyduğu
gövdeler, Aşama 1'de Production kataloğuyla md5 üzerinden eşleşen depo
migration'larından satır aralığıyla alındı (`handle_new_user` = 20260924100011,
`best_guideline_for` = 20260924100034, `arvoos_uyeligini_bagla` = 20260924100015).

| Paket | Geri dönüş | Şema etkisi | Veri etkisi | Kod bağımlılığı (geri dönmeden önce) |
|---|---|---|---|---|
| P1 rate_limit_take | R1: fonksiyonu düşür | 1 fonksiyon | Yok (`auth_rate_limits` satırları ortak, dokunulmaz) | DOI kotası sayaç yoksa **kapalı kalır**: kod geri alınmadan DOI ile ekleme/toplu içe aktarma reddedilir |
| P2 metin_surum_damgasi | R2: tetikleyici + fonksiyon | 1 tetikleyici, 1 fonksiyon | Yok; sürüm sütunu önceden vardı | Kod tetikleyicisiz de çalışır (`MIGRATIONSIZ=1`); S4/S11 korumaları kalkar |
| P3 kvkk + deneme | R3: `handle_new_user` → 20260924100011. **Sütunlar varsayılan olarak KALIR** | 1 fonksiyon (`-v tam=1` ile +2 sütun, 1 dizin) | Varsayılan: yok. `tam=1`: **KVKK onay zamanları ve hatırlatma işaretleri silinir** (yasal kayıt — önce yedek) | `/api/hesabim/verilerim` ve deneme hatırlatma cron'u sütunları okuyor; sütunlar kaldığı sürece çalışır |
| P4 kılavuz seçimi | R4: `best_guideline_for` → 20260924100034 | 1 fonksiyon | Yok (yalnız yeni atamaların seçim sırası) | Yok |
| P5 G1 kimlik | R5: 2 tetikleyici + 3 fonksiyon düşer, `arvoos_uyeligini_bagla` → 20260924100015 | `auth.users` üzerinde 2 tetikleyici | **Veri adımı geri alınmaz**: sökülen kurum bağları (17.11: 0) yalnızca uygulama öncesi kaydedilen listeden elle geri konur | Yeni kod `ilk_sifre_gerekli`'yi çağırıyor: **kod geri alınmadan R5 uygulanmaz** |
| P6 destek/danışmanlık | R6: 2 tetikleyici | 2 tetikleyici | Yok | Yok |
| P7 akademik birim | R7: 2 tetikleyici + 2 fonksiyon | — | Yok | Yok |
| P8 rol varsayılanı | R8: varsayılan → `'employee'` | Sütun varsayılanı | Arada açılan hesapların rolü **değişmez** | Yok |
| P9 yetim profil silme yetkisi (RC06b) | R9: `revoke delete on public.profiles from service_role` | Tek tablo yetkisi | Yok | Düzeltilmiş kodda yetim dal yeniden "ertelendi" raporlanır; eski kod yanlış "silindi" der |

## Geri dönüş sırası

Uygulama sırasının tersi: R8 → R7 → R6 → R5 → R4 → R3 → R2 → R1. Paketler
arasında gizli bağımlılık yok (ters sırada uygulama provası: son özet olağan
sırayla aynı); yine de tek bir paket geri alınacaksa yalnızca onun R'si yeter.

## Veri ve şema dönüşü ayrı

- **Şema dönüşü** bu dosyalarla yapılır, saniyeler sürer, yedeğe ihtiyaç duymaz.
- **Veri dönüşü** (P5'in veri adımı, P3'ün `tam=1` kipi) bu dosyalarla yapılamaz.
  17.11.2026 panel kontrolü (RAPOR-RC06c §8): günlük fiziksel yedek VAR (son
  05:00:49 UTC), **PITR YOK**, yedekler Storage'ı kapsamıyor. Veri değiştiren bir
  adımın tek dönüşü bütün veritabanını son yedeğe geri yüklemek; aradaki her
  yazma kaybolur. Bu yüzden veri değiştiren adım (P5 veri adımı 0 değilse, P9)
  ayrı onayla ve yedeğin saatine yakın bir pencerede uygulanır. P5 için ön koşul sorgusunun döndürdüğü kimlik listesi
  uygulamadan hemen önce kaydedilmeli; 17.11'de liste boş.
