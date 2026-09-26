import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { SISTEM_ISTEMI as ANALIZ_ISTEMI } from "@/lib/ai/analiz-yorumu";
import { SISTEM_ISTEMI as KAYNAKCA_ISTEMI } from "@/lib/ai/kaynakca-denetimi";
import { SISTEM_ISTEMI as LITERATUR_ISTEMI } from "@/lib/ai/literatur-taramasi";
import { SYSTEM_PROMPT as BELGE_ISTEMI } from "@/lib/ai-feedback";

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
// Binlerce satırı sayfa sayfa toplamak sürebilir; tek seferlik bir indirme.
export const maxDuration = 60;

/*
  Küme TEK sorguyla, .limit(5000) ile çekiliyordu ve sıralaması yoktu.

  İki ayrı sessiz hata: PostgREST'in hangi 5000 satırı döndüreceği
  belirsizdi (aynı indirme iki kez farklı küme verebilir) ve tablo 5000'i
  geçtiği gün dosya kırpılmaya başlıyordu — hiçbir belirti vermeden. İnce
  ayar dosyası kırpıldığında ortaya çıkan model eksik veriyle eğitilmiş
  olur ve bunu sonradan anlamanın yolu yoktur.

  Artık sayfa sayfa hepsi toplanıyor. Üst sınıra ULAŞILIRSA dosya
  verilmiyor, hata dönüyor: yarısı gelmiş bir eğitim kümesini "tamam" diye
  teslim etmek, hiç teslim etmemekten kötü.
*/
const SAYFA = 1000;
const EN_COK_SATIR = 50_000;
const GUN = /^\d{4}-\d{2}-\d{2}$/;

/*
  Yeteneği burada olmayan kayıt eğitim kümesine hiç girmez (aşağıdaki
  filtre eler). "belge" baştan beri eksikti; ai_assistant_runs'a yazmaya
  başladığı anda sessizce elenirdi.
*/
const ISTEMLER: Record<string, string> = {
  analiz: ANALIZ_ISTEMI,
  kaynakca: KAYNAKCA_ISTEMI,
  literatur: LITERATUR_ISTEMI,
  belge: BELGE_ISTEMI,
};

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !ADMIN_ROLES.includes(profile.role))
    return new Response("Bu dışa aktarım yalnızca iç ekibe açıktır.", { status: 403 });

  const adres = new URL(request.url);
  // Varsayılan yalnızca "faydalı"; "hepsi" ile kısmen bulunanlar da alınır.
  const kapsam = adres.searchParams.get("kapsam") === "hepsi" ? ["faydali", "kismen"] : ["faydali"];

  // Küme büyüdüğünde tarih aralığıyla parçalanabilsin.
  const baslangic = adres.searchParams.get("baslangic");
  const bitis = adres.searchParams.get("bitis");
  if ((baslangic && !GUN.test(baslangic)) || (bitis && !GUN.test(bitis))) {
    return new Response("Tarih biçimi YYYY-AA-GG olmalı.", { status: 400 });
  }

  const supabase = await createClient();
  const kayitlar: Array<{ capability: string; context: string | null; output: string | null; model: string | null; created_at: string }> = [];
  let tamam = false;
  for (let bas = 0; bas < EN_COK_SATIR; bas += SAYFA) {
    let sorgu = supabase
      .from("ai_assistant_runs")
      .select("capability, context, output, model, created_at")
      .eq("status", "completed")
      .in("rating", kapsam)
      // id ikincil sıra: aynı ana düşen kayıtlarda sayfalama kaymasın,
      // yoksa bir satır iki sayfada ya da hiçbirinde çıkabilir.
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(bas, bas + SAYFA - 1);
    if (baslangic) sorgu = sorgu.gte("created_at", baslangic);
    if (bitis) sorgu = sorgu.lte("created_at", `${bitis}T23:59:59.999Z`);

    const { data, error } = await sorgu;
    if (error) {
      console.error("[ai] eğitim kümesi okunamadı:", error.message);
      return new Response("Eğitim kümesi okunamadı.", { status: 500 });
    }
    kayitlar.push(...(data ?? []));
    if ((data?.length ?? 0) < SAYFA) {
      tamam = true;
      break;
    }
  }

  if (!tamam) {
    return new Response(
      `Küme ${EN_COK_SATIR.toLocaleString("tr-TR")} satırı aştı; kırpılmış dosya vermiyorum. ` +
      "Tarih aralığıyla parça parça indirin: ?baslangic=YYYY-AA-GG&bitis=YYYY-AA-GG",
      { status: 413 },
    );
  }

  const satirlar = kayitlar
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

  const aralik = baslangic || bitis ? `-${baslangic ?? "basi"}_${bitis ?? "sonu"}` : "";
  const dosyaAdi = `arvolab-egitim-${new Date().toISOString().slice(0, 10)}${aralik}.jsonl`;
  return new Response(satirlar.join("\n") + (satirlar.length ? "\n" : ""), {
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dosyaAdi}"`,
      "Cache-Control": "no-store",
      /*
        Kaç satır ve kaçının yeteneği tanınmadığı için elendiği yazılır:
        dosyanın beklenenden küçük gelmesi sessiz bir sürpriz olmasın.
      */
      "X-Arvolab-Satir": String(satirlar.length),
      "X-Arvolab-Elenen": String(kayitlar.length - satirlar.length),
    },
  });
}
