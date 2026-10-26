"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { getLiteratureSources, type LiteratureSource } from "@/app/actions/literature";
import { authorLabel } from "@/lib/citation-format";
import { bekleyenKaynaklar } from "@/lib/bekleyen-kaynaklar";

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
  onCite,
}: {
  projectId: string;
  /** Kaynakça bölümü hariç metin. */
  govdeMetni: string;
  numarali: boolean;
  onCite: (source: LiteratureSource) => void;
}) {
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
    <section className="outline-card">
      <header className="outline-head">
        <strong>
          <BookOpenCheck size={15} aria-hidden="true" /> Bekleyen kaynaklar
        </strong>
        {bekleyen ? <span className="muted text-sm">{bekleyen.length}</span> : null}
      </header>
      {bekleyen === null ? (
        <p className="muted text-sm">{okunamadi ? "Kaynaklar şu an okunamadı." : "Yükleniyor…"}</p>
      ) : bekleyen.length ? (
        <>
          <p className="muted text-sm">Çalışmaya eklediğiniz {bekleyen.length} kaynağa metinde henüz atıf yok.</p>
          <button
            type="button"
            className="projects-filter-button outline-action"
            onClick={() => {
              setSurum((s) => s + 1);
              setAcik(true);
            }}
          >
            Listeyi aç
          </button>
        </>
      ) : (
        <p className="muted text-sm">
          {kaynaklar?.length ? "Eklediğiniz bütün kaynaklara atıf yapılmış." : "Bu çalışmaya henüz kaynak eklenmedi."}
        </p>
      )}

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker="Kaynaklar"
        title="Kullanılmayı bekleyen kaynaklar"
        description="Çalışmaya eklediğiniz ama metinde atıf yapmadığınız kaynaklar. İmleci atıfın gireceği yere koyup “Atıf ekle”ye basın."
      >
        {bekleyen?.length ? (
          <ul className="bekleyen-kaynaklar">
            {bekleyen.map((k) => (
              <li key={k.id}>
                <span>
                  <b>
                    {authorLabel(k)}
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
                  Atıf ekle
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">Bekleyen kaynak yok.</p>
        )}
        <Link href="/dashboard/literature" className="muted text-sm">
          Kaynakları yönet →
        </Link>
      </Dialog>
    </section>
  );
}
