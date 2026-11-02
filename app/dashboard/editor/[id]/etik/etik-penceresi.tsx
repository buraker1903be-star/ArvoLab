import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ceviri } from "@/lib/dil-sunucu";
import { ETIK_DURUM_ADI } from "@/lib/etik/durum";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import EtikIcerigi, { etikVerisiOku } from "./etik-icerigi";

/*
  ETİK KURUL PENCERESİ (02.11.2026, kurum sahibinin isteği: "Etik Kurul
  diğerleri gibi popup açılır pencere olarak ilerlemeli"). Çalışmalarım'daki
  durum kartından açılır; Literatür, Kaynakça ve Kanıt matrisi
  pencereleriyle aynı davranış. İçerik sayfayla ortak (etik-icerigi.tsx).
  Düğme durumu taşır: hangi aşamada olduğu pencereyi açmadan görünsün;
  tarih kilidi tehlikedeyse düğme de kırmızı.
*/
export default async function EtikKurulPenceresi({
  projectId,
  triggerClassName = "projects-filter-button button-compact",
}: {
  projectId: string;
  triggerClassName?: string;
}) {
  const t = await ceviri();
  const veri = await etikVerisiOku(await createClient(), projectId);
  const durumAdi = t(ETIK_DURUM_ADI[veri.durum]);
  const etiket = veri.etik ? t({ tr: `Etik kurul · ${durumAdi}`, en: `Ethics · ${durumAdi}` }) : t({ tr: "Etik kurul", en: "Ethics" });
  const tehlike = veri.uyarilar.some((u) => u.ton === "danger");

  return (
    <PanelDrawer
      triggerLabel={etiket}
      triggerIcon={<ShieldCheck size={15} aria-hidden="true" />}
      triggerClassName={tehlike ? `${triggerClassName} etik-tetik-tehlike` : triggerClassName}
      kicker={t({ tr: "Etik kurul", en: "Ethics committee" })}
      title={t({ tr: "Etik kurul başvurusu", en: "Ethics committee application" })}
      description={t({
        tr: "Başvurunuzu takip edin, kurulun istediği belgeleri listeleyin ve verinin onaydan önce toplanmadığından emin olun. Belgeleri siz hazırlarsınız; ArvoLab takip eder ve denetler.",
        en: "Track your application, list the documents the committee requires and make sure no data is collected before approval. You prepare the documents; ArvoLab tracks and checks.",
      })}
      boy="tam"
      basaridaKapan={false}
    >
      <div className="etik-pencere">
        <EtikIcerigi projectId={projectId} veri={veri} />
      </div>
    </PanelDrawer>
  );
}
