import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { closeSubscription } from "@/lib/subscription";
import { BEKLEME_GUNU, suresiDoldu } from "@/lib/hesap-silme";

export const runtime = "nodejs";
// Kişi başına köprüye bir istek + depo temizliği; günde birkaç kişi.
export const maxDuration = 60;

/*
  Tek koşuda en fazla kaç hesap. Kişi başına bir köprü isteği var ve köprünün
  zaman aşımı 8 saniye (lib/subscription.ts); sınır olmadan kalabalık bir gün
  fonksiyonun 60 saniyesini aşar ve koşu YARIDA kesilirdi. Artakalanlar
  ertesi gün siliniyor — bir gün gecikme, yarım kalmış bir silmeden iyidir.
*/
const TEK_SEFERDE = 10;

/** Depo klasörünü gezerken güvenlik freni: döngüye girmiş bir listeleme sonsuza koşmasın. */
const EN_DERIN = 4;
const KOVA = "project-files";

/*
  Bekleme süresi dolan hesapların kalıcı silinmesi.

  Silme sırası ÖNEMLİ ve bilerek şöyle:

   1. ArvoOS abone kaydı kapatılır (closeSubscription). Kayıt SİLİNMİYOR:
      subscriber_payments ve payment_links ona cascade ile bağlı, VUK ise
      ödeme kayıtlarının beş yıl saklanmasını istiyor. ArvoOS durumu
      'canceled' yapıp e-posta ve adı anonimleştiriyor.
      Bu adım başarısız olursa hesap SİLİNMİYOR; yoksa ArvoOS'ta sahibi
      olmayan, kişisel bilgisi duran bir abone kaydı kalırdı ve onu
      bulmanın hiçbir yolu olmazdı.

   2. Depodaki dosyalar silinir. Hepsi "<kullanıcı id>/" altında
      (document-upload, import-dialog, Word çıktısı). Veritabanı satırı
      cascade ile gidiyor ama DOSYA gitmiyor: tez taslakları ve yüklenen
      belgeler, sahibi silindikten sonra da kovada durur.

   3. auth.users satırı silinir; gerisi cascade
      (migration 20260925110522_hesap_silme).
*/
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = adminIstemcisiVarsa();
  if (!admin) return Response.json({ error: "Sunucu anahtarı yok." }, { status: 503 });

  const sinir = new Date(Date.now() - BEKLEME_GUNU * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("profiles")
    .select("id, silme_talebi_at")
    .not("silme_talebi_at", "is", null)
    .lte("silme_talebi_at", sinir)
    .order("silme_talebi_at", { ascending: true })
    .limit(TEK_SEFERDE);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const adaylar = (data ?? []) as { id: string; silme_talebi_at: string }[];
  let silinen = 0;
  let ertelenen = 0;

  for (const aday of adaylar) {
    /*
      Süre sorguda da elenmişti; burada bir kez daha bakılıyor. Sunucu saati
      ile veritabanı saati arasındaki bir kayma, "bir gün erken silindi"
      demek olurdu ve o hatanın geri dönüşü yok.
    */
    if (!suresiDoldu(aday.silme_talebi_at)) continue;

    const { data: kullanici } = await admin.auth.admin.getUserById(aday.id);
    const eposta = kullanici?.user?.email;
    /*
      auth kaydı yoksa kişi zaten silinmiş, geride yetim bir profil kalmış:
      profili silip geçiyoruz. Köprüye e-postasız gidilemez zaten.
    */
    if (!eposta) {
      await admin.from("profiles").delete().eq("id", aday.id);
      silinen += 1;
      continue;
    }

    const kapatma = await closeSubscription({ id: aday.id, email: eposta });
    if (!kapatma) {
      console.error("[hesap-silme] ArvoOS kaydı kapatılamadı, hesap silinmedi", aday.id);
      ertelenen += 1;
      continue;
    }

    await dosyalariSil(admin, aday.id);

    const { error: silmeHatasi } = await admin.auth.admin.deleteUser(aday.id);
    if (silmeHatasi) {
      console.error("[hesap-silme] kullanıcı silinemedi", aday.id, silmeHatasi.message);
      ertelenen += 1;
      continue;
    }
    silinen += 1;
  }

  return Response.json({ aday: adaylar.length, silinen, ertelenen });
}

/*
  Kullanıcının depodaki bütün dosyaları. list() klasör ATLAMAZ, yalnızca bir
  seviye listeler; klasör girdisinin id'si null olur. Silme başarısız olursa
  akış durmuyor: dosya yüzünden hesabı silmemek, kullanıcının asıl istediği
  şeyi (verisinin gitmesi) hiç yapmamak olurdu — kalan dosya log'a düşüyor.
*/
async function dosyalariSil(admin: ReturnType<typeof adminIstemcisiVarsa>, userId: string) {
  if (!admin) return;
  const depo = admin.storage.from(KOVA);
  const yollar: string[] = [];

  const gez = async (klasor: string, derinlik: number) => {
    if (derinlik > EN_DERIN) {
      console.error("[hesap-silme] depo klasörü fazla derin, atlandı", klasor);
      return;
    }
    const { data, error } = await depo.list(klasor, { limit: 1000 });
    if (error) {
      console.error("[hesap-silme] depo listelenemedi", klasor, error.message);
      return;
    }
    for (const girdi of data ?? []) {
      const yol = `${klasor}/${girdi.name}`;
      if (girdi.id === null) await gez(yol, derinlik + 1);
      else yollar.push(yol);
    }
  };

  await gez(userId, 0);
  if (yollar.length === 0) return;

  const { error } = await depo.remove(yollar);
  if (error) console.error("[hesap-silme] dosyalar silinemedi", userId, error.message);
}
