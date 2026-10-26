"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { kanitDegerlendir, type KanitDegerlendirmeYaniti } from "@/app/actions/ai-kanit";
import { DESTEK_ETIKETI, DESTEK_TONU } from "@/lib/kanit/durum";
import AsistanSonuc from "@/app/dashboard/_components/asistan-sonuc";

/*
  İddia–kanıt uyumunu asistana sordurur. Bağlam istemciden gitmez:
  yalnızca kaydın kimliği gönderilir, metin sunucuda okunur
  (app/actions/ai-kanit.ts). Hüküm kayda işlenince sayfa yenilenir ve
  zincir yeni durumu gösterir.
*/
export default function KanitAsistani({ kanitId, asistanAcik, metinVar }: { kanitId: string; asistanAcik: boolean; metinVar: boolean }) {
  const router = useRouter();
  const [sonuc, setSonuc] = useState<KanitDegerlendirmeYaniti | null>(null);
  const [bekleniyor, basla] = useTransition();

  function sor(zorla: boolean) {
    basla(async () => {
      setSonuc(null);
      const yanit = await kanitDegerlendir({ kanitId, zorla });
      setSonuc(yanit);
      if (yanit.duzey) router.refresh();
    });
  }

  if (!asistanAcik) {
    return (
      <p className="asistan-uyari" data-tone="neutral">
        Asistan bu kurulumda kapalı. Değerlendirmeyi kendiniz kaydedebilirsiniz.
      </p>
    );
  }

  return (
    <div className="stack-sm mt-sm">
      <div className="cluster">
        <button type="button" className="projects-filter-button button-compact" disabled={!metinVar || bekleniyor} onClick={() => sor(false)}>
          <Sparkles size={14} aria-hidden="true" /> {bekleniyor ? "Karşılaştırılıyor…" : "Asistanla karşılaştır"}
        </button>
        {!metinVar && <span className="muted text-sm">Önce kaynaktan ilgili metni ekleyin.</span>}
      </div>

      {sonuc?.duzey && (
        <div className="asistan-bolum">
          <h4 className="asistan-bolum-baslik">Otomatik değerlendirme</h4>
          <p className="cluster">
            <span className="status-pill" data-tone={DESTEK_TONU[sonuc.duzey]}>{DESTEK_ETIKETI[sonuc.duzey]}</span>
            <span className="muted text-sm">Nihai akademik hüküm değildir; kendiniz kontrol edin.</span>
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
        etiketler={{ uyari: "Sorun", oneri: "Öneri", bilgi: "Gerekçe" }}
        bulguBasligi="Gerekçe ve eksikler"
        bekleniyor={bekleniyor}
        onYenidenSorgula={() => sor(true)}
      />
    </div>
  );
}
