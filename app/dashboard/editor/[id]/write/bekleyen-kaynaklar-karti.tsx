"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { authorLabel } from "@/lib/citation-format";
import { bekleyenKaynaklar } from "@/lib/bekleyen-kaynaklar";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Dil } from "@/lib/dil";

/*
  Sağ paneldeki "Kullanılmayı bekleyen kaynaklar" kartı (26.10.2026).
  Çalışmaya eklenmiş ama metinde atıf yapılmamış kaynaklar; pencereden
  tek tıkla atıf eklenir (editörün atıf akışı, handleCite). Neyin
  "kullanılmış" sayıldığı lib/bekleyen-kaynaklar.ts'te.

  Kaynaklar okunamazsa sayı yazılmıyor: "0 kaynak bekliyor" bilinmeyeni
  temiz rapor gibi göstermek olurdu.
*/
export default function BekleyenKaynaklarKarti({
  projectId,
  govdeMetni,
  numarali,
  belgeDili = "tr",
  onCite,
}: {
  projectId: string;
  /** Kaynakça bölümü hariç metin. */
  govdeMetni: string;
  numarali: boolean;
  /** Belgenin dili: yazar etiketi ("vd." / "et al.") atıfla aynı dilde görünsün. */
  belgeDili?: Dil;
  onCite: (source: LiteratureSource) => void;
}) {
  const t = useCeviri();
  const [kaynaklar, setKaynaklar] = useState<LiteratureSource[] | null>(null);
  const [okunamadi, setOkunamadi] = useState(false);
  const [acik, setAcik] = useState(false);
  const [surum, setSurum] = useState(0);

  useEffect(() => {
    let iptal = false;
    /* Sunucu eylemi hata fırlatırsa da "okunamadı": yakalanmazsa kart
       sonsuza dek "Yükleniyor…" diyordu. */
    getLiteratureSources()
      .then((sonuc) => {
        if (iptal) return;
        setOkunamadi(sonuc.okunamadi);
        setKaynaklar(sonuc.okunamadi ? null : sonuc.satirlar.filter((s) => s.project_id === projectId));
      })
      .catch(() => {
        if (!iptal) setOkunamadi(true);
      });
    return () => {
      iptal = true;
    };
  }, [projectId, surum]);

  const bekleyen = useMemo(
    () => (kaynaklar ? bekleyenKaynaklar(kaynaklar, govdeMetni, numarali) : null),
    [kaynaklar, govdeMetni, numarali],
  );

  return (
    <>
      <YanKutu
        ikon={BookOpenCheck}
        baslik={t({ tr: "Kaynaklar", en: "Sources" })}
        deger={bekleyen ? bekleyen.length : okunamadi ? "—" : "…"}
        alt={
          bekleyen === null
            ? okunamadi
              ? t({ tr: "okunamadı", en: "could not be read" })
              : t({ tr: "yükleniyor", en: "loading" })
            : bekleyen.length
              ? t({ tr: "atıf bekliyor", en: "awaiting citation" })
              : kaynaklar?.length
                ? t({ tr: "hepsine atıf var", en: "all cited" })
                : t({ tr: "kaynak eklenmedi", en: "no sources added" })
        }
        ton={bekleyen && bekleyen.length ? "warning" : undefined}
        onClick={() => {
          setSurum((s) => s + 1);
          setAcik(true);
        }}
      />

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Kaynaklar", en: "Sources" })}
        title={t({ tr: "Kullanılmayı bekleyen kaynaklar", en: "Sources awaiting citation" })}
        description={t({
          tr: "Çalışmaya eklediğiniz ama metinde atıf yapmadığınız kaynaklar. İmleci atıfın gireceği yere koyup “Atıf ekle”ye basın.",
          en: "Sources you added to this work but have not cited in the text. Place the cursor where the citation should go and click “Cite”.",
        })}
      >
        {bekleyen?.length ? (
          <ul className="bekleyen-kaynaklar">
            {bekleyen.map((k) => (
              <li key={k.id}>
                <span>
                  <b>
                    {authorLabel(k, belgeDili)}
                    {k.year ? ` (${k.year})` : ""}
                  </b>
                  <small>{k.title}</small>
                </span>
                <button
                  type="button"
                  className="projects-filter-button button-compact"
                  onClick={() => {
                    setAcik(false);
                    onCite(k);
                  }}
                >
                  {t({ tr: "Atıf ekle", en: "Cite" })}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">
            {bekleyen === null
              ? okunamadi
                ? t({ tr: "Kaynaklar şu an okunamadı; biraz sonra tekrar deneyin.", en: "Sources could not be read right now; try again shortly." })
                : t({ tr: "Yükleniyor…", en: "Loading…" })
              : kaynaklar?.length
                ? t({ tr: "Eklediğiniz bütün kaynaklara atıf yapılmış.", en: "All the sources you added have been cited." })
                : t({ tr: "Bu çalışmaya henüz kaynak eklenmedi.", en: "No sources have been added to this work yet." })}
          </p>
        )}
        <Link href="/dashboard/literature" className="muted text-sm">
          {t({ tr: "Kaynakları yönet →", en: "Manage sources →" })}
        </Link>
      </Dialog>
    </>
  );
}
