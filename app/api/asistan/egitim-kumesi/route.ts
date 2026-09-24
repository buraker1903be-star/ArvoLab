import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { SISTEM_ISTEMI as ANALIZ_ISTEMI } from "@/lib/ai/analiz-yorumu";
import { SISTEM_ISTEMI as KAYNAKCA_ISTEMI } from "@/lib/ai/kaynakca-denetimi";
import { SISTEM_ISTEMI as LITERATUR_ISTEMI } from "@/lib/ai/literatur-taramasi";

/*
  İnce ayar kümesinin dışa aktarımı (JSONL).

  ArvoLab'ın kendi modeli bu dosyayla eğitilecek: her satır bir sohbet —
  sistem istemi, kullanıcının gerçek akademik bağlamı ve asistanın o bağlamda
  verdiği, KULLANICININ FAYDALI BULDUĞU yanıt. Puanlanmamış kayıt dışarıda
  kalır: "model ne dedi" tek başına eğitim verisi değildir, "iyi miydi"
  bilgisi olmadan neyin taklit edileceği belli olmaz.

  Sistem istemi kayıtta tutulmuyor, yetenekten türetiliyor: istem zamanla
  değişiyor ve eğitimde güncel olanı kullanmak doğrusu.

  Erişim iç ekiple (ADMIN_ROLES: system_admin, founder) sınırlı; dosya
  kullanıcıların akademik metnini içerir. Eskiden KAYIT_ROLLERI yetiyordu,
  yani bir MÜŞTERİ kurumun Kontrolörü de kendi kurumunun bütün asistan
  girdilerini ince ayar dosyası olarak indirebiliyordu — kayıtları sayfada
  görmek ile eğitim kümesini dışarı taşımak aynı şey değil.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISTEMLER: Record<string, string> = {
  analiz: ANALIZ_ISTEMI,
  kaynakca: KAYNAKCA_ISTEMI,
  literatur: LITERATUR_ISTEMI,
};

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !ADMIN_ROLES.includes(profile.role))
    return new Response("Bu dışa aktarım yalnızca iç ekibe açıktır.", { status: 403 });

  const adres = new URL(request.url);
  // Varsayılan yalnızca "faydalı"; "hepsi" ile kısmen bulunanlar da alınır.
  const kapsam = adres.searchParams.get("kapsam") === "hepsi" ? ["faydali", "kismen"] : ["faydali"];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .select("capability, context, output, model, created_at")
    .eq("status", "completed")
    .in("rating", kapsam)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (error) {
    console.error("[ai] eğitim kümesi okunamadı:", error.message);
    return new Response("Eğitim kümesi okunamadı.", { status: 500 });
  }

  const satirlar = (data ?? [])
    .filter((satir) => satir.context && satir.output && ISTEMLER[satir.capability])
    .map((satir) =>
      JSON.stringify({
        messages: [
          { role: "system", content: ISTEMLER[satir.capability] },
          { role: "user", content: satir.context },
          { role: "assistant", content: satir.output },
        ],
        // Eğitim dışı bilgi: hangi modelden ve ne zaman geldiği, küme
        // derlenirken ayıklama yapılabilsin diye.
        arvolab: { yetenek: satir.capability, model: satir.model, tarih: satir.created_at },
      }),
    );

  const dosyaAdi = `arvolab-egitim-${new Date().toISOString().slice(0, 10)}.jsonl`;
  return new Response(satirlar.join("\n") + (satirlar.length ? "\n" : ""), {
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      "Cache-Control": "no-store",
    },
  });
}
