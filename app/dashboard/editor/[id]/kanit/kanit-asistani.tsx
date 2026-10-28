"use client";

import { asistanCagir } from "@/lib/asistan-istemci";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { kanitDegerlendir, type KanitDegerlendirmeYaniti } from "@/app/actions/ai-kanit";
import { DESTEK_ETIKETI_METIN, DESTEK_TONU } from "@/lib/kanit/durum";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import AsistanSonuc from "@/app/dashboard/_components/asistan-sonuc";

/*
  İddia–kanıt uyumunu asistana sordurur. Bağlam istemciden gitmez:
  yalnızca kaydın kimliği gönderilir, metin sunucuda okunur
  (app/actions/ai-kanit.ts). Hüküm kayda işlenince sayfa yenilenir ve
  zincir yeni durumu gösterir.
*/
export default function KanitAsistani({ kanitId, asistanAcik, metinVar }: { kanitId: string; asistanAcik: boolean; metinVar: boolean }) {
  const router = useRouter();
  const t = useCeviri();
  const dil = useDil();
  const [sonuc, setSonuc] = useState<KanitDegerlendirmeYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  function sor(zorla: boolean) {
    basla(async () => {
      setSonuc(null);
      const yanit = await asistanCagir(() => kanitDegerlendir({ kanitId, zorla }), dil);
      setSonuc(yanit);
      if (yanit.duzey) router.refresh();
    });
  }

  if (!asistanAcik) {
    return (
      <p className="asistan-uyari" data-tone="neutral">
        {t({
          tr: "Asistan bu kurulumda kapalı. Değerlendirmeyi kendiniz kaydedebilirsiniz.",
          en: "The assistant is turned off in this installation. You can record the assessment yourself.",
        })}
      </p>
    );
  }

  return (
    <div className="stack-sm mt-sm">
      <div className="cluster">
        <button type="button" className="projects-filter-button button-compact" disabled={!metinVar || bekleniyor} onClick={() => sor(false)}>
          <Sparkles size={14} aria-hidden="true" /> {bekleniyor ? t({ tr: "Karşılaştırılıyor…", en: "Comparing…" }) : t({ tr: "Asistanla karşılaştır", en: "Compare with assistant" })}
        </button>
        {!metinVar && <span className="muted text-sm">{t({ tr: "Önce kaynaktan ilgili metni ekleyin.", en: "First add the relevant text from the source." })}</span>}
      </div>

      {sonuc?.duzey && (
        <div className="asistan-bolum">
          <h4 className="asistan-bolum-baslik">{t({ tr: "Otomatik değerlendirme", en: "Automated assessment" })}</h4>
          <p className="cluster">
            <span className="status-pill" data-tone={DESTEK_TONU[sonuc.duzey]}>{t(DESTEK_ETIKETI_METIN[sonuc.duzey])}</span>
            <span className="muted text-sm">{t({ tr: "Nihai akademik hüküm değildir; kendiniz kontrol edin.", en: "This is not a final academic judgment; check it yourself." })}</span>
          </p>
          {sonuc.alinti && <blockquote className="kanit-alinti">{sonuc.alinti}</blockquote>}
        </div>
      )}
      {sonuc?.uyari && (
        <p className="asistan-uyari" data-tone="danger" role="alert">
          {sonuc.uyari}
        </p>
      )}

      <AsistanSonuc
        sonuc={sonuc}
        yetenek="kanit"
        etiketler={{
          uyari: t({ tr: "Sorun", en: "Issue" }),
          oneri: t({ tr: "Öneri", en: "Suggestion" }),
          bilgi: t({ tr: "Gerekçe", en: "Rationale" }),
        }}
        bulguBasligi={t({ tr: "Gerekçe ve eksikler", en: "Rationale and gaps" })}
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => sor(true)}
      />
    </div>
  );
}
