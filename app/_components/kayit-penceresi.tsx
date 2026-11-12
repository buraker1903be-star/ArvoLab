"use client";

import { useEffect, useState, type ReactNode } from "react";
import Dialog from "@/app/dashboard/_components/dialog";
import KayitFormu from "@/app/kayit/kayit-formu";
import { useCeviri } from "./dil-saglayici";
import type { Metin } from "@/lib/dil";
import { dugmeSinifi } from "@/lib/os5/bilesen";

/*
  Giriş sayfasındaki "Ücretsiz hesap oluştur" penceresi (02.11.2026, kurum
  sahibinin isteği). Eskiden düğme /kayit sayfasına gidiyordu; kullanıcı
  giriş ekranından ayrılıp ayrı bir sayfada formu dolduruyordu.

  Düğme yine bir BAĞLANTI olarak başlıyor (href="/kayit"): JavaScript
  yüklenmeden tıklanırsa kayıt sayfası açılır. Yüklenince tıklama
  pencereyi açar. Adres "?kayit=1" ile gelinirse pencere kendiliğinden
  açılır — e-postadan ya da reklamdan doğrudan kayda gelinebilsin.
*/
/*
  `sinif`, `etiket` ve `sonEk` yalnızca düğmenin görünüşü. ?kayit=1 ile
  açılış yalnızca bir düğmede (acik) verilmeli: sayfada iki düğme olursa
  iki pencere açılır. Signature OS 5 / Phase 2'de giriş sayfasındaki ikinci
  düğme (tanıtım alanı) kalktı; varsayılan görünüş ortak ikincil düğme ve
  pencere os5 görünümünde (Dialog `gorunum="os5"`: odak tuzağı, Esc ve
  odak iadesi aynı koddan).
*/
export default function KayitPenceresi({
  acik: baslangicta = false,
  sinif = dugmeSinifi({ tur: "ikincil" }),
  etiket = { tr: "Ücretsiz hesap oluştur", en: "Create a free account" },
  sonEk,
}: {
  acik?: boolean;
  sinif?: string;
  etiket?: Metin;
  sonEk?: ReactNode;
}) {
  const t = useCeviri();
  const [acik, setAcik] = useState(baslangicta);

  useEffect(() => {
    if (!baslangicta) return;
    // Pencere kapandıktan sonra sayfa yenilenirse yeniden açılmasın.
    const adres = new URL(window.location.href);
    if (adres.searchParams.has("kayit")) {
      adres.searchParams.delete("kayit");
      window.history.replaceState(null, "", adres.pathname + adres.search + adres.hash);
    }
  }, [baslangicta]);

  return (
    <>
      <a
        href="/kayit"
        className={sinif}
        onClick={(e) => {
          e.preventDefault();
          setAcik(true);
        }}
      >
        {t(etiket)}
        {sonEk}
      </a>
      <Dialog
        gorunum="os5"
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Ücretsiz deneme", en: "Free trial" })}
        title={t({ tr: "ArvoLab hesabı oluşturun", en: "Create your ArvoLab account" })}
        description={t({
          tr: "Birkaç bilgiyle hemen başlayın.",
          en: "Get started with just a few details.",
        })}
      >
        <KayitFormu pencerede />
      </Dialog>
    </>
  );
}
