import { Quote } from "lucide-react";
import { kaynakcaAsistaniAcik } from "@/app/actions/ai-kaynakca";
import PanelDrawer from "../_components/panel-drawer";
import CitationCheckForm, { type CheckResult } from "./citation-check-form";
import { sonKaynakcaDenetimi } from "@/app/actions/citation-check";
import { asistanGecmisim } from "@/app/actions/ai-gecmis";
import { kaynakPdfleri } from "@/app/actions/kaynak-pdf";
import { ceviri, tarihler } from "@/lib/dil-sunucu";

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
  triggerLabel,
  triggerClassName = "projects-filter-button button-compact",
}: {
  calisma: { id: string; title: string; university: string | null; citation_style: string };
  sonDenetim: { skor: number | null; tarih: string } | null;
  /** Kaynaklar sayfasında düğme eylemi söylüyor ("Kaynakçamı denetle"). */
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const t = await ceviri();
  const { tarihSaat } = await tarihler();
  const [asistanAcik, onceki, gecmis, pdfler] = await Promise.all([
    kaynakcaAsistaniAcik(),
    sonKaynakcaDenetimi(calisma.id),
    asistanGecmisim("kaynakca", 8, calisma.id),
    kaynakPdfleri(calisma.id),
  ]);
  const ton = sonDenetim?.skor == null ? "neutral" : sonDenetim.skor >= 85 ? "success" : sonDenetim.skor >= 60 ? "warning" : "danger";

  return (
    <PanelDrawer
      triggerLabel={triggerLabel ?? (sonDenetim?.skor != null ? `${t({ tr: "Kaynakça", en: "Reference list" })} · ${sonDenetim.skor}` : t({ tr: "Kaynakça", en: "Reference list" }))}
      triggerIcon={<Quote size={15} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Kaynakça ve atıf doğrulama", en: "Reference list and citation check" })}
      title={t({ tr: "Kaynakçanızı denetleyin", en: "Check your reference list" })}
      description={t({
        tr: "Künyelerin biçimi, metindeki atıflarla eşleşmesi ve kaynakların gerçekten var olup olmadığı (Crossref, OpenAlex) birlikte kontrol edilir.",
        en: "The format of each reference, its match with in-text citations, and whether the source actually exists (Crossref, OpenAlex) are checked together.",
      })}
      boy="tam"
      basaridaKapan={false}
    >
      <p className="kaynakca-son" data-tone={ton}>
        {sonDenetim
          ? t({
              tr: `Son denetim: ${sonDenetim.skor ?? "—"}/100 kaynakça uyumu · ${tarihSaat(sonDenetim.tarih)}`,
              en: `Last check: ${sonDenetim.skor ?? "—"}/100 reference list compliance · ${tarihSaat(sonDenetim.tarih)}`,
            })
          : t({ tr: "Bu çalışma için henüz kaynakça denetimi yapılmadı.", en: "No reference list check has been run for this work yet." })}
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
