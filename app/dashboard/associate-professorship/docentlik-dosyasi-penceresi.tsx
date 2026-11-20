"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { yeniCalisma } from "@/app/actions/projects";
import PanelDrawer from "../_components/panel-drawer";

/*
  DOÇENTLİK DOSYASI OLUŞTURMA (20.11.2026, PR #113). Ortak "Yeni çalışma"
  penceresi herkes için üç seçenekli kaldı (tez, makale, proje); doçentlik
  dosyası türü Türkiye'ye ve personele özgü olduğu için yeri burası,
  doçentlik modülü. Eskiden bu tür yalnızca personelin üniversite seçtiren
  tam formundaydı; o form kalkınca oluşturma yolu da kalkmıştı.

  Modül Türkçe (ÜAK'ın kavramları), metinler bilerek tek dilli; modül
  İngilizce arayüzde gizli (lib/os/uygulamalar.ts, YALNIZ_TURKCE). Tür
  sunucuda da denetleniyor: personel olmayan bu türü açamaz (calismaKaydet).
*/
export default function DocentlikDosyasiPenceresi() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleniyor, basla] = useTransition();
  const [surum, setSurum] = useState(0);

  const gonder = (formData: FormData) => {
    setHata(null);
    basla(async () => {
      const sonuc = await yeniCalisma(formData);
      if (sonuc.error || !sonuc.id) {
        setHata(sonuc.error ?? "Doçentlik dosyası oluşturulamadı; tekrar deneyin.");
        return;
      }
      router.push(`/dashboard/editor/${encodeURIComponent(sonuc.id)}/write`);
    });
  };

  return (
    <PanelDrawer
      triggerLabel="Doçentlik dosyası oluştur"
      triggerIcon={<FilePlus2 size={16} aria-hidden="true" />}
      triggerClassName="projects-filter-button"
      kicker="Doçentlik"
      title="Yeni doçentlik dosyası"
      description="Başvuru dosyanızı editörde hazırlayın. Dosya kişisel Çalışmalarım listenizde görünür; puanlama bu sayfada kalır."
      basaridaKapan={false}
      acik={acik}
      onAcikDegis={(deger) => {
        setAcik(deger);
        if (!deger) {
          setHata(null);
          setSurum((s) => s + 1);
        }
      }}
    >
      <form action={gonder} className="project-form-grid" key={surum}>
        <label className="project-form-full">
          <span>Dosyanın adı</span>
          <input name="title" type="text" placeholder="Örn. Doçentlik başvuru dosyası — 2027 Mart dönemi" minLength={3} maxLength={240} required autoFocus />
        </label>
        <input type="hidden" name="type" value="associate-professorship" />
        <input type="hidden" name="belgeDili" value="tr" />
        <input type="hidden" name="citationStyle" value="apa7" />
        {hata ? (
          <p className="alert project-form-full" data-tone="danger" role="alert">
            {hata}
          </p>
        ) : null}
        <div className="pencere-dugmeler project-form-full">
          <button type="submit" className="projects-primary-button" disabled={bekleniyor}>
            <FilePlus2 size={16} aria-hidden="true" />
            {bekleniyor ? "Oluşturuluyor…" : "Oluştur ve yaz"}
          </button>
        </div>
      </form>
    </PanelDrawer>
  );
}
