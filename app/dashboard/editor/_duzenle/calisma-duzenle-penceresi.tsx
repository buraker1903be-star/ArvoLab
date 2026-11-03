"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import { calismaDuzenlemeVerisi } from "@/app/actions/projects";
import { useCeviri } from "@/app/_components/dil-saglayici";
import CalismaDuzenleFormu, { type CalismaDuzenlemeVerisi } from "./calisma-duzenle-formu";

/*
  "BİLGİLERİ DÜZENLE" PENCERESİ (03.11.2026). Eskiden kart menüsündeki
  bağlantı ayrı bir sayfaya gidiyordu; kaydedip geri dönmek iki sayfa
  yüklemesiydi ve öğrenci Çalışmalarım'daki yerini kaybediyordu.

  Veri pencere AÇILINCA istenir (calismaDuzenlemeVerisi): sayfadaki her
  kart için önceden okumak gereksiz yüktü. Her açılışta yeniden istenir —
  kayıttan sonra pencere yeniden açıldığında eski değerler görünmesin.
*/
export default function CalismaDuzenlePenceresi({ projectId, baslik }: { projectId: string; baslik: string }) {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const [veri, setVeri] = useState<CalismaDuzenlemeVerisi | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const ac = async () => {
    setAcik(true);
    setVeri(null);
    setHata(null);
    try {
      const cevap = await calismaDuzenlemeVerisi(projectId);
      if ("error" in cevap) setHata(cevap.error);
      else setVeri(cevap.veri);
    } catch (err) {
      console.error(err);
      setHata(t({ tr: "Çalışma yüklenemedi; tekrar deneyin.", en: "The work could not be loaded; try again." }));
    }
  };

  return (
    <>
      <button type="button" onClick={() => void ac()} aria-haspopup="dialog" aria-expanded={acik}>
        <Pencil size={15} aria-hidden="true" />
        {t({ tr: "Bilgileri düzenle", en: "Edit details" })}
      </button>
      <PanelDrawer
        tetiksiz
        acik={acik}
        onAcikDegis={setAcik}
        boy="genis"
        triggerLabel=""
        kicker={t({ tr: "Çalışma bilgileri", en: "Work details" })}
        title={baslik}
        description={t({
          tr: "Çalışmanın planlama bilgilerini, durumunu ve ilerlemesini güncelleyin.",
          en: "Update the work's planning details, status and progress.",
        })}
      >
        {hata ? (
          <p className="alert" data-tone="danger" role="alert">
            {hata}
          </p>
        ) : veri ? (
          <CalismaDuzenleFormu
            veri={veri}
            iptal={
              <button type="button" className="projects-filter-button" onClick={() => setAcik(false)}>
                {t({ tr: "Vazgeç", en: "Cancel" })}
              </button>
            }
          />
        ) : (
          <p className="muted" role="status">
            {t({ tr: "Yükleniyor…", en: "Loading…" })}
          </p>
        )}
      </PanelDrawer>
    </>
  );
}
