import { CalendarDays } from "lucide-react";
import PanelDrawer from "../_components/panel-drawer";
import { takvimOzeti, type TakvimTasi } from "@/lib/tez-takvimi";
import TakvimDuzenleyici from "./takvim-duzenleyici";

/*
  Takvim penceresi (Çalışmalarım kartının alt şeridinde, kılavuz ve
  literatür pencereleriyle aynı yerde). Düğmede geciken taş varsa sayısı
  yazıyor; öğrenci pencereyi açmadan geride kaldığını görsün.
*/
export default function TezTakvimiPenceresi({
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
  const ozet = takvimOzeti(taslar, bugun);
  return (
    <PanelDrawer
      triggerLabel={ozet.geciken ? `Takvim · ${ozet.geciken} geciken` : ozet.toplam ? `Takvim · ${ozet.tamam}/${ozet.toplam}` : "Takvim"}
      triggerIcon={<CalendarDays size={15} aria-hidden="true" />}
      triggerClassName={ozet.geciken ? "projects-filter-button button-compact takvim-dugme-geciken" : "projects-filter-button button-compact"}
      kicker="Tez takvimi"
      title="Kilometre taşları"
      description="Bölüm bölüm hedef tarihler. Ana sayfa sıradakini gösterir; danışmanınız ve kurumunuz da planı görür."
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
