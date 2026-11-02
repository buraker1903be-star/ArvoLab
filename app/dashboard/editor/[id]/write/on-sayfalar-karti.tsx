"use client";

import { useState } from "react";
import { BookOpenCheck, Check, Circle, Plus } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import { ON_SAYFALAR, mevcutOnSayfalar, type OnSayfaKimligi } from "@/lib/on-sayfalar";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  ÖN SAYFALAR KUTUSU (02.11.2026). Tezin ön sayfaları (iç kapak, onay,
  yemin metni, özet, abstract, kısaltmalar) yerlerine eklenir; içerik
  değil yapı ve yer tutucular (lib/on-sayfalar.ts). Hangisinin var olduğu
  pencere AÇILIRKEN belgeden okunur: kutu her tuşta belgeyi taramasın.
*/
export default function OnSayfalarKarti({
  belge,
  calismaBasligi,
  onEkle,
}: {
  /** Editörün o anki belgesi (JSON) */
  belge: () => { content?: unknown[] } | null;
  calismaBasligi?: string;
  onEkle: (idler: OnSayfaKimligi[]) => void;
}) {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const [mevcut, setMevcut] = useState<Set<OnSayfaKimligi>>(new Set());
  const eksik = ON_SAYFALAR.filter((s) => !mevcut.has(s.id)).map((s) => s.id);
  const ekle = (idler: OnSayfaKimligi[]) => {
    setAcik(false);
    onEkle(idler);
  };

  return (
    <>
      <YanKutu
        ikon={BookOpenCheck}
        baslik={t({ tr: "Ön sayfalar", en: "Front matter" })}
        deger={t({ tr: "Ekle", en: "Add" })}
        alt={t({ tr: "iç kapak, onay, yemin, özet", en: "title page, approval, declaration, abstract" })}
        onClick={() => {
          setMevcut(mevcutOnSayfalar(belge() as Parameters<typeof mevcutOnSayfalar>[0], calismaBasligi));
          setAcik(true);
        }}
      />
      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Tez", en: "Thesis" })}
        title={t({ tr: "Ön sayfalar", en: "Front matter" })}
        description={t({
          tr: "Eksik olan sayfa yerine eklenir: başlığı, kapak bilgilerinizden doldurulan alanlar ve sizin dolduracağınız [ … ] yerleri. Resmî metinler (yemin metni, onay formu) kurumunuzun kılavuzundan yazılır; ArvoLab uydurmaz. İçindekiler ve tablo/şekil listeleri çıktıda kendiliğinden oluşur.",
          en: "A missing page is inserted in its place: its heading, fields filled from your cover details and [ … ] places for you to fill in. Official texts (declaration, approval form) come from your institution's guideline; ArvoLab does not invent them. The table of contents and lists of tables/figures are generated in the export.",
        })}
      >
        <div className="stack">
          <ul className="outline-sections">
            {ON_SAYFALAR.map((s) => (
              <li key={s.id} data-found={mevcut.has(s.id) ? "true" : "false"}>
                {mevcut.has(s.id) ? (
                  <button type="button" disabled>
                    <Check size={14} aria-hidden="true" />
                    <span>{t(s.ad)}</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => ekle([s.id])} title={t(s.aciklama)}>
                    <Circle size={14} aria-hidden="true" />
                    <span>{t(s.ad)}</span>
                    <Plus size={14} aria-hidden="true" className="outline-add" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {eksik.length > 1 ? (
            <button type="button" className="projects-primary-button outline-action" onClick={() => ekle(eksik)}>
              <Plus size={15} aria-hidden="true" />
              {t({ tr: `Eksik ${eksik.length} sayfayı ekle`, en: `Add ${eksik.length} missing pages` })}
            </button>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
