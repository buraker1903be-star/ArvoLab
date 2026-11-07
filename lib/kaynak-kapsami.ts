import type { MevcutKaynak } from "@/lib/kaynak-ekleme";

/*
  TEKRAR DENETİMİNİN KAPSAMI (A1, 07.11.2026). Bilerek "use server" DEĞİL
  (lib/auth-guards.ts ile aynı gerekçe: yardımcı, uç nokta değil).

  Çalışmaya bağlı kaynak: kullanıcının o çalışmadaki kaynakları (K2).
  Çalışmaya bağlı olmayan: kullanıcının genel kütüphanesi — project_id boş
  olan kendi kaynakları (K6). Başka kullanıcının kaynakları hiçbir kapsama
  girmez: sorgu owner_id ile süzülür (RLS gözetim rollerine başkalarının
  kaynaklarını okutuyor; tekrar denetimine karışmamalılar).

  "Sahip + çalışma" bugün çalışma kapsamının TAMAMI: kaynak yalnızca
  kullanıcının sahibi olduğu çalışmaya bağlanabiliyor (lib/kaynak-hedefi.ts).

  Hata YUTULMAZ: okunamayan kapsam "tekrar yok" demek değildir; çağıran
  ekleme yapmaz (lib/kaynak-ekleme.ts TEKRAR_DENETLENEMEDI).

  Bilinen sınır: sorgu sayfalanmıyor; PostgREST'in satır tavanını (Supabase
  varsayılanı 1000) aşan bir kapsamda tavanın ötesindeki kayıt görülmez.
  Toplu ekleme yolu (app/actions/kaynak-aktarim.ts hazirlik) aynı sınırla
  27.10.2026'dan beri çalışıyor; kesin çözüm veritabanı denetimi (mimari dosya, M4).
*/
type Yanit = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Sorgu = Yanit & { eq(sutun: string, deger: string): Sorgu; is(sutun: string, deger: null): Sorgu };
type Istemci = { from(tablo: string): { select(sutunlar: string): Sorgu } };

/* İstemci tipi bilinçli olarak dar (lib/kaynak-hedefi.ts gibi): sunucu ve önizleme istemcisi aynı yüzeyi taşır. */
export async function kapsamdakiKaynaklar(
  supabase: unknown,
  ownerId: string,
  projectId: string | null,
): Promise<{ kaynaklar: MevcutKaynak[] } | { hata: true }> {
  const sorgu = (supabase as Istemci).from("literature_sources").select("id, title, year, doi_or_url").eq("owner_id", ownerId);
  const { data, error } = await (projectId ? sorgu.eq("project_id", projectId) : sorgu.is("project_id", null));
  if (error) {
    console.error("[kaynak-kapsami] okunamadı:", error.message);
    return { hata: true };
  }
  return { kaynaklar: (data ?? []) as MevcutKaynak[] };
}
