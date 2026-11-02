"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import KayitFormu from "@/app/kayit/kayit-formu";
import { useCeviri } from "./dil-saglayici";
import type { Metin } from "@/lib/dil";

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
  Sayfada iki düğme aynı pencereyi açabilir (giriş kartının altındaki kayıt
  kartı ve tanıtım alanı); `sinif` ve `etiket` yalnızca düğmenin görünüşü.
  ?kayit=1 ile açılış yalnızca birinde (acik) verilmeli, yoksa iki pencere açılır.
*/
export default function KayitPenceresi({
  acik: baslangicta = false,
  sinif = "giris-kayit-dugme",
  etiket = { tr: "Ücretsiz hesap oluştur", en: "Create a free account" },
}: {
  acik?: boolean;
  sinif?: string;
  etiket?: Metin;
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
        <UserPlus size={16} aria-hidden="true" />
        {t(etiket)}
      </a>
      <Dialog
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
