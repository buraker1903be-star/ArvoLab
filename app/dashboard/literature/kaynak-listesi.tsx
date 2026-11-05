"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { updateLiteratureStatus, type LiteratureSource } from "@/app/actions/literature";
import { eksikAlanlar } from "@/lib/citation-format";
import { sirala } from "@/lib/os/sayfa-standardi";
import { showToast } from "../_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL, type Metin } from "@/lib/dil";
import ListeAraclari from "../_components/sayfa/liste-araclari";
import AyrintiPaneli from "../_components/sayfa/ayrinti-paneli";
import Bolum from "../_components/sayfa/bolum";
import DurumGostergesi, { type DurumTonu } from "../_components/sayfa/durum-gostergesi";
import { SOURCE_TYPE_LABELS } from "./kaynak-parcalari";

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

  Signature OS 4.1 (05.11.2026), ortak liste standardı:
  - Arama · süzgeç · SIRALAMA tek şeritte (ListeAraclari). Sıralama
    yoktu; liste hep "durum, sonra eklenme" sırasındaydı ve elli
    kaynaklık listede yazara ya da yıla göre bakmanın yolu yoktu.
  - Kaynağın ADI bir düğme: kaynak AYRINTISINI (AyrintiPaneli) açar.
    Eskiden cilt, sayı, sayfa, yayınevi, basım yeri ve NOTLAR bu
    sayfada hiç görünmüyordu; görmek için Kaynak bul penceresinde
    kaynağı bulup düzenleme formunu açmak gerekiyordu. Ayrıntı salt
    okunur — künye düzenlemesi yine tek yerde (Kaynak bul).
*/
type Durum = "to_review" | "read" | "used";
const ETIKET: Record<Durum, { ad: Metin; ton: DurumTonu }> = {
  to_review: { ad: { tr: "Okunacak", en: "To read" }, ton: "neutral" },
  read: { ad: { tr: "Okundu", en: "Read" }, ton: "info" },
  used: { ad: { tr: "Metinde", en: "Cited" }, ton: "success" },
};
const ILERI: Record<Durum, { durum: Durum; etiket: Metin } | null> = {
  to_review: { durum: "read", etiket: { tr: "Okudum", en: "I've read it" } },
  read: { durum: "used", etiket: { tr: "Metinde kullandım", en: "I cited it" } },
  used: null,
};
const GERI: Record<Durum, Durum | null> = { to_review: null, read: "to_review", used: "read" };
const DURUM_SIRASI: Durum[] = ["to_review", "read", "used"];
type Suzgec = "hepsi" | Durum | "eksik";
type Siralama = "durum" | "yeni" | "yil" | "baslik" | "yazar";

const baglanti = (deger: string | null) => {
  const temiz = deger?.trim();
  if (!temiz) return null;
  const doi = temiz.match(/10\.\d{4,9}\/\S+/);
  if (doi && !/^https?:/i.test(temiz)) return `https://doi.org/${doi[0]}`;
  return /^https?:\/\//i.test(temiz) ? temiz : null;
};
const durumu = (k: LiteratureSource) => (k.status in ETIKET ? k.status : "to_review") as Durum;

export default function KaynakListesi({ kaynaklar }: { kaynaklar: LiteratureSource[] }) {
  const router = useRouter();
  const t = useCeviri();
  const dil = useDil();
  const [arama, setArama] = useState("");
  const [suzgec, setSuzgec] = useState<Suzgec>("hepsi");
  const [siralama, setSiralama] = useState<Siralama>("durum");
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  /* Panel kapanınca kaynak hemen sökülmüyor: kapanış hareketi bitsin ve
     PanelDrawer odağı açan satıra geri verebilsin (söküm etkisi bunu
     yapamıyor). */
  const [acikId, setAcikId] = useState<string | null>(null);
  const [panelAcik, setPanelAcik] = useState(false);
  const [, basla] = useTransition();

  /* Eksik alan adları arayüzde gösteriliyor: burada `dil` arayüzün dili (lib/citation-format). */
  const eksikler = useMemo(() => new Map(kaynaklar.map((k) => [k.id, eksikAlanlar(k, dil)])), [kaynaklar, dil]);
  const sayilar: Record<Suzgec, number> = {
    hepsi: kaynaklar.length,
    to_review: kaynaklar.filter((k) => k.status === "to_review").length,
    read: kaynaklar.filter((k) => k.status === "read").length,
    used: kaynaklar.filter((k) => k.status === "used").length,
    eksik: kaynaklar.filter((k) => (eksikler.get(k.id) ?? []).length).length,
  };
  const terim = arama.trim().toLocaleLowerCase(YEREL[dil]);
  const suzulen = kaynaklar.filter((k) => {
    if (suzgec === "eksik" ? !(eksikler.get(k.id) ?? []).length : suzgec !== "hepsi" && k.status !== suzgec) return false;
    if (!terim) return true;
    return [k.title, k.authors, k.container_title, k.publisher, k.year, k.doi_or_url].some((x) => x?.toLocaleLowerCase(YEREL[dil]).includes(terim));
  });
  const yerel = YEREL[dil];
  const gorunen =
    siralama === "durum"
      ? sirala(suzulen, (k) => DURUM_SIRASI.indexOf(durumu(k)), "artan", yerel)
      : siralama === "yeni"
        ? sirala(suzulen, (k) => k.created_at, "azalan", yerel)
        : siralama === "yil"
          ? sirala(suzulen, (k) => Number.parseInt(k.year ?? "", 10), "azalan", yerel)
          : siralama === "baslik"
            ? sirala(suzulen, (k) => k.title, "artan", yerel)
            : sirala(suzulen, (k) => k.authors, "artan", yerel);
  const acik = kaynaklar.find((k) => k.id === acikId) ?? null;

  const durumDegistir = (k: LiteratureSource, yeni: Durum) => {
    setBekleyen(k.id);
    basla(async () => {
      const sonuc = await updateLiteratureStatus(k.id, yeni);
      setBekleyen(null);
      if (sonuc.error) return showToast("error", sonuc.error);
      router.refresh();
    });
  };

  /* Satırda ve ayrıntıda AYNI iki düğme: sıradaki adım ve geri al. */
  const durumDugmeleri = (k: LiteratureSource, tamEtiket = false) => {
    const durum = durumu(k);
    const ileri = ILERI[durum];
    const geri = GERI[durum];
    return (
      <>
        {ileri ? (
          <button type="button" className="projects-filter-button button-compact" disabled={bekleyen === k.id} onClick={() => durumDegistir(k, ileri.durum)}>
            {t(ileri.etiket)}
          </button>
        ) : null}
        {geri ? (
          <button
            type="button"
            className="projects-filter-button button-compact"
            disabled={bekleyen === k.id}
            aria-label={t({ tr: `${k.title}: ${ETIKET[geri].ad.tr} durumuna geri al`, en: `${k.title}: move back to “${ETIKET[geri].ad.en}”` })}
            title={t({ tr: `${ETIKET[geri].ad.tr} durumuna geri al`, en: `Move back to “${ETIKET[geri].ad.en}”` })}
            onClick={() => durumDegistir(k, geri)}
          >
            {tamEtiket ? t({ tr: `↶ ${ETIKET[geri].ad.tr} durumuna geri al`, en: `↶ Back to “${ETIKET[geri].ad.en}”` }) : "↶"}
          </button>
        ) : null}
      </>
    );
  };

  return (
    <>
      <ListeAraclari<Suzgec, Siralama>
        arama={arama}
        onArama={setArama}
        aramaEtiketi={t({ tr: "Kaynaklarda ara", en: "Search sources" })}
        aramaIpucu={t({ tr: "Başlık, yazar, dergi, yayınevi ya da DOI ara", en: "Search by title, author, journal, publisher or DOI" })}
        suzgecler={[
          { kod: "hepsi", ad: t({ tr: "Hepsi", en: "All" }), sayi: sayilar.hepsi, herZaman: true },
          { kod: "to_review", ad: t(ETIKET.to_review.ad), sayi: sayilar.to_review, herZaman: true },
          { kod: "read", ad: t(ETIKET.read.ad), sayi: sayilar.read, herZaman: true },
          { kod: "used", ad: t(ETIKET.used.ad), sayi: sayilar.used, herZaman: true },
          { kod: "eksik", ad: t({ tr: "Eksik künye", en: "Incomplete reference" }), sayi: sayilar.eksik },
        ]}
        secili={suzgec}
        onSuzgec={setSuzgec}
        siralamalar={[
          { kod: "durum", ad: t({ tr: "Okuma durumu", en: "Reading status" }) },
          { kod: "yeni", ad: t({ tr: "Son eklenen", en: "Recently added" }) },
          { kod: "yil", ad: t({ tr: "Yıl (yeni → eski)", en: "Year (newest first)" }) },
          { kod: "yazar", ad: t({ tr: "Yazar (A–Z)", en: "Author (A–Z)" }) },
          { kod: "baslik", ad: t({ tr: "Başlık (A–Z)", en: "Title (A–Z)" }) },
        ]}
        sira={siralama}
        onSira={setSiralama}
      />
      {gorunen.length ? (
        <ul className="gb-liste">
          {gorunen.map((k) => {
            const durum = durumu(k);
            const eksik = eksikler.get(k.id) ?? [];
            const adres = baglanti(k.doi_or_url);
            return (
              <li key={k.id} className="gb-satir kaynak-satiri">
                <span className="gb-satir-govde">
                  <button type="button" className="kaynak-ad" aria-haspopup="dialog" onClick={() => {
                      setAcikId(k.id);
                      setPanelAcik(true);
                    }}>
                    {k.title}
                  </button>
                  <small>
                    {[k.authors || t({ tr: "Yazar belirtilmedi", en: "No author given" }), k.year, k.container_title].filter(Boolean).join(" · ")}
                    {adres ? (
                      <>
                        {" · "}
                        <a href={adres} target="_blank" rel="noreferrer noopener">
                          {/10\.\d{4,9}\//.test(k.doi_or_url ?? "") ? "DOI" : t({ tr: "Bağlantı", en: "Link" })} <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </>
                    ) : null}
                  </small>
                  {eksik.length ? <small className="kaynak-eksik">{t({ tr: "Kaynakça için eksik:", en: "Missing for the reference list:" })} {eksik.join(", ")}</small> : null}
                </span>
                <span className="kaynak-satiri-eylem">
                  <DurumGostergesi ton={ETIKET[durum].ton} ne={t({ tr: "Okuma durumu", en: "Reading status" })}>
                    {t(ETIKET[durum].ad)}
                  </DurumGostergesi>
                  {durumDugmeleri(k)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gb-bos">{terim || suzgec !== "hepsi" ? t({ tr: "Bu aramaya ya da süzgece uyan kaynak yok.", en: "No sources match this search or filter." }) : t({ tr: "Bu çalışmaya bağlı kaynak yok.", en: "No sources linked to this work." })}</p>
      )}

      {acik ? (
        <KaynakAyrintisi
          kaynak={acik}
          eksik={eksikler.get(acik.id) ?? []}
          durumDugmeleri={durumDugmeleri(acik, true)}
          acik={panelAcik}
          onKapat={() => setPanelAcik(false)}
        />
      ) : null}
    </>
  );
}

/*
  Kaynak ayrıntısı. Yalnızca kayıtta OLAN alanlar yazılır; boş alanın
  yerine "—" dizmek yerine eksik olanlar tek satırda, kaynakçanın neye
  ihtiyaç duyduğuyla birlikte söylenir (eksikAlanlar, liste ile aynı).
*/
function KaynakAyrintisi({
  kaynak: k,
  eksik,
  durumDugmeleri,
  acik,
  onKapat,
}: {
  kaynak: LiteratureSource;
  eksik: string[];
  durumDugmeleri: ReactNode;
  acik: boolean;
  onKapat: () => void;
}) {
  const t = useCeviri();
  const durum = durumu(k);
  const adres = baglanti(k.doi_or_url);
  const ciltSayi = [k.volume ? t({ tr: `Cilt ${k.volume}`, en: `Vol. ${k.volume}` }) : null, k.issue ? t({ tr: `Sayı ${k.issue}`, en: `No. ${k.issue}` }) : null].filter(Boolean).join(", ");
  const alanlar: { ad: string; deger: ReactNode }[] = [
    { ad: t({ tr: "Tür", en: "Type" }), deger: SOURCE_TYPE_LABELS[k.source_type] ? t(SOURCE_TYPE_LABELS[k.source_type]) : k.source_type },
    { ad: t({ tr: "Yazarlar", en: "Authors" }), deger: k.authors },
    { ad: t({ tr: "Yıl", en: "Year" }), deger: k.year },
    { ad: k.source_type === "chapter" ? t({ tr: "Kitap", en: "Book" }) : t({ tr: "Dergi / yayın", en: "Journal / publication" }), deger: k.container_title },
    { ad: t({ tr: "Cilt ve sayı", en: "Volume and issue" }), deger: ciltSayi || null },
    { ad: t({ tr: "Sayfalar", en: "Pages" }), deger: k.pages },
    { ad: t({ tr: "Yayınevi", en: "Publisher" }), deger: k.publisher },
    { ad: t({ tr: "Basım yeri", en: "Place of publication" }), deger: k.publication_place },
    {
      ad: /10\.\d{4,9}\//.test(k.doi_or_url ?? "") ? "DOI" : t({ tr: "Bağlantı", en: "Link" }),
      deger: adres ? (
        <a href={adres} target="_blank" rel="noreferrer noopener">
          {k.doi_or_url} <ExternalLink size={11} aria-hidden="true" />
        </a>
      ) : (
        k.doi_or_url
      ),
    },
  ].filter((a) => a.deger);

  return (
    <AyrintiPaneli
      acik={acik}
      onKapat={onKapat}
      ust={t({ tr: "Kaynak", en: "Source" })}
      baslik={k.title}
      aciklama={[k.authors, k.year].filter(Boolean).join(" · ") || undefined}
    >
      <div className="ayrinti-govde">
        <Bolum id={`kaynak-${k.id}-durum`} baslik={t({ tr: "Okuma durumu", en: "Reading status" })}>
          <div className="ayrinti-eylemler">
            <DurumGostergesi ton={ETIKET[durum].ton}>{t(ETIKET[durum].ad)}</DurumGostergesi>
            {durumDugmeleri}
          </div>
        </Bolum>
        <Bolum
          id={`kaynak-${k.id}-kunye`}
          baslik={t({ tr: "Künye", en: "Reference details" })}
          aciklama={t({ tr: "Düzenlemek için “Kaynak bul” penceresinde kaynağı açın.", en: "To edit, open the source in the “Find sources” window." })}
        >
          <dl className="ayrinti-alanlar">
            {alanlar.map((a) => (
              <div key={a.ad}>
                <dt>{a.ad}</dt>
                <dd>{a.deger}</dd>
              </div>
            ))}
          </dl>
          {eksik.length ? (
            <p className="kaynak-eksik">
              {t({ tr: "Kaynakça için eksik:", en: "Missing for the reference list:" })} {eksik.join(", ")}
            </p>
          ) : null}
        </Bolum>
        <Bolum id={`kaynak-${k.id}-not`} baslik={t({ tr: "Notlarım", en: "My notes" })}>
          <p className={k.notes?.trim() ? "ayrinti-not" : "muted text-sm"}>{k.notes?.trim() || t({ tr: "Bu kaynağa not eklenmemiş.", en: "No notes for this source." })}</p>
        </Bolum>
      </div>
    </AyrintiPaneli>
  );
}
