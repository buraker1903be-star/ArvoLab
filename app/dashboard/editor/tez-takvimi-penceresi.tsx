import { CalendarDays } from "lucide-react";
import PanelDrawer from "../_components/panel-drawer";
import { takvimOzeti, type TakvimTasi } from "@/lib/tez-takvimi";
import TakvimDuzenleyici from "./takvim-duzenleyici";
import { ceviri } from "@/lib/dil-sunucu";

/*
  Takvim penceresi (Çalışmalarım kartının alt şeridinde, kılavuz ve
  literatür pencereleriyle aynı yerde). Düğmede geciken taş varsa sayısı
  yazıyor; öğrenci pencereyi açmadan geride kaldığını görsün.
*/
export default async function TezTakvimiPenceresi({
  projectId,
  projeTuru,
  taslar,
  teslimTarihi,
  bugun,
  duzenleyebilir,
  acikBasla = false,
}: {
  projectId: string;
  projeTuru: string;
  taslar: TakvimTasi[];
  teslimTarihi: string | null;
  bugun: string;
  duzenleyebilir: boolean;
  acikBasla?: boolean;
}) {
  const t = await ceviri();
  const ozet = takvimOzeti(taslar, bugun);
  return (
    <PanelDrawer
      triggerLabel={
        ozet.geciken
          ? t({ tr: `Takvim · ${ozet.geciken} geciken`, en: `Schedule · ${ozet.geciken} overdue` })
          : ozet.toplam
            ? t({ tr: `Takvim · ${ozet.tamam}/${ozet.toplam}`, en: `Schedule · ${ozet.tamam}/${ozet.toplam}` })
            : t({ tr: "Takvim", en: "Schedule" })
      }
      triggerIcon={<CalendarDays size={15} aria-hidden="true" />}
      triggerClassName={ozet.geciken ? "projects-filter-button button-compact takvim-dugme-geciken" : "projects-filter-button button-compact"}
      kicker={t({ tr: "Tez takvimi", en: "Thesis schedule" })}
      title={t({ tr: "Kilometre taşları", en: "Milestones" })}
      description={t({
        tr: "Bölüm bölüm hedef tarihler. Ana sayfa sıradakini gösterir; danışmanınız ve kurumunuz da planı görür.",
        en: "Target dates chapter by chapter. The home page shows the next one; your advisor and institution see the plan too.",
      })}
      boy="orta"
      basaridaKapan={false}
      acikBasla={acikBasla}
    >
      <TakvimDuzenleyici
        projectId={projectId}
        projeTuru={projeTuru}
        taslar={taslar}
        teslimTarihi={teslimTarihi}
        bugun={bugun}
        duzenleyebilir={duzenleyebilir}
      />
    </PanelDrawer>
  );
}
