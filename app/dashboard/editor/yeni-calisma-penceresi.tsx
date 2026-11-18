"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import { yeniCalisma } from "@/app/actions/projects";
import PanelDrawer from "../_components/panel-drawer";
import { useAdrestenAcilis } from "./adresten-acilis";
import { useCeviri } from "@/app/_components/dil-saglayici";
import BelgeDiliAlani from "./belge-dili-alani";

/*
  YENİ ÇALIŞMA PENCERESİ.

  19.11.2026 (bağlamlı çalışma alanı, onaylı tasarım): başlamak için üç
  bilgi — ad, tür, belge dili. Üniversite, anabilim dalı, teslim tarihi
  ve kılavuz adımı başlangıçtan çıktı; hepsi çalışmanın İÇİNDEN, isteğe
  bağlı: kılavuz editördeki "Kılavuzumu yükle" satırından, kurum ve
  teslim tarihi çalışma kartından ("Bilgileri düzenle", "Teslim tarihini
  seçin"). Eskiden pencere iki kartlıydı (26.10.2026): solda Türkiye'ye
  özgü kurum alanları ("Örn. Dokuz Eylül Üniversitesi"), sağda tezde
  ikinci adım olarak kılavuz yükleme; yurt dışındaki ya da kılavuzu elinde
  olmayan öğrenci ilk dakikada bir formun içinde kalıyordu.

  İki çıkış: "Oluştur ve yaz" editörü açar; "Word dosyasından içe aktar"
  çalışmayı oluşturup editörü içe aktarma penceresi açık hâlde açar
  (?ice=1). Kaynakça sistemi tezde kılavuzdan, diğerlerinde varsayılan
  APA 7 — sonradan "Bilgileri düzenle"den değişir. Personelin tam formu
  ayrı (personel-yeni-calisma-penceresi.tsx).
*/

const TURLER = [
  { deger: "thesis", ad: { tr: "Tez", en: "Thesis" }, aciklama: { tr: "Yüksek lisans ya da doktora", en: "Master's or doctoral" } },
  { deger: "article", ad: { tr: "Makale", en: "Article" }, aciklama: { tr: "Dergiye gönderilecek", en: "To be submitted to a journal" } },
  { deger: "project", ad: { tr: "Proje", en: "Project" }, aciklama: { tr: "Ödev, rapor, proje", en: "Assignment, report, project" } },
] as const;
/* Doçentlik dosyası türü öğrencinin penceresinde yok: doçentlik modülü
   personelin (kurum sahibinin kararı, 26.10.2026). Personelin tam formu
   (new/yeni-calisma-formu.tsx) bu türü sunmaya devam ediyor. */

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
  const [bekleniyor, basla] = useTransition();
  /* Her açılışta form sıfırdan kurulsun diye anahtar; kapanınca artar. */
  const [surum, setSurum] = useState(0);
  // Adresteki ?yeni=1 sonradan da pencereyi açar (adresten-acilis.ts).
  const { acik, setAcik, adresiTemizle } = useAdrestenAcilis(acikBasla);

  const gonder = (formData: FormData) => {
    setHata(null);
    const iceAktar = formData.get("cikis") === "word";
    basla(async () => {
      const sonuc = await yeniCalisma(formData);
      if (sonuc.error || !sonuc.id) {
        setHata(sonuc.error ?? t({ tr: "Çalışma oluşturulamadı; tekrar deneyin.", en: "The work could not be created; try again." }));
        return;
      }
      router.push(`/dashboard/editor/${encodeURIComponent(sonuc.id)}/write${iceAktar ? "?ice=1" : ""}`);
    });
  };

  const kapandi = (simdiAcik: boolean) => {
    setAcik(simdiAcik);
    if (simdiAcik) return;
    adresiTemizle();
    setHata(null);
    setTur("thesis");
    setSurum((s) => s + 1);
  };

  return (
    <PanelDrawer
      triggerLabel={t({ tr: "Yeni çalışma", en: "New work" })}
      triggerIcon={<Plus size={18} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Yeni çalışma", en: "New work" })}
      title={t({ tr: "Yeni çalışma başlatın", en: "Start a new work" })}
      description={t({
        tr: "Başlamak için ad ve tür yeter. Kurum, teslim tarihi ve yazım kılavuzu çalışmanın içinden, istediğiniz zaman eklenir.",
        en: "A title and a type are enough to start. Institution, due date and writing guideline can be added from inside the work at any time.",
      })}
      basaridaKapan={false}
      acik={acik}
      onAcikDegis={kapandi}
    >
      <form action={gonder} className="project-form-grid yeni-calisma-formu" key={surum}>
        <label className="project-form-full">
          <span>{t({ tr: "Çalışmanın adı", en: "Title of the work" })}</span>
          <input
            name="title"
            type="text"
            placeholder={t({
              tr: "Örn. Uzaktan Öğrenmede Akran Teması ve Öğrenci Yalnızlığı",
              en: "E.g. Peer Contact and Student Loneliness in Remote Learning",
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

        <div className="project-form-full">
          <BelgeDiliAlani yeni />
        </div>
        {/* Tezde kaynakça sistemi kılavuzdan gelir; diğer türlerde varsayılan, sonradan değişir. */}
        <input type="hidden" name="citationStyle" value="apa7" />

        {hata ? (
          <p className="alert project-form-full" data-tone="danger" role="alert">
            {hata}
          </p>
        ) : null}

        <div className="pencere-dugmeler project-form-full">
          <button type="submit" name="cikis" value="word" className="projects-filter-button" disabled={bekleniyor}>
            <FileUp size={16} aria-hidden="true" />
            {t({ tr: "Word dosyasından içe aktar", en: "Import a Word file" })}
          </button>
          <button type="submit" name="cikis" value="yaz" className="projects-primary-button" disabled={bekleniyor}>
            <Plus size={16} aria-hidden="true" />
            {bekleniyor ? t({ tr: "Oluşturuluyor…", en: "Creating…" }) : t({ tr: "Oluştur ve yaz", en: "Create and write" })}
          </button>
        </div>
      </form>
    </PanelDrawer>
  );
}
