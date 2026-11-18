# Eski kod + paketli şema uyumu (RC06p, 18.11.2026)

Soru: Dalga B (P1–P6, P8) uygulandıktan sonra `main` birleşip yeni kod dağıtılana kadar Production'da
eski kod (`main` @ `b62bfcf`) paketli şemada çalışacak. Kayıt, e-posta onayı, giriş, şifre sıfırlama ve
mevcut belgeyi açma/kaydetme bu arada çalışıyor mu?

Yöntem: aynı betik (`betikler/eski-uyum.mjs.txt`), aynı eski kod derlemesi, iki şema durumu.
- **paketsiz** = Production taklidi (bugünkü Production'ın karşılığı) → önceden var olan davranış.
- **paketli** = aynı taklit + P1, P2, P6, P4, P3, P5, P8 (RC06o ile aynı şema, md5 `358efe9c…`).
Bir adım yalnızca paketlide düşüyorsa **YENİ**, ikisinde de düşüyorsa **ÖNCEDEN VAR**.
Eski kodda olmayan yeni özellikler (ilk şifre kapısı, 12 karakter, mevcut şifre sorma) sınanmadı.

Ortam: `b62bfcf` temiz checkout, `next build` + `next start` (BUILD_ID `TX91-KGBhRuIkLJix0GZ1`,
`kanit/derleme.txt`); gerçek yerel Postgres 17 + GoTrue v2.197.0 + PostgREST; e-posta yerel
yakalayıcıya (dışarı gitmedi; `kanit/*/posta-ozet.jsonl` yalnızca konu ve bağlantı varlığını tutar).
AI çağrısı yok. Production'a ve paylaşılan Test'e dokunulmadı. Aday `a08b61d` değişmedi.

| # | Adım | paketsiz | paketli | Sınıf |
|---|---|---|---|---|
| K1 | Kayıt formu → doğrulama e-postası (hesap onaysız, şifre kayıtta konuyor) | PASS | PASS | — |
| K2 | E-postadaki bağlantı → onay düğmesi → oturum açık panel | PASS (şifre duruyor, rol `employee`) | PASS (şifre **silindi**, rol `client`) | davranış farkı (beklenen: P5, P8) |
| K3 | Aynı kişi oturum kapandıktan sonra kayıtta seçtiği şifreyle giriş | PASS | **FAIL** — "E-posta adresi veya şifre hatalı." | **YENİ** |
| S1 | Şifremi unuttum → e-posta → bağlantı → yeni şifre → panel | PASS | PASS | — |
| S2 | Sıfırlanan şifreyle giriş | PASS | PASS | — |
| M1 | Mevcut (onaylı) hesap şifresiyle giriş | PASS | PASS | — |
| M2 | Mevcut belge açılır, içerik görünür | PASS | PASS | — |
| M3 | Belgeye yazılan metin veritabanına kaydedilir ve yenilemede geri gelir | PASS | PASS | — |
| H0 | Sayfa hatası yok | PASS | PASS | — |
| | **Toplam** | **9/9** | **8/9** | 1 yeni, 0 önceden var |

## YENİ bulgu (K3)

P5'in `eposta_onayinda_sifreyi_temizle` tetikleyicisi onay anında, onaydan ÖNCE konmuş şifreyi siler
(bilerek; hesap ön-ele geçirmeye karşı). Eski kod şifreyi kayıt anında koyduğu için, ara dönemde
kaydolup e-postasını onaylayan kişi ilk oturumunda panele girer, ama oturum kapandıktan sonra kendi
şifresiyle **giremez**. Kurtarma yolu çalışıyor: "Şifremi unuttum" ile yeni şifre belirleyip girer
(S1, S2). Veri kaybı yok; mevcut hesaplar (M1–M3) etkilenmiyor.

Ters sıra da çözüm değil (koddan okunarak, koşulmadı): yeni kod P5 olmadan dağıtılırsa kayıt rastgele
bir şifreyle açılır ve `ilk_sifre_gerekli()` bulunamadığı için ilk şifre kapısı açık kalır
(`lib/ilk-sifre.ts`: okunamazsa kapı kapanmaz) → aynı kişi aynı biçimde kilitli kalır. Yeni kod P5'i
gerektirir (`paketler/GERI_DONUS.md`: R5 kod geri alınmadan uygulanmaz).

Sonuç: **incelenen iki sıradan** (önce P5 — ölçüldü; önce yeni kod — kod okunarak) hiçbiri etkiyi
sıfırlamıyor. Başka sıralar ya da yollar incelenmedi; bu genel bir garanti değildir. Etki ara dönemin
**süresiyle** sınırlı ve kurtarma yolu var. **Durum: K3 FAIL — risk kabulü bekliyor** (YAYIN-PLANI §7).

**Dağıtım düşerse ya da eski koda dönülürse** Production'da yine eski kod + P5 çalışır ve etki dönüş
süresince **devam eder**; kod geri dönüşü onu durdurmaz.

Yayın planında (YAYIN-PLANI §3, §5): P5 → P8 → main → Production dağıtımı arka arkaya; ardından M.5.

M.5 — **kontrol anında hâlâ şifresi boş hesaplar** (salt okunur, yalnızca sayı). Arada "Şifremi
unuttum" ile şifre belirleyenleri kaçırır; bu yüzden **toplam etkilenen kullanıcı sayısı değildir**.
Üst sınır yeni kodun dağıtım anıdır; dağıtım yoksa ya da eski koda dönüldüyse kontrol anı:
```sql
select count(*) from auth.users u
 where u.email_confirmed_at >= :p5_uygulama_ani
   and u.email_confirmed_at <  :yeni_kod_dagitim_ani_ya_da_kontrol_ani   -- yeni kod dağıtıldıysa sonrası ilk şifre kapısından geçer
   and u.created_at < u.email_confirmed_at
   and (u.encrypted_password is null or u.encrypted_password = '');
```
