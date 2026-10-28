"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, PenLine, Plus } from "lucide-react";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
import { yeniCalisma } from "@/app/actions/projects";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import PanelDrawer from "../_components/panel-drawer";
import KilavuzYukle from "./[id]/kilavuz-yukle";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  YENİ ÇALIŞMA PENCERESİ (26.10.2026, kurum sahibinin isteği: "Yeni
  çalışma da aynı şekilde açılır pencere olacak ve öğrenci kendi tez
  yazım kılavuzunu kendisi ekleyecek").

  Eskiden ayrı bir sayfaydı (/dashboard/editor/new): üniversite →
  enstitü → anabilim dalı seçicileriyle katalogdaki kılavuzu eşlemeye
  çalışıyor, eşleşmezse kayıttan sonra öğrenciyi başka bir sayfadaki
  kılavuz penceresine gönderiyordu. Çoğu kurumun kılavuzu katalogda yok;
  öğrenci üç seçiciyi doldurup yine kendi PDF'ini yüklüyordu.

  Şimdi tek pencere, iki kart: solda çalışmanın kendisi (başlık, tür,
  kurum adı, teslim tarihi), sağda ikinci adım — tezde öğrencinin KENDİ
  kılavuzu (aynı yükleme ve onay akışı, kilavuz-yukle.tsx), makalede
  dergi kuralları. Kurum adı serbest metin: kapak sayfası için;
  katalog eşleşmesine bilerek gönderilmiyor, yoksa eşleşen katalog
  kılavuzu öğrencinin yüklediğini geçersiz kılardı
  (calisma-kilavuzu.ts: katalog bağlıysa yükleme reddediliyor).
  Personelin tam formu /dashboard/editor/new adresinde duruyor.
*/

const TURLER = [
  { deger: "thesis", ad: { tr: "Tez", en: "Thesis" }, aciklama: { tr: "Yüksek lisans ya da doktora", en: "Master's or doctoral" } },
  { deger: "article", ad: { tr: "Makale", en: "Article" }, aciklama: { tr: "Dergiye gönderilecek", en: "To be submitted to a journal" } },
  { deger: "project", ad: { tr: "Proje", en: "Project" }, aciklama: { tr: "Ödev, rapor, proje", en: "Assignment, report, project" } },
] as const;
/* Doçentlik dosyası türü öğrencinin penceresinde yok: doçentlik modülü
   personelin (kurum sahibinin kararı, 26.10.2026). Personelin tam formu
   (/dashboard/editor/new) bu türü sunmaya devam ediyor. */

type Tur = (typeof TURLER)[number]["deger"];

export default function YeniCalismaPenceresi({
  acikBasla = false,
  triggerClassName = "projects-primary-button",
}: {
  acikBasla?: boolean;
  triggerClassName?: string;
}) {
  const t = useCeviri();
  const router = useRouter();
  const [tur, setTur] = useState<Tur>("thesis");
  const [hata, setHata] = useState<string | null>(null);
  const [olusan, setOlusan] = useState<{ id: string; baslik: string; tur: Tur } | null>(null);
  const [kilavuzTamam, setKilavuzTamam] = useState(false);
  const [bekleniyor, basla] = useTransition();
  /* Her açılışta form sıfırdan kurulsun diye anahtar; kapanınca artar. */
  const [surum, setSurum] = useState(0);

  const gonder = (formData: FormData) => {
    setHata(null);
    basla(async () => {
      const sonuc = await yeniCalisma(formData);
      if (sonuc.error || !sonuc.id) {
        setHata(sonuc.error ?? t({ tr: "Çalışma oluşturulamadı; tekrar deneyin.", en: "The work could not be created; try again." }));
        return;
      }
      setOlusan({ id: sonuc.id, baslik: String(formData.get("title") ?? ""), tur });
      // Arkadaki liste yeni çalışmayı göstersin; pencere açık kalır.
      router.refresh();
    });
  };

  /* Kapanınca yeni çalışma kartta seçili açılır: öğrenci onu listede aramasın. */
  const kapandi = (acik: boolean) => {
    if (acik) return;
    if (olusan) router.push(`/dashboard/editor?sec=${olusan.id}`);
    setOlusan(null);
    setKilavuzTamam(false);
    setHata(null);
    setTur("thesis");
    setSurum((s) => s + 1);
  };

  const yazmaAdresi = olusan ? `/dashboard/editor/${olusan.id}/write` : "#";

  return (
    <PanelDrawer
      triggerLabel={t({ tr: "Yeni çalışma", en: "New work" })}
      triggerIcon={<Plus size={18} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Yeni çalışma", en: "New work" })}
      title={olusan ? olusan.baslik : t({ tr: "Yeni çalışma başlatın", en: "Start a new work" })}
      description={
        olusan
          ? t({
              tr: "Çalışmanız oluşturuldu. Kılavuzunuzu şimdi ekleyebilir ya da sonra kartından ekleyebilirsiniz.",
              en: "Your work has been created. You can add your guideline now or later from its card.",
            })
          : t({
              tr: "Çalışmanızı tanıtın, ardından tez yazım kılavuzunuzu ekleyin; sayfa düzeni, zorunlu bölümler ve kaynakça sistemi editöre kendiliğinden uygulanır.",
              en: "Describe your work, then add your thesis writing guideline; page layout, required sections and the citation system are applied to the editor automatically.",
            })
      }
      boy="tam"
      basaridaKapan={false}
      acikBasla={acikBasla}
      onAcikDegis={kapandi}
    >
      <div className="pencere-iki-kart" key={surum}>
        <section className="pencere-kart">
          <h3 className="pencere-kart-baslik">{t({ tr: "1. Çalışmanız", en: "1. Your work" })}</h3>
          {olusan ? (
            <p className="yeni-calisma-tamam">
              <Check size={16} aria-hidden="true" /> <b>{olusan.baslik}</b> {t({ tr: "oluşturuldu.", en: "created." })}
            </p>
          ) : (
            <form action={gonder} className="project-form-grid">
              <label className="project-form-full">
                <span>{t({ tr: "Çalışmanın başlığı", en: "Title of the work" })}</span>
                <input
                  name="title"
                  type="text"
                  placeholder={t({
                    tr: "Örn. Enflasyon Beklentilerinin Hane Tüketimine Etkisi",
                    en: "E.g. The Effect of Inflation Expectations on Household Consumption",
                  })}
                  minLength={3}
                  maxLength={240}
                  required
                  autoFocus
                />
              </label>

              <fieldset className="yeni-calisma-tur project-form-full">
                <legend>{t({ tr: "Türü", en: "Type" })}</legend>
                <input type="hidden" name="type" value={tur} />
                <div className="analiz-kartlari" data-boy="tur">
                  {TURLER.map((secenek) => (
                    <button
                      key={secenek.deger}
                      type="button"
                      className="analiz-karti"
                      aria-pressed={secenek.deger === tur}
                      onClick={() => setTur(secenek.deger)}
                    >
                      <b>{t(secenek.ad)}</b>
                      <small>{t(secenek.aciklama)}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

                <label>
                  <span>{t({ tr: "Üniversite (isteğe bağlı)", en: "University (optional)" })}</span>
                  <input name="university" type="text" maxLength={240} placeholder={t({ tr: "Örn. Dokuz Eylül Üniversitesi", en: "E.g. Dokuz Eylül University" })} />
                </label>
                <label>
                  <span>{t({ tr: "Anabilim dalı (isteğe bağlı)", en: "Department (optional)" })}</span>
                  <input name="department" type="text" maxLength={240} placeholder={t({ tr: "Örn. İktisat", en: "E.g. Economics" })} />
                </label>

                <label>
                  <span>{t({ tr: "Teslim tarihi (isteğe bağlı)", en: "Due date (optional)" })}</span>
                  <TarihSecici name="dueDate" etiket={t({ tr: "Teslim tarihi", en: "Due date" })} />
                </label>
                {/*
                  Tezde kaynakça sistemi kılavuzdan gelir (kılavuz onaylanınca
                  çalışmanın stili de ona göre yazılıyor); burada sormak, iki
                  yerde iki cevap üretirdi. Diğer türlerde öğrenci seçer.
                */}
                {tur === "thesis" ? (
                  <input type="hidden" name="citationStyle" value="apa7" />
                ) : (
                  <label>
                    <span>{t({ tr: "Kaynakça sistemi", en: "Citation system" })}</span>
                    <select name="citationStyle" defaultValue="apa7">
                      {STIL_SECENEKLERI.map((secenek) => (
                        <option key={secenek.deger} value={secenek.deger}>
                          {secenek.etiket}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

              {hata ? (
                <p className="alert project-form-full" data-tone="danger" role="alert">
                  {hata}
                </p>
              ) : null}

              <div className="pencere-dugmeler project-form-full">
                <button type="submit" className="projects-primary-button" disabled={bekleniyor}>
                  <Plus size={16} aria-hidden="true" />
                  {bekleniyor ? t({ tr: "Oluşturuluyor…", en: "Creating…" }) : t({ tr: "Çalışmayı oluştur", en: "Create work" })}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="pencere-kart" data-pasif={olusan ? undefined : "true"}>
          {(olusan?.tur ?? tur) === "thesis" ? (
            <>
              <h3 className="pencere-kart-baslik">{t({ tr: "2. Tez yazım kılavuzunuz", en: "2. Your thesis writing guideline" })}</h3>
              {!olusan ? (
                <>
                  <p className="muted text-sm">
                    {t({
                      tr: "Çalışmayı oluşturunca kılavuzunuzu burada eklersiniz: danışmanınızın ya da enstitünüzün verdiği PDF ya da kılavuzun internet adresi. Kurallar dosyadan çıkarılır ve size onaylatılır.",
                      en: "Once the work is created, you add your guideline here: the PDF from your advisor or graduate school, or the guideline's web address. The rules are extracted from the file and you approve them.",
                    })}
                  </p>
                  <div className="kilavuz-bicim">
                    <ul>
                      <li>{t({ tr: "Sayfa düzeni: kenar boşlukları, yazı tipi, satır aralığı", en: "Page layout: margins, font, line spacing" })}</li>
                      <li>{t({ tr: "Zorunlu bölümler: teslim listesinde eksik olanlar söylenir", en: "Required sections: missing ones are flagged in the submission checklist" })}</li>
                      <li>{t({ tr: "Kaynakça sistemi: APA, IEEE, Chicago…", en: "Citation system: APA, IEEE, Chicago…" })}</li>
                    </ul>
                  </div>
                </>
              ) : kilavuzTamam ? (
                <>
                  <p className="yeni-calisma-tamam">
                    <Check size={16} aria-hidden="true" /> {t({ tr: "Kılavuzunuz uygulandı.", en: "Your guideline has been applied." })}
                  </p>
                  <p className="muted text-sm">
                    {t({
                      tr: "Kuralları ve atıf örneğini çalışma kartındaki \"Kılavuz\" penceresinden görebilir, değiştirebilirsiniz.",
                      en: "You can view and change the rules and the citation example in the \"Guideline\" window on the work card.",
                    })}
                  </p>
                  <Link href={yazmaAdresi} className="projects-primary-button">
                    <PenLine size={16} aria-hidden="true" /> {t({ tr: "Yazmaya başla", en: "Start writing" })}
                  </Link>
                </>
              ) : (
                <>
                  <KilavuzYukle projectId={olusan.id} onKapat={() => setKilavuzTamam(true)} />
                  {/* Kılavuz elde yoksa akış durmasın; kart "Kılavuzu yükle" diye hatırlatıyor. */}
                  <Link href={yazmaAdresi} className="link-button mt-sm">
                    {t({ tr: "Kılavuzu sonra eklerim, yazmaya başla", en: "I'll add the guideline later, start writing" })}
                  </Link>
                </>
              )}
            </>
          ) : (olusan?.tur ?? tur) === "article" ? (
            <>
              <h3 className="pencere-kart-baslik">{t({ tr: "2. Dergi kuralları", en: "2. Journal rules" })}</h3>
              <p className="muted text-sm">
                {t({
                  tr: "Makalede kılavuzun karşılığı derginin yazım kuralları. Çalışmayı oluşturunca dergi bilgilerini ve kuralların kontrol tarihini girersiniz.",
                  en: "For an article, the journal's author guidelines take the place of a guideline. Once the work is created, you enter the journal details and when you last checked its rules.",
                })}
              </p>
              {olusan ? (
                <Link href={`/dashboard/editor/${olusan.id}/makale?dergi=1`} className="projects-primary-button">
                  {t({ tr: "Dergi bilgilerini gir", en: "Enter journal details" })}
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <h3 className="pencere-kart-baslik">{t({ tr: "2. Yazmaya başlayın", en: "2. Start writing" })}</h3>
              <p className="muted text-sm">
                {t({
                  tr: "Kurumunuzun bir yazım kılavuzu varsa sonradan çalışma kartındaki \"Kılavuz\" penceresinden ekleyebilirsiniz.",
                  en: "If your institution has a writing guideline, you can add it later from the \"Guideline\" window on the work card.",
                })}
              </p>
              {olusan ? (
                <Link href={yazmaAdresi} className="projects-primary-button">
                  <PenLine size={16} aria-hidden="true" /> {t({ tr: "Yazmaya başla", en: "Start writing" })}
                </Link>
              ) : null}
            </>
          )}
        </section>
      </div>
    </PanelDrawer>
  );
}
