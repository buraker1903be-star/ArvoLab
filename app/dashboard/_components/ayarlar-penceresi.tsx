"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { ayarlariOku, type AyarlarVerisi } from "@/app/actions/ayarlar";
import Dialog from "./dialog";
import AyarlarIcerik, { type Sekme } from "./ayarlar-icerik";
import { AYARLAR_AC_OLAYI, type AyarlarAcDetay } from "./ayarlar-olay";

const SEKMELER: Sekme[] = ["hesap", "guvenlik", "tercihler", "abonelik", "veriler"];

/*
  UYGULAMA GENELİNDE AYARLAR PENCERESİ (24.11.2026).

  Eskiden hesap menüsündeki "Ayarlar" bir sayfaya gidiyordu. Editörde
  yazarken ayarına bakan öğrenci belgeden ÇIKIYORDU: dönüşte sayfa baştan
  yükleniyor, kaydırma konumu başa alınıyor, imleç ve seçim gidiyordu.
  Pencere gezinme YAPMIYOR; arkadaki sayfa olduğu gibi duruyor, editör
  bileşeni sökülmüyor, ProseMirror'ın seçimi yerinde kalıyor.

  İÇERİK AÇILINCA OKUNUYOR. Panelin her sayfasında peşinen okunsaydı
  abonelik ve kredi sorguları Ayarlar'a hiç bakmayan kullanıcıya da
  maliyet çıkarırdı.

  Pencere #148–#149'daki ortak bileşenden (Dialog): odak tuzağı, en
  üstteki pencereye Escape, sayımlı kaydırma kilidi ve odak iadesi oradan
  geliyor. İç içe pencerelerde (şifre, sözleşme, hesap silme) ilk Escape
  yalnızca üsttekini kapatıyor.
*/
export default function AyarlarPenceresi() {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const [sekme, setSekme] = useState<Sekme>("hesap");
  const [veri, setVeri] = useState<AyarlarVerisi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kirli, setKirli] = useState(false);
  const [cikisSorusu, setCikisSorusu] = useState(false);
  /* Odak iadesi Dialog'un işi (#148): menüden açıldığında menü kapandığı
     için hedef odak-iadesi.ts'teki sıraya düşüyor ve görünür menü
     düğmesine dönüyor. Burada ayrıca saklamaya gerek yok. */
  const yol = usePathname();
  const ilkYol = useRef(yol);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    const cevap = await ayarlariOku();
    setYukleniyor(false);
    if ("error" in cevap) {
      setHata(cevap.error);
      return;
    }
    setVeri(cevap.veri);
  }, []);

  useEffect(() => {
    const ac = (olay: Event) => {
      const istenen = (olay as CustomEvent<AyarlarAcDetay>).detail?.sekme;
      if (istenen && (SEKMELER as string[]).includes(istenen)) setSekme(istenen as Sekme);
      setAcik(true);
      void yukle();
    };
    window.addEventListener(AYARLAR_AC_OLAYI, ac);
    return () => window.removeEventListener(AYARLAR_AC_OLAYI, ac);
  }, [yukle]);

  /*
    Başka bir sayfaya gidilirse pencere kapanır. Açık pencereyle gezinmek
    kullanıcının "geri" tuşuna bastığında ne olacağını belirsizleştirir;
    üstelik taslağı da başka bir sayfanın üstünde asılı kalırdı.
  */
  useEffect(() => {
    if (yol !== ilkYol.current) {
      ilkYol.current = yol;
      setAcik(false);
    }
  }, [yol]);

  /* Kaydedilmemiş taslak varken kapatma önce soruluyor. */
  const kapat = useCallback(() => {
    if (kirli) {
      setCikisSorusu(true);
      return;
    }
    setAcik(false);
  }, [kirli]);

  const zorlaKapat = useCallback(() => {
    setCikisSorusu(false);
    setAcik(false);
  }, []);

  return (
    <>
      <Dialog
        open={acik}
        onClose={kapat}
        boy="orta"
        kicker={t({ tr: "Hesabım", en: "My account" })}
        title={t({ tr: "Ayarlar", en: "Settings" })}
      >
        <div className="ayarlar-pencere">
          {hata ? (
            <p className="alert" data-tone="danger" role="alert">
              {hata}
            </p>
          ) : veri ? (
            <AyarlarIcerik veri={veri} sekme={sekme} sekmeDegis={setSekme} kirliDegis={setKirli} />
          ) : (
            /* Boş iskelet değil, tek satır: içerik saniyenin altında
               geliyor ve yanıp sönen bir iskelet daha rahatsız ediyor. */
            <p className="muted text-sm" role="status" aria-live="polite">
              {yukleniyor ? t({ tr: "Ayarlarınız yükleniyor…", en: "Loading your settings…" }) : ""}
            </p>
          )}
        </div>
      </Dialog>

      {/*
        TASLAK KAYBOLMASIN. Kaydedilmemiş profil değişikliği varken pencere
        kapatılmak istenirse önce soruluyor. "Düzenlemeye dön" taslağı
        olduğu gibi bırakıyor: pencere kapanmadığı için alanlar yerinde.
        Vazgeçilirse de pencere yalnızca KAPANIYOR, bileşen sökülmüyor;
        yeniden açıldığında yazılanlar duruyor.
      */}
      <Dialog
        open={cikisSorusu}
        onClose={() => setCikisSorusu(false)}
        boy="onay"
        kicker={t({ tr: "Ayarlar", en: "Settings" })}
        title={t({ tr: "Kaydedilmemiş değişiklikleriniz var", en: "You have unsaved changes" })}
      >
        <div className="stack-sm">
          <p className="text-sm">
            {t({
              tr: "Profil bilgilerinizde kaydedilmemiş değişiklik var. Pencereyi kapatırsanız yazdıklarınız kaybolmaz; yeniden açtığınızda yerinde durur.",
              en: "Your profile has unsaved changes. If you close the window they are not lost; they will still be there when you reopen it.",
            })}
          </p>
          <div className="project-form-actions">
            <button type="button" className="projects-filter-button" onClick={() => setCikisSorusu(false)}>
              {t({ tr: "Düzenlemeye dön", en: "Back to editing" })}
            </button>
            <button type="button" className="projects-primary-button" onClick={zorlaKapat}>
              {t({ tr: "Pencereyi kapat", en: "Close the window" })}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
