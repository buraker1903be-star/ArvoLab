"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, SearchCheck, Trash2 } from "lucide-react";
import {
  deleteLiteratureSource,
  kaynakKunyesiniKarsilastir,
  updateLiteratureSource,
  updateLiteratureStatus,
  type LiteratureSource,
} from "@/app/actions/literature";
import { eksikAlanlar } from "@/lib/citation-format";
import { sirala } from "@/lib/os/sayfa-standardi";
import { olasiTekrarlar, type KaynakBaglami } from "@/lib/kaynak-kutuphanesi";
import { alanEtiketi, kunyeOzeti, type AlanSonucu } from "@/lib/kanit/kunye-karsilastirma";
import type { DogrulamaSonucu } from "@/lib/kanit/dizin";
import { showToast } from "../_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL, type Metin } from "@/lib/dil";
import ActionForm from "../action-form";
import ListeAraclari from "../_components/sayfa/liste-araclari";
import AyrintiPaneli from "../_components/sayfa/ayrinti-paneli";
import Bolum from "../_components/sayfa/bolum";
import DurumGostergesi, { type DurumTonu } from "../_components/sayfa/durum-gostergesi";
import { KunyeAlanlari, NotAlani, SOURCE_TYPE_LABELS } from "./kaynak-parcalari";

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
    sistem uydurmaz.

  Signature OS 4.1: arama · süzgeç · sıralama tek şeritte; kaynağın adı
  ayrıntı panelini açar.

  Signature OS 4.2 (05.11.2026), KAYNAK İNCELEME ALANI. Ayrıntı paneli
  salt okunurdu; künyeyi düzeltmek için Kaynak bul penceresinde kaynağı
  bulup "Düzenle ya da sil"i açmak gerekiyordu. Şimdi panelde:
  - Künyeyi düzenle: Literatür penceresindeki AYNI form ve AYNI sunucu
    işlemi (KunyeAlanlari + NotAlani + updateLiteratureSource); ikinci
    bir düzenleme mantığı yazılmadı. Notlar da bu formda (notes sütunu).
  - Dizinlerde karşılaştır: kanıt matrisindeki künye doğrulamasının aynısı
    (kunyeDogrula), alan alan. Sonuç kaydedilmez ve "şu an
    karşılaştırıldı" diye gösterilir; kalıcı "doğrulandı" rozeti yok.
  - Çalışmadaki yeri: metinde atıf (METİNDEN okunur, durum alanından
    değil), kanıt matrisindeki iddialar, DOI'si aynı PDF. Bilinmeyen
    "bilinmiyor" yazılır, "yok" değil (lib/kaynak-kutuphanesi.ts).
  - Olası tekrar: içe aktarmanın ölçütüyle; liste işaretler, silmez.
  - Silme: Literatür penceresindeki aynı işlem, onay penceresiyle.

  ÇOKLU SEÇİM YOK, bilerek: kaynaklar için toplu bir işlem (toplu durum,
  toplu silme) sunucuda yok. İşi olmayan seçim kutuları sahte bir özellik
  olurdu.
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
type Suzgec = "hepsi" | Durum | "eksik" | "tekrar";
type Siralama = "durum" | "yeni" | "yil" | "baslik" | "yazar";

export type KaynakYeri = {
  satirlar: Record<string, KaynakBaglami>;
  /* "dipnot" 4.3.5'te kalktı: dipnotlu stilde atıf dipnot metinlerinden okunuyor. */
  metinSebebi: "okunamadi" | "numara" | "bos" | null;
  kanitOkunamadi: boolean;
  pdfOkunamadi: boolean;
};

const baglanti = (deger: string | null) => {
  const temiz = deger?.trim();
  if (!temiz) return null;
  const doi = temiz.match(/10\.\d{4,9}\/\S+/);
  if (doi && !/^https?:/i.test(temiz)) return `https://doi.org/${doi[0]}`;
  return /^https?:\/\//i.test(temiz) ? temiz : null;
};
const durumu = (k: LiteratureSource) => (k.status in ETIKET ? k.status : "to_review") as Durum;

export default function KaynakListesi({ kaynaklar, projectId, baglam }: { kaynaklar: LiteratureSource[]; projectId: string; baglam: KaynakYeri | null }) {
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
  const tekrarlar = useMemo(() => olasiTekrarlar(kaynaklar), [kaynaklar]);
  const sayilar: Record<Suzgec, number> = {
    hepsi: kaynaklar.length,
    to_review: kaynaklar.filter((k) => k.status === "to_review").length,
    read: kaynaklar.filter((k) => k.status === "read").length,
    used: kaynaklar.filter((k) => k.status === "used").length,
    eksik: kaynaklar.filter((k) => (eksikler.get(k.id) ?? []).length).length,
    tekrar: tekrarlar.size,
  };
  const terim = arama.trim().toLocaleLowerCase(YEREL[dil]);
  const suzulen = kaynaklar.filter((k) => {
    if (suzgec === "eksik" && !(eksikler.get(k.id) ?? []).length) return false;
    if (suzgec === "tekrar" && !tekrarlar.has(k.id)) return false;
    if (suzgec !== "hepsi" && suzgec !== "eksik" && suzgec !== "tekrar" && k.status !== suzgec) return false;
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
          { kod: "tekrar", ad: t({ tr: "Olası tekrar", en: "Possible duplicates" }), sayi: sayilar.tekrar },
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
                  <button
                    type="button"
                    className="kaynak-ad"
                    aria-haspopup="dialog"
                    onClick={() => {
                      setAcikId(k.id);
                      setPanelAcik(true);
                    }}
                  >
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
                  {tekrarlar.has(k.id) ? <small className="kaynak-eksik">{t({ tr: "Olası tekrar: listede aynı DOI ya da aynı başlık ve yıl var", en: "Possible duplicate: same DOI, or same title and year, in the list" })}</small> : null}
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
          key={acik.id}
          kaynak={acik}
          projectId={projectId}
          eksik={eksikler.get(acik.id) ?? []}
          tekrarlari={(tekrarlar.get(acik.id) ?? []).map((id) => kaynaklar.find((k) => k.id === id)).filter((k): k is LiteratureSource => Boolean(k))}
          yeri={baglam ? { ...baglam, satir: baglam.satirlar[acik.id] ?? null } : null}
          durumDugmeleri={durumDugmeleri(acik, true)}
          acik={panelAcik}
          onKapat={() => setPanelAcik(false)}
          onTekrarAc={(id) => setAcikId(id)}
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
  projectId,
  eksik,
  tekrarlari,
  yeri,
  durumDugmeleri,
  acik,
  onKapat,
  onTekrarAc,
}: {
  kaynak: LiteratureSource;
  projectId: string;
  eksik: string[];
  tekrarlari: LiteratureSource[];
  yeri: (KaynakYeri & { satir: KaynakBaglami | null }) | null;
  durumDugmeleri: ReactNode;
  acik: boolean;
  onKapat: () => void;
  onTekrarAc: (id: string) => void;
}) {
  const t = useCeviri();
  const [duzenle, setDuzenle] = useState(false);
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
          eylem={
            duzenle ? null : (
              <button type="button" className="projects-filter-button button-compact" onClick={() => setDuzenle(true)}>
                <Pencil size={14} aria-hidden="true" /> {t({ tr: "Düzenle", en: "Edit" })}
              </button>
            )
          }
        >
          {duzenle ? (
            /* Literatür penceresiyle AYNI form ve AYNI işlem (literatur-penceresi.tsx). */
            <ActionForm
              className="project-form-grid ayrinti-form"
              action={async (formData) => {
                const sonuc = await updateLiteratureSource(k.id, formData);
                if (sonuc?.success) setDuzenle(false);
                return sonuc;
              }}
              successMessage={t({ tr: "Kaynak güncellendi.", en: "Source updated." })}
            >
              <KunyeAlanlari kaynak={k} />
              <NotAlani kaynak={k} />
              <div className="project-form-actions project-form-full">
                <button type="button" className="projects-filter-button button-compact" onClick={() => setDuzenle(false)}>
                  {t({ tr: "Vazgeç", en: "Cancel" })}
                </button>
                <button type="submit" className="projects-primary-button button-compact">
                  {t({ tr: "Kaydet", en: "Save" })}
                </button>
              </div>
            </ActionForm>
          ) : (
            <>
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
            </>
          )}
        </Bolum>

        <Dogrulama kaynakId={k.id} />

        <Bolum id={`kaynak-${k.id}-yeri`} baslik={t({ tr: "Çalışmadaki yeri", en: "Use in this work" })}>
          <dl className="ayrinti-alanlar">
            <div>
              <dt>{t({ tr: "Metinde atıf", en: "Cited in the text" })}</dt>
              <dd>{metindeMetni(t, yeri)}</dd>
            </div>
            <div>
              <dt>{t({ tr: "Kanıt matrisi", en: "Evidence matrix" })}</dt>
              <dd>
                {!yeri || yeri.kanitOkunamadi ? (
                  t({ tr: "Okunamadı", en: "Couldn't be read" })
                ) : yeri.satir?.kanitSayisi ? (
                  <Link href={`/dashboard/editor/${projectId}/kanit`}>
                    {t({ tr: `${yeri.satir.kanitSayisi} iddiada kaynak olarak bağlı`, en: `Linked as the source of ${yeri.satir.kanitSayisi} ${yeri.satir.kanitSayisi === 1 ? "claim" : "claims"}` })}
                  </Link>
                ) : (
                  t({ tr: "Hiçbir iddiaya bağlı değil", en: "Not linked to any claim" })
                )}
              </dd>
            </div>
            <div>
              <dt>PDF</dt>
              <dd>
                {!yeri || yeri.pdfOkunamadi
                  ? t({ tr: "Okunamadı", en: "Couldn't be read" })
                  : !/10\.\d{4,9}\//.test(k.doi_or_url ?? "")
                    ? t({ tr: "Kaynağın DOI'si yok; PDF ile eşleştirilmiyor", en: "The source has no DOI; it isn't matched to a PDF" })
                    : yeri.satir?.pdf
                      ? t({
                          tr: "Çalışma klasöründe DOI'si aynı bir PDF var. Açmak ve “Kaynağa sor” için Kaynakça kartında “Sonuçları aç”: ikisi de kaynakçadaki satırında.",
                          en: "The work folder has a PDF with the same DOI. To open it or use “Ask the source”, use “Open results” on the Reference list card: both are on its reference row.",
                        })
                      : t({ tr: "Çalışma klasöründe bu DOI ile PDF yok", en: "No PDF with this DOI in the work folder" })}
              </dd>
            </div>
          </dl>
        </Bolum>

        {tekrarlari.length ? (
          <Bolum
            id={`kaynak-${k.id}-tekrar`}
            baslik={t({ tr: "Olası tekrar", en: "Possible duplicate" })}
            aciklama={t({
              tr: "Aynı DOI ya da aynı başlık ve yıl. Hangisi doğru kayıtsa onu tutun; ötekini silebilirsiniz.",
              en: "Same DOI, or same title and year. Keep whichever record is correct; you can delete the other.",
            })}
          >
            <ul className="ayrinti-liste">
              {tekrarlari.map((d) => (
                <li key={d.id}>
                  <button type="button" className="link-button" onClick={() => onTekrarAc(d.id)}>
                    {d.title}
                  </button>
                  <small>{[d.authors, d.year].filter(Boolean).join(" · ")}</small>
                </li>
              ))}
            </ul>
          </Bolum>
        ) : null}

        {duzenle ? null : (
          <Bolum id={`kaynak-${k.id}-not`} baslik={t({ tr: "Notlarım", en: "My notes" })}>
            <p className={k.notes?.trim() ? "ayrinti-not" : "muted text-sm"}>
              {k.notes?.trim() || t({ tr: "Bu kaynağa not eklenmemiş. “Düzenle” ile ekleyebilirsiniz.", en: "No notes for this source. You can add some with “Edit”." })}
            </p>
          </Bolum>
        )}

        <ActionForm
          className="ayrinti-eylemler"
          action={async () => {
            const sonuc = await deleteLiteratureSource(k.id);
            if (sonuc?.success) onKapat();
            return sonuc;
          }}
          confirmMessage={t({ tr: `"${k.title}" kaynağını silmek istediğinize emin misiniz?`, en: `Are you sure you want to delete "${k.title}"?` })}
          successMessage={t({ tr: "Kaynak silindi.", en: "Source deleted." })}
        >
          <button type="submit" className="link-button kaynak-sil">
            <Trash2 size={14} aria-hidden="true" /> {t({ tr: "Kaynağı sil", en: "Delete source" })}
          </button>
        </ActionForm>
      </div>
    </AyrintiPaneli>
  );
}

function metindeMetni(t: ReturnType<typeof useCeviri>, yeri: (KaynakYeri & { satir: KaynakBaglami | null }) | null): string {
  if (!yeri) return t({ tr: "Bilinmiyor", en: "Unknown" });
  if (yeri.metinSebebi === "okunamadi") return t({ tr: "Bilinmiyor: çalışmanın metni okunamadı", en: "Unknown: the work's text couldn't be read" });
  if (yeri.metinSebebi === "numara") return t({ tr: "Numaralı stilde metinden okunamıyor; okuma durumuna bakın", en: "Can't be read from the text in a numbered style; see the reading status" });
  if (yeri.metinSebebi === "bos") return t({ tr: "Çalışmada henüz metin yok", en: "The work has no text yet" });
  const m = yeri.satir?.metinde;
  if (m === true) return t({ tr: "Evet: ilk yazarın adı ve yıl metinde (ya da dipnotlarda) geçiyor", en: "Yes: the first author's name and the year appear in the text (or footnotes)" });
  if (m === false) return t({ tr: "Hayır: ilk yazarın adı ve yıl metinde (ya da dipnotlarda) birlikte geçmiyor", en: "No: the first author's name and the year don't appear together in the text (or footnotes)" });
  return t({ tr: "Bilinmiyor: kaynakta yazar yok", en: "Unknown: the source has no author" });
}

/*
  DİZİNLERDE KARŞILAŞTIR. Kayıt değişmez; sonuç yalnızca bu ekranda,
  "şu an" diye. Dizine ulaşılamazsa hata yazılır, "bulunamadı" değil.
*/
const ALAN_TONU: Record<AlanSonucu, DurumTonu> = { eslesti: "success", farkli: "danger", bizde_yok: "warning", kayitta_yok: "neutral" };
const ALAN_METNI: Record<AlanSonucu, Metin> = {
  eslesti: { tr: "Eşleşti", en: "Matched" },
  farkli: { tr: "Farklı", en: "Different" },
  bizde_yok: { tr: "Kaydınızda yok", en: "Missing in your record" },
  kayitta_yok: { tr: "Dizinde yok", en: "Not in the index" },
};
const SONUC_TONU = { dogrulandi: "success", kismen: "warning", uyusmuyor: "danger" } as const;
const SONUC_METNI: Record<keyof typeof SONUC_TONU, Metin> = {
  dogrulandi: { tr: "Dizin kaydıyla eşleşti", en: "Matches the index record" },
  kismen: { tr: "Kısmen eşleşti", en: "Partially matches" },
  uyusmuyor: { tr: "Uyuşmuyor", en: "Doesn't match" },
};

function Dogrulama({ kaynakId }: { kaynakId: string }) {
  const t = useCeviri();
  const dil = useDil();
  const [sonuc, setSonuc] = useState<Exclude<DogrulamaSonucu, { tur: "ulasilamadi" }> | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  return (
    <Bolum
      id={`kaynak-${kaynakId}-dogrulama`}
      baslik={t({ tr: "Dizinlerde karşılaştır", en: "Check against the indexes" })}
      aciklama={t({
        tr: "Künyeniz Crossref ve OpenAlex kaydıyla alan alan karşılaştırılır. Kaydınız değişmez; sonuç kaydedilmez.",
        en: "Your reference is compared field by field with the Crossref and OpenAlex record. Your record isn't changed and the result isn't saved.",
      })}
      eylem={
        <button
          type="button"
          className="projects-filter-button button-compact"
          disabled={bekliyor}
          onClick={() =>
            basla(async () => {
              setHata(null);
              const yanit = await kaynakKunyesiniKarsilastir(kaynakId);
              if (yanit.error) {
                setSonuc(null);
                setHata(yanit.error);
              } else setSonuc(yanit.sonuc ?? null);
            })
          }
        >
          <SearchCheck size={14} aria-hidden="true" /> {bekliyor ? t({ tr: "Karşılaştırılıyor…", en: "Checking…" }) : sonuc ? t({ tr: "Yeniden karşılaştır", en: "Check again" }) : t({ tr: "Karşılaştır", en: "Check" })}
        </button>
      }
    >
      <div aria-live="polite">
        {hata ? (
          <p className="alert" data-tone="warning" role="alert">
            {hata}
          </p>
        ) : sonuc?.tur === "bulunamadi" ? (
          <p className="text-sm">
            <DurumGostergesi ton="neutral">{t({ tr: "Doğrulanamadı", en: "Couldn't be verified" })}</DurumGostergesi> {sonuc.neden}
          </p>
        ) : sonuc?.tur === "bulundu" ? (
          <>
            <p className="text-sm">
              <DurumGostergesi ton={SONUC_TONU[sonuc.karsilastirma.durum]}>{t(SONUC_METNI[sonuc.karsilastirma.durum])}</DurumGostergesi> {kunyeOzeti(sonuc.karsilastirma, dil)}
            </p>
            <table className="ayrinti-karsilastirma">
              <caption className="sr-only">{t({ tr: "Alan alan karşılaştırma", en: "Field-by-field comparison" })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t({ tr: "Alan", en: "Field" })}</th>
                  <th scope="col">{t({ tr: "Kaydınız", en: "Your record" })}</th>
                  <th scope="col">{sonuc.karsilastirma.dizin === "crossref" ? "Crossref" : "OpenAlex"}</th>
                  <th scope="col">{t({ tr: "Sonuç", en: "Result" })}</th>
                </tr>
              </thead>
              <tbody>
                {sonuc.karsilastirma.alanlar.map((a) => (
                  <tr key={a.alan}>
                    <th scope="row">{alanEtiketi(a.alan, dil)}</th>
                    <td>{a.bizde ?? "—"}</td>
                    <td>{a.kayitta ?? "—"}</td>
                    <td>
                      <DurumGostergesi ton={ALAN_TONU[a.sonuc]}>{t(ALAN_METNI[a.sonuc])}</DurumGostergesi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sonuc.karsilastirma.adres ? (
              <a className="text-sm" href={sonuc.karsilastirma.adres} target="_blank" rel="noreferrer noopener">
                {t({ tr: "Dizin kaydını aç", en: "Open the index record" })} <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </Bolum>
  );
}
