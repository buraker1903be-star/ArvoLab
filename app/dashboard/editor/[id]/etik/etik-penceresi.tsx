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
  satir = false,
}: {
  projectId: string;
  triggerClassName?: string;
  /*
    Ana sayfanın "Kaynaklar ve kanıt" listesindeki satır görünümü: başlık ve
    altında durum, öteki satırlar gibi; düğme simgesiz (genel-bakis.css,
    .gb-satir-dugme).
  */
  satir?: boolean;
}) {
  const t = await ceviri();
  const veri = await etikVerisiOku(await createClient(), projectId);
  const durumAdi = t(ETIK_DURUM_ADI[veri.durum]);
  const etiket = veri.etik ? t({ tr: `Etik kurul · ${durumAdi}`, en: `Ethics · ${durumAdi}` }) : t({ tr: "Etik kurul", en: "Ethics" });
  const tehlike = veri.uyarilar.some((u) => u.ton === "danger");
  const satirNotu = veri.etik ? durumAdi : t({ tr: "Başvurunuzu ve belgelerinizi takip edin", en: "Track your application and documents" });

  return (
    <PanelDrawer
      triggerLabel={satir ? t({ tr: "Etik kurul", en: "Ethics committee" }) : etiket}
      triggerNote={satir ? satirNotu : undefined}
      triggerIcon={satir ? undefined : <ShieldCheck size={15} aria-hidden="true" />}
      triggerClassName={satir ? `gb-satir gb-satir-dugme${tehlike ? " etik-tetik-tehlike" : ""}` : tehlike ? `${triggerClassName} etik-tetik-tehlike` : triggerClassName}
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
