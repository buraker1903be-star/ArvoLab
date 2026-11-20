import { Quote } from "lucide-react";
import { kaynakcaAsistaniAcik } from "@/app/actions/ai-kaynakca";
import PanelDrawer from "../_components/panel-drawer";
import CitationCheckForm, { type CheckResult } from "./citation-check-form";
import { sonKaynakcaDenetimi } from "@/app/actions/citation-check";
import { asistanGecmisim } from "@/app/actions/ai-gecmis";
import { kaynakPdfleri } from "@/app/actions/kaynak-pdf";
import { ceviri, tarihler } from "@/lib/dil-sunucu";
import { kaynakcaOzeti } from "@/lib/kaynakca-ozeti";

/*
  KAYNAKÇA PENCERESİ (26.10.2026): Çalışmalarım'daki durum kartından,
  kartın çalışması için. Denetim formu Kaynakça sayfasındakinin aynısı
  (CitationCheckForm); burada çalışma ve onun atıf stili hazır seçili,
  seçici çizilmiyor. Son denetimin tarihi ve açık sorun sayısı pencerenin
  başında (20.11.2026'ya kadar düğmede "%puan" vardı).
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
  /* Yalnızca tarih kullanılıyor; açık sorun sayısı pencerenin kendi okuduğu son
     denetimden hesaplanır. `skor` eski çağıranlar için kabul edilir, GÖSTERİLMEZ. */
  sonDenetim: { tarih: string; skor?: number | null; acikSorun?: number | null } | null;
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
  /* "uyum /100" yerine açık sorun (20.11.2026, lib/kaynakca-ozeti.ts): puan biçim
     uyarılarını saymıyor ve genel uygunluk onayı gibi okunuyordu. */
  const ozet = onceki ? kaynakcaOzeti(onceki) : null;
  const ton = ozet ? ozet.ton : "neutral";

  return (
    <PanelDrawer
      triggerLabel={triggerLabel ?? t({ tr: "Kaynakça", en: "Reference list" })}
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
      {/* Son denetim kayıtlıysa tarihi ve puanı sonuç kartında yazıyor;
          bu şerit eskiden aynı bilgiyi ikinci kez veriyordu. */}
      {onceki ? null : (
        <p className="kaynakca-son" data-tone={ton}>
          {sonDenetim
            ? t({
                tr: `Son denetim ${tarihSaat(sonDenetim.tarih)}${ozet ? ` · ${ozet.kunye} künye, ${ozet.acikSorun} açık sorun` : ""}`,
                en: `Last check ${tarihSaat(sonDenetim.tarih)}${ozet ? ` · ${ozet.kunye} references, ${ozet.acikSorun} open ${ozet.acikSorun === 1 ? "issue" : "issues"}` : ""}`,
              })
            : t({ tr: "Bu çalışma için henüz kaynakça denetimi yapılmadı.", en: "No reference list check has been run for this work yet." })}
        </p>
      )}
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
