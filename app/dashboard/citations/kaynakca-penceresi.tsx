import { Quote } from "lucide-react";
import { kaynakcaAsistaniAcik } from "@/app/actions/ai-kaynakca";
import PanelDrawer from "../_components/panel-drawer";
import CitationCheckForm, { type CheckResult } from "./citation-check-form";
import { sonKaynakcaDenetimi } from "@/app/actions/citation-check";
import { asistanGecmisim } from "@/app/actions/ai-gecmis";
import { kaynakPdfleri } from "@/app/actions/kaynak-pdf";
import { trTarihSaat } from "@/lib/tr-time";

/*
  KAYNAKÇA PENCERESİ (26.10.2026): Çalışmalarım'daki durum kartından,
  kartın çalışması için. Denetim formu Kaynakça sayfasındakinin aynısı
  (CitationCheckForm); burada çalışma ve onun atıf stili hazır seçili,
  seçici çizilmiyor. Son denetimin puanı düğmede ve pencerenin başında:
  öğrenci yeniden denetlemeye gerek olup olmadığını açmadan görüyor.
  "Denetim geçmişi" bağlantısı kaldırıldı: son denetim sonuç kartında,
  asistan yorumlarının geçmişi sol kartta; sayfaya gitmeye gerek yok.

  Puan çalışmanın KENDİ atıf stiline göre; stil adı yazılmıyor (ayrıntı
  lib/calisma-ozeti.ts, kaynakça adımı).
*/
export default async function KaynakcaPenceresi({
  calisma,
  sonDenetim,
}: {
  calisma: { id: string; title: string; university: string | null; citation_style: string };
  sonDenetim: { skor: number | null; tarih: string } | null;
}) {
  const [asistanAcik, onceki, gecmis, pdfler] = await Promise.all([
    kaynakcaAsistaniAcik(),
    sonKaynakcaDenetimi(calisma.id),
    asistanGecmisim("kaynakca", 8, calisma.id),
    kaynakPdfleri(calisma.id),
  ]);
  const ton = sonDenetim?.skor == null ? "neutral" : sonDenetim.skor >= 85 ? "success" : sonDenetim.skor >= 60 ? "warning" : "danger";

  return (
    <PanelDrawer
      triggerLabel={sonDenetim?.skor != null ? `Kaynakça · ${sonDenetim.skor}` : "Kaynakça"}
      triggerIcon={<Quote size={15} aria-hidden="true" />}
      triggerClassName="projects-filter-button button-compact"
      kicker="Kaynakça ve atıf doğrulama"
      title="Kaynakçanızı denetleyin"
      description="Künyelerin biçimi, metindeki atıflarla eşleşmesi ve kaynakların gerçekten var olup olmadığı (Crossref, OpenAlex) birlikte kontrol edilir."
      boy="tam"
      basaridaKapan={false}
    >
      <p className="kaynakca-son" data-tone={ton}>
        {sonDenetim
          ? `Son denetim: ${sonDenetim.skor ?? "—"}/100 kaynakça uyumu · ${trTarihSaat(sonDenetim.tarih)}`
          : "Bu çalışma için henüz kaynakça denetimi yapılmadı."}
      </p>
      <CitationCheckForm
        projects={[calisma]}
        asistanAcik={asistanAcik}
        secilenCalisma={calisma.id}
        gomulu
        oncekiSonuc={onceki as (CheckResult & { tarih: string }) | null}
        asistanGecmisi={gecmis}
        kaynakPdfleri={pdfler}
      />
    </PanelDrawer>
  );
}
