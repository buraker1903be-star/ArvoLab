"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, PenLine, Plus } from "lucide-react";
import { yeniCalisma } from "@/app/actions/projects";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import PanelDrawer from "../_components/panel-drawer";
import KilavuzYukle from "./[id]/kilavuz-yukle";

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
  { deger: "thesis", ad: "Tez", aciklama: "Yüksek lisans ya da doktora" },
  { deger: "article", ad: "Makale", aciklama: "Dergiye gönderilecek" },
  { deger: "project", ad: "Proje", aciklama: "Ödev, rapor, proje" },
  { deger: "associate-professorship", ad: "Doçentlik", aciklama: "Doçentlik dosyası" },
] as const;

type Tur = (typeof TURLER)[number]["deger"];

export default function YeniCalismaPenceresi({
  acikBasla = false,
  triggerClassName = "projects-primary-button",
}: {
  acikBasla?: boolean;
  triggerClassName?: string;
}) {
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
        setHata(sonuc.error ?? "Çalışma oluşturulamadı; tekrar deneyin.");
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
      triggerLabel="Yeni çalışma"
      triggerIcon={<Plus size={18} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker="Yeni çalışma"
      title={olusan ? olusan.baslik : "Yeni çalışma başlatın"}
      description={
        olusan
          ? "Çalışmanız oluşturuldu. Kılavuzunuzu şimdi ekleyebilir ya da sonra kartından ekleyebilirsiniz."
          : "Çalışmanızı tanıtın, ardından tez yazım kılavuzunuzu ekleyin; sayfa düzeni, zorunlu bölümler ve kaynakça sistemi editöre kendiliğinden uygulanır."
      }
      boy="tam"
      basaridaKapan={false}
      acikBasla={acikBasla}
      onAcikDegis={kapandi}
    >
      <div className="pencere-iki-kart" key={surum}>
        <section className="pencere-kart">
          <h3 className="pencere-kart-baslik">1. Çalışmanız</h3>
          {olusan ? (
            <p className="yeni-calisma-tamam">
              <Check size={16} aria-hidden="true" /> <b>{olusan.baslik}</b> oluşturuldu.
            </p>
          ) : (
            <form action={gonder} className="project-form-grid">
              <label className="project-form-full">
                <span>Çalışmanın başlığı</span>
                <input
                  name="title"
                  type="text"
                  placeholder="Örn. Enflasyon Beklentilerinin Hane Tüketimine Etkisi"
                  minLength={3}
                  maxLength={240}
                  required
                  autoFocus
                />
              </label>

              <fieldset className="yeni-calisma-tur project-form-full">
                <legend>Türü</legend>
                <input type="hidden" name="type" value={tur} />
                <div className="analiz-kartlari" data-boy="program">
                  {TURLER.map((t) => (
                    <button
                      key={t.deger}
                      type="button"
                      className="analiz-karti"
                      aria-pressed={t.deger === tur}
                      onClick={() => setTur(t.deger)}
                    >
                      <b>{t.ad}</b>
                      <small>{t.aciklama}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

                <label>
                  <span>Üniversite (isteğe bağlı)</span>
                  <input name="university" type="text" maxLength={240} placeholder="Örn. Dokuz Eylül Üniversitesi" />
                </label>
                <label>
                  <span>Anabilim dalı (isteğe bağlı)</span>
                  <input name="department" type="text" maxLength={240} placeholder="Örn. İktisat" />
                </label>

                <label>
                  <span>Teslim tarihi (isteğe bağlı)</span>
                  <div className="project-date-field">
                    <CalendarDays size={17} aria-hidden="true" />
                    <input name="dueDate" type="date" />
                  </div>
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
                    <span>Kaynakça sistemi</span>
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
                  {bekleniyor ? "Oluşturuluyor…" : "Çalışmayı oluştur"}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="pencere-kart" data-pasif={olusan ? undefined : "true"}>
          {(olusan?.tur ?? tur) === "thesis" ? (
            <>
              <h3 className="pencere-kart-baslik">2. Tez yazım kılavuzunuz</h3>
              {!olusan ? (
                <>
                  <p className="muted text-sm">
                    Çalışmayı oluşturunca kılavuzunuzu burada eklersiniz: danışmanınızın ya da enstitünüzün
                    verdiği PDF ya da kılavuzun internet adresi. Kurallar dosyadan çıkarılır ve size onaylatılır.
                  </p>
                  <div className="kilavuz-bicim">
                    <ul>
                      <li>Sayfa düzeni: kenar boşlukları, yazı tipi, satır aralığı</li>
                      <li>Zorunlu bölümler: teslim listesinde eksik olanlar söylenir</li>
                      <li>Kaynakça sistemi: APA, IEEE, Chicago…</li>
                    </ul>
                  </div>
                </>
              ) : kilavuzTamam ? (
                <>
                  <p className="yeni-calisma-tamam">
                    <Check size={16} aria-hidden="true" /> Kılavuzunuz uygulandı.
                  </p>
                  <p className="muted text-sm">
                    Kuralları ve atıf örneğini çalışma kartındaki &quot;Kılavuz&quot; penceresinden görebilir,
                    değiştirebilirsiniz.
                  </p>
                  <Link href={yazmaAdresi} className="projects-primary-button">
                    <PenLine size={16} aria-hidden="true" /> Yazmaya başla
                  </Link>
                </>
              ) : (
                <>
                  <KilavuzYukle projectId={olusan.id} onKapat={() => setKilavuzTamam(true)} />
                  {/* Kılavuz elde yoksa akış durmasın; kart "Kılavuzu yükle" diye hatırlatıyor. */}
                  <Link href={yazmaAdresi} className="link-button mt-sm">
                    Kılavuzu sonra eklerim, yazmaya başla
                  </Link>
                </>
              )}
            </>
          ) : (olusan?.tur ?? tur) === "article" ? (
            <>
              <h3 className="pencere-kart-baslik">2. Dergi kuralları</h3>
              <p className="muted text-sm">
                Makalede kılavuzun karşılığı derginin yazım kuralları. Çalışmayı oluşturunca dergi bilgilerini ve
                kuralların kontrol tarihini girersiniz.
              </p>
              {olusan ? (
                <Link href={`/dashboard/editor/${olusan.id}/makale?dergi=1`} className="projects-primary-button">
                  Dergi bilgilerini gir
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <h3 className="pencere-kart-baslik">2. Yazmaya başlayın</h3>
              <p className="muted text-sm">
                Kurumunuzun bir yazım kılavuzu varsa sonradan çalışma kartındaki &quot;Kılavuz&quot; penceresinden
                ekleyebilirsiniz.
              </p>
              {olusan ? (
                <Link href={yazmaAdresi} className="projects-primary-button">
                  <PenLine size={16} aria-hidden="true" /> Yazmaya başla
                </Link>
              ) : null}
            </>
          )}
        </section>
      </div>
    </PanelDrawer>
  );
}
