import { createAdminClient } from "@/lib/supabase/admin";
import type { DogrulamaOnbellegi, OnbellekKaydi } from "@/lib/academic-reference-verification";

/*
  Akademik doğrulama önbelleğinin Supabase tarafı. Karar mantığı burada
  DEĞİL (lib/academic-reference-verification.ts); burası yalnızca okuma ve
  yazma, böylece doğrulama modülü Supabase'e bağlı kalmadan test
  edilebiliyor.

  Tablo yalnızca service_role'a açık (migration 20260924100021): istemciye
  açılsaydı kullanıcı "bu künye doğrulandı" satırını kendisi yazabilir,
  yani uydurma bir kaynağı sisteme doğrulanmış gösterebilirdi.
*/

/*
  SÜRELER DURUMA GÖRE FARKLI.

  Bulunan künye yıllarca aynı kalır; kaynakça bilgisi değişmez.
  BULUNAMAYAN künye ise geçici olabilir: yeni yayımlanmış bir makale
  birkaç hafta sonra indekslenir. "Bulunamadı"yı uzun süre saklamak,
  öğrenciye doğru yazdığı kaynak için aylarca yanlış cevap vermek olurdu.
*/
const GUN = 24 * 60 * 60 * 1000;
const SURE: Record<OnbellekKaydi["status"], number> = {
  verified: 90 * GUN,
  possible_match: 30 * GUN,
  not_found: 7 * GUN,
  insufficient_data: 0,
};

type Satir = {
  anahtar: string;
  durum: OnbellekKaydi["status"];
  eslesmeler: OnbellekKaydi["matches"];
  en_iyi: OnbellekKaydi["bestMatch"];
};

export function dogrulamaOnbellegi(): DogrulamaOnbellegi {
  const admin = createAdminClient();

  return {
    async oku(anahtarlar) {
      const { data, error } = await admin
        .from("kaynak_dogrulama_onbellegi")
        .select("anahtar,durum,eslesmeler,en_iyi")
        .in("anahtar", anahtarlar)
        // Süresi geçmiş satır YOK sayılıyor; temizlik ayrı çalışıyor.
        .gt("gecerlilik", new Date().toISOString());
      if (error) throw error;

      return new Map((data ?? []).map((satir) => {
        const kayit = satir as Satir;
        return [kayit.anahtar, {
          status: kayit.durum,
          bestMatch: kayit.en_iyi ?? null,
          matches: kayit.eslesmeler ?? [],
        }];
      }));
    },

    async yaz(girisler) {
      const simdi = Date.now();
      const satirlar = girisler
        .filter((giris) => SURE[giris.kayit.status] > 0)
        .map((giris) => ({
          anahtar: giris.anahtar,
          durum: giris.kayit.status,
          eslesmeler: giris.kayit.matches,
          en_iyi: giris.kayit.bestMatch,
          gecerlilik: new Date(simdi + SURE[giris.kayit.status]).toISOString(),
        }));
      if (!satirlar.length) return;

      /*
        upsert: aynı künyeye iki kullanıcı aynı anda bakabilir, ikincisi
        çakışmayla düşmemeli. Yeni sonuç eskisinin üstüne yazılıyor —
        süresi dolmuş bir "bulunamadı" böylece tazeleniyor.
      */
      const { error } = await admin
        .from("kaynak_dogrulama_onbellegi")
        .upsert(satirlar, { onConflict: "anahtar" });
      if (error) throw error;
    },
  };
}
