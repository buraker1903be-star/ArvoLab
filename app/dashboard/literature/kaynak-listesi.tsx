"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import { eksikAlanlar } from "@/lib/citation-format";
import { showToast } from "../_components/toast-events";

/*
  KAYNAKLAR SAYFASINDAKİ LİSTE — İŞLENEBİLİR (27.10.2026, kurum sahibinin
  isteği). Eskiden liste yalnızca gösteriyordu: "Okudum" demek için
  öğrenci Kaynak bul penceresini açıp kaynağı orada arıyordu. Şimdi
  sayfada:
  - arama (başlık, yazar, dergi) ve durum süzgeci, sayılarıyla;
  - satırda TEK düğme: sıradaki adım ("Okudum", "Metinde kullandım"),
    geri almak ikincil (Literatür penceresiyle aynı kural);
  - DOI/adres bağlantısı;
  - EKSİK KÜNYE uyarısı: kaynakçaya girecek bilgisi eksik kaynaklar
    işaretli ve süzülebilir (lib/citation-format eksikAlanlar). Eksiği
    sistem uydurmaz; düzenleme Kaynak bul penceresinde.
*/
type Durum = "to_review" | "read" | "used";
const ETIKET: Record<Durum, { ad: string; ton: string }> = {
  to_review: { ad: "Okunacak", ton: "neutral" },
  read: { ad: "Okundu", ton: "info" },
  used: { ad: "Metinde", ton: "success" },
};
const ILERI: Record<Durum, { durum: Durum; etiket: string } | null> = {
  to_review: { durum: "read", etiket: "Okudum" },
  read: { durum: "used", etiket: "Metinde kullandım" },
  used: null,
};
const GERI: Record<Durum, Durum | null> = { to_review: null, read: "to_review", used: "read" };
type Suzgec = "hepsi" | Durum | "eksik";

const baglanti = (deger: string | null) => {
  const t = deger?.trim();
  if (!t) return null;
  const doi = t.match(/10\.\d{4,9}\/\S+/);
  if (doi && !/^https?:/i.test(t)) return `https://doi.org/${doi[0]}`;
  return /^https?:\/\//i.test(t) ? t : null;
};

export default function KaynakListesi({ kaynaklar }: { kaynaklar: LiteratureSource[] }) {
  const router = useRouter();
  const [arama, setArama] = useState("");
  const [suzgec, setSuzgec] = useState<Suzgec>("hepsi");
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();

  const eksikler = useMemo(() => new Map(kaynaklar.map((k) => [k.id, eksikAlanlar(k)])), [kaynaklar]);
  const sayilar = {
    hepsi: kaynaklar.length,
    to_review: kaynaklar.filter((k) => k.status === "to_review").length,
    read: kaynaklar.filter((k) => k.status === "read").length,
    used: kaynaklar.filter((k) => k.status === "used").length,
    eksik: kaynaklar.filter((k) => (eksikler.get(k.id) ?? []).length).length,
  };
  const terim = arama.trim().toLocaleLowerCase("tr-TR");
  const gorunen = kaynaklar.filter((k) => {
    if (suzgec === "eksik" ? !(eksikler.get(k.id) ?? []).length : suzgec !== "hepsi" && k.status !== suzgec) return false;
    if (!terim) return true;
    return [k.title, k.authors, k.container_title, k.publisher, k.year, k.doi_or_url].some((x) => x?.toLocaleLowerCase("tr-TR").includes(terim));
  });

  const durumDegistir = (k: LiteratureSource, yeni: Durum) => {
    setBekleyen(k.id);
    basla(async () => {
      const sonuc = await updateLiteratureStatus(k.id, yeni);
      setBekleyen(null);
      if (sonuc.error) return showToast("error", sonuc.error);
      router.refresh();
    });
  };

  const SUZGECLER: { kod: Suzgec; ad: string }[] = [
    { kod: "hepsi", ad: "Hepsi" },
    { kod: "to_review", ad: "Okunacak" },
    { kod: "read", ad: "Okundu" },
    { kod: "used", ad: "Metinde" },
    { kod: "eksik", ad: "Eksik künye" },
  ];

  return (
    <>
      <div className="kaynak-suzgec">
        <label className="kaynak-arama">
          <Search size={14} aria-hidden="true" />
          <input type="search" placeholder="Başlık, yazar, dergi, yayınevi ya da DOI ara" value={arama} onChange={(e) => setArama(e.target.value)} aria-label="Kaynaklarda ara" />
        </label>
        <div className="cluster" role="group" aria-label="Duruma göre süz">
          {SUZGECLER.filter((s) => s.kod !== "eksik" || sayilar.eksik).map((s) => (
            <button
              key={s.kod}
              type="button"
              className="projects-filter-button button-compact"
              aria-pressed={suzgec === s.kod}
              onClick={() => setSuzgec(s.kod)}
            >
              {s.ad} <small>{sayilar[s.kod]}</small>
            </button>
          ))}
        </div>
      </div>
      {gorunen.length ? (
        <ul className="gb-liste">
          {gorunen.map((k) => {
            const durum = (k.status in ETIKET ? k.status : "to_review") as Durum;
            const ileri = ILERI[durum];
            const geri = GERI[durum];
            const eksik = eksikler.get(k.id) ?? [];
            const adres = baglanti(k.doi_or_url);
            return (
              <li key={k.id} className="gb-satir kaynak-satiri">
                <span className="gb-satir-govde">
                  <b>{k.title}</b>
                  <small>
                    {[k.authors || "Yazar belirtilmedi", k.year, k.container_title].filter(Boolean).join(" · ")}
                    {adres ? (
                      <>
                        {" · "}
                        <a href={adres} target="_blank" rel="noreferrer noopener">
                          {/10\.\d{4,9}\//.test(k.doi_or_url ?? "") ? "DOI" : "Bağlantı"} <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </>
                    ) : null}
                  </small>
                  {eksik.length ? <small className="kaynak-eksik">Kaynakça için eksik: {eksik.join(", ")}</small> : null}
                </span>
                <span className="kaynak-satiri-eylem">
                  <span className="status-pill" data-tone={ETIKET[durum].ton}>
                    {ETIKET[durum].ad}
                  </span>
                  {ileri ? (
                    <button type="button" className="projects-filter-button button-compact" disabled={bekleyen === k.id} onClick={() => durumDegistir(k, ileri.durum)}>
                      {ileri.etiket}
                    </button>
                  ) : null}
                  {geri ? (
                    <button
                      type="button"
                      className="projects-filter-button button-compact"
                      disabled={bekleyen === k.id}
                      aria-label={`${k.title}: ${ETIKET[geri].ad} durumuna geri al`}
                      title={`${ETIKET[geri].ad} durumuna geri al`}
                      onClick={() => durumDegistir(k, geri)}
                    >
                      ↶
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gb-bos">{terim || suzgec !== "hepsi" ? "Bu aramaya ya da süzgece uyan kaynak yok." : "Bu çalışmaya bağlı kaynak yok."}</p>
      )}
    </>
  );
}
