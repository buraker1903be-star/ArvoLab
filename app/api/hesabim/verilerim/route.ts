import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Uzun tezlerde toplama biraz sürebilir; tek seferlik bir indirme.
export const maxDuration = 60;

/*
  "Verilerimi indir": kullanıcının ArvoLab'daki her kaydı tek bir JSON
  dosyasında.

  Neden var: ürün bireysel aboneye açıldı ve kişinin kendi verisini
  alabilmesi hem KVKK'nın istediği bir hak hem de güven meselesi. Veriyi
  rehin tutmayan bir ürün, bırakmak isteyeni de tutar.

  Neden sunucu eylemi değil de rota: tez metinleri megabaytlarca olabiliyor
  ve Vercel'in sunucu eylemi yanıt sınırı (~4,5 MB) aşılamaz. Rota dosyayı
  doğrudan indirtiyor.

  Neden servis anahtarı YOK: sorgular kullanıcının kendi oturumuyla,
  yani RLS altında çalışıyor. Yönetim istemcisiyle yazsaydım "yalnızca
  kendi verisi" kuralını burada elle kurmam gerekirdi; bir satır
  unutmak başkasının tezini indirtirdi.
*/
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const oku = async (tablo: string, sutun = "*", alan = "owner_id") => {
    const { data, error } = await supabase.from(tablo).select(sutun).eq(alan, user.id);
    // Okunamayan tablo BOŞ sayılmıyor: eksik indirmeyi tam sanmak, kullanıcıya
    // olmayan bir bütünlük sözü vermek olurdu.
    return error ? { hata: error.message } : data ?? [];
  };

  const { data: profil } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, kvkk_onay_at, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const { data: calismalar } = await supabase.from("academic_projects").select("*").eq("owner_id", user.id);
  const kimlikler = (calismalar ?? []).map((satir) => satir.id);

  const metinler = kimlikler.length
    ? (await supabase.from("project_manuscripts").select("*").in("project_id", kimlikler)).data ?? []
    : [];

  const [kaynaklar, atifDenetimleri, belgeler, ozgunluk, analizler, puanlar, destek] = await Promise.all([
    oku("literature_sources"),
    oku("citation_checks", "*", "created_by"),
    oku("document_uploads", "*", "uploaded_by"),
    oku("originality_checks", "*", "requested_by"),
    oku("analiz_sonuclari"),
    oku("academic_score_entries"),
    oku("app_support_requests", "*", "requested_by"),
  ]);

  const govde = {
    aciklama:
      "ArvoLab hesabınızdaki kayıtların tamamı. Tez metinleri Tiptap belge biçiminde (JSON) saklanır; "
      + "Word çıktısı için ürün içindeki dışa aktarmayı kullanın.",
    olusturulma: new Date().toISOString(),
    hesap: { id: user.id, eposta: user.email, olusturulma: user.created_at },
    profil: profil ?? null,
    calismalar: calismalar ?? [],
    calisma_metinleri: metinler,
    literatur_kaynaklari: kaynaklar,
    atif_denetimleri: atifDenetimleri,
    belge_yuklemeleri: belgeler,
    ozgunluk_kontrolleri: ozgunluk,
    analiz_sonuclari: analizler,
    docentlik_puanlari: puanlar,
    destek_talepleri: destek,
  };

  const gun = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(govde, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="arvolab-verilerim-${gun}.json"`,
      "cache-control": "no-store",
    },
  });
}
