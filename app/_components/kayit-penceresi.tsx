"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import KayitFormu from "@/app/kayit/kayit-formu";
import { useCeviri } from "./dil-saglayici";

/*
  Giriş sayfasındaki "Ücretsiz hesap oluştur" penceresi (02.11.2026, kurum
  sahibinin isteği). Eskiden düğme /kayit sayfasına gidiyordu; kullanıcı
  giriş ekranından ayrılıp ayrı bir sayfada formu dolduruyordu.

  Düğme yine bir BAĞLANTI olarak başlıyor (href="/kayit"): JavaScript
  yüklenmeden tıklanırsa kayıt sayfası açılır. Yüklenince tıklama
  pencereyi açar. Adres "?kayit=1" ile gelinirse pencere kendiliğinden
  açılır — e-postadan ya da reklamdan doğrudan kayda gelinebilsin.
*/
export default function KayitPenceresi({ acik: baslangicta = false }: { acik?: boolean }) {
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
        className="giris-kayit-dugme"
        onClick={(e) => {
          e.preventDefault();
          setAcik(true);
        }}
      >
        <UserPlus size={16} aria-hidden="true" />
        {t({ tr: "Ücretsiz hesap oluştur", en: "Create a free account" })}
      </a>
      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Ücretsiz deneme", en: "Free trial" })}
        title={t({ tr: "ArvoLab hesabı oluşturun", en: "Create your ArvoLab account" })}
        description={t({
          tr: "Birkaç bilgiyle başlayın; kart bilgisi istenmez.",
          en: "Start with a few details; no card required.",
        })}
      >
        <KayitFormu pencerede />
      </Dialog>
    </>
  );
}
