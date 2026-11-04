import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ceviri } from "@/lib/dil-sunucu";
import { ETIK_DURUM_ADI } from "@/lib/etik/durum";
import CalismaSekmeleri from "../calisma-sekmeleri";
import EtikIcerigi, { etikVerisiOku } from "./etik-icerigi";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Etik kurul", en: "Ethics committee" }) };
}

/*
  ETİK KURUL SEKMESİ (02.11.2026, kurum sahibinin isteği). Tablo
  etik_kurul (20261102134543), kurallar lib/etik/, içerik etik-icerigi.tsx
  (Çalışmalarım'daki pencereyle ortak).

  ArvoLab başvuru belgelerini YAZMAZ (AGENTS.md, "asistan denetler,
  yazmaz"): başvurunun durumunu ve kurulun kararını tutar, kurulun
  yönergesinde geçen belgeleri listeler ve TARİH KİLİDİNİ uygular —
  veri toplama onaydan önce başladıysa tehlike olarak söyler. Teslim
  kontrolü ve Analiz Merkezi aynı karardan okur (lib/etik/durum.ts).
  Kurulun kararı hakkında hüküm verilmez; "onaydan geçer" denmez.
*/
export default async function EtikKurulSayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await ceviri();

  const [{ data: calisma, error }, veri] = await Promise.all([
    supabase.from("academic_projects").select("id, title, project_type").eq("id", id).maybeSingle(),
    etikVerisiOku(supabase, id),
  ]);
  if (error) {
    return (
      <main className="dashboard-page">
        <p className="alert" role="alert">
          {t({ tr: "Çalışma okunamadı. Kaydınız yerinde duruyor; sayfayı yenileyin.", en: "The work could not be read. Your data is safe; refresh the page." })}
        </p>
      </main>
    );
  }
  if (!calisma) notFound();

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header calisma-basligi">
        <div>
          <span className="dashboard-kicker">{t({ tr: "Etik kurul", en: "Ethics committee" })} · {t(ETIK_DURUM_ADI[veri.durum])}</span>
          <h1 title={calisma.title}>{calisma.title}</h1>
          <p>
            {t({
              tr: "Başvurunuzu takip edin, kurulun istediği belgeleri listeleyin ve verinin onaydan önce toplanmadığından emin olun. Belgeleri siz hazırlarsınız; ArvoLab takip eder ve denetler.",
              en: "Track your application, list the documents the committee requires and make sure no data is collected before approval. You prepare the documents; ArvoLab tracks and checks.",
            })}
          </p>
        </div>
      </section>

      <CalismaSekmeleri calisma={calisma} aktif="etik" />

      <EtikIcerigi projectId={id} veri={veri} />
    </main>
  );
}
