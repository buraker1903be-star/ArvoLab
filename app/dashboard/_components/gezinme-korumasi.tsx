"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { kaydiTamamla, korumaGerekliMi, uygulamaIciGecisMi } from "@/lib/gezinme-korumasi";
import Dialog from "./dialog";

/*
  GEZİNME KORUMASININ KABUK TARAFI (Signature OS 2.0 Aşama 2). Karar
  mantığı ve gerekçe: lib/gezinme-korumasi.ts.

  Üç giriş korunur:
    1. Uygulama içi her BAĞLANTI tıklaması (kenar çubuğu, çalışma bağlamı,
       konum yolu, panel bağlantıları): belgede yakalama evresinde, Next'in
       Link'inden ÖNCE dinlenir.
    2. Programatik geçişler (komut paleti, çalışma değiştirici): guvenliGit.
    3. data-gezinme-korumali işaretli formlar (çıkış): gönderim bekletilir.
  Koruma gerekmiyorsa (editör kapalı ya da her şey kaydedilmiş) hiçbirine
  dokunulmaz; tıklama olduğu gibi Next'e gider.

  Kapsam DIŞI ve bilerek: tarayıcının geri/ileri düğmesi. Next onu kendi
  dinliyor ve popstate engellenemiyor; orada editörün kapanırken taslak
  yazıp kaydı başlatması (manuscript-editor.tsx) eskisi gibi sürer.
  Sekme kapatma ve yenileme tarayıcının kendi uyarısıyla korunur.
*/

type Durum = { tur: "bos" } | { tur: "kaydediliyor" } | { tur: "hata"; devam: () => void };

let durum: Durum = { tur: "bos" };
const dinleyiciler = new Set<() => void>();
const durumYaz = (yeni: Durum) => {
  durum = yeni;
  dinleyiciler.forEach((d) => d());
};
const abone = (d: () => void) => {
  dinleyiciler.add(d);
  return () => dinleyiciler.delete(d);
};

/*
  Bekleyen bir geçiş varken ikinci bir tıklama yeni bir kayıt başlatmaz:
  aynı anda iki geçiş, iki ayrı sayfaya gidip birini yarıda bırakırdı.
*/
let suruyor = false;

async function koruyarakCalistir(devam: () => void) {
  if (!korumaGerekliMi()) {
    devam();
    return;
  }
  if (suruyor) return;
  suruyor = true;
  durumYaz({ tur: "kaydediliyor" });
  try {
    const sonuc = await kaydiTamamla();
    if (sonuc === "kaydedilemedi") {
      durumYaz({ tur: "hata", devam: () => void koruyarakCalistir(devam) });
      return;
    }
    durumYaz({ tur: "bos" });
    devam();
  } finally {
    suruyor = false;
  }
}

/** Programatik geçiş (komut paleti, çalışma değiştirici): kayıt bitmeden gitmez. */
export function useGuvenliGezinme() {
  const router = useRouter();
  return useCallback((href: string) => koruyarakCalistir(() => router.push(href)), [router]);
}

export default function GezinmeKorumasi() {
  const t = useCeviri();
  const router = useRouter();
  const simdiki = useSyncExternalStore(abone, () => durum, () => durum);

  useEffect(() => {
    const tiklama = (olay: MouseEvent) => {
      // Hızlı yol: kaydedilmemiş bir şey yoksa hiçbir tıklamaya dokunulmaz.
      if (!korumaGerekliMi() && !suruyor) return;
      const a = (olay.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const gecis = uygulamaIciGecisMi(
        {
          href: a.getAttribute("href"),
          target: a.getAttribute("target"),
          download: a.hasAttribute("download"),
          dugme: olay.button,
          ctrl: olay.ctrlKey,
          meta: olay.metaKey,
          shift: olay.shiftKey,
          alt: olay.altKey,
          engellendi: olay.defaultPrevented,
        },
        window.location,
      );
      if (!gecis) return;
      olay.preventDefault();
      olay.stopPropagation();
      const hedef = new URL(a.href, window.location.href);
      void koruyarakCalistir(() => router.push(`${hedef.pathname}${hedef.search}${hedef.hash}`));
    };
    const gonderim = (olay: SubmitEvent) => {
      const form = olay.target as HTMLFormElement | null;
      if (!form?.hasAttribute?.("data-gezinme-korumali")) return;
      if (form.dataset.korumaGecti === "1") {
        delete form.dataset.korumaGecti;
        return;
      }
      if (!korumaGerekliMi()) return;
      olay.preventDefault();
      olay.stopPropagation();
      void koruyarakCalistir(() => {
        form.dataset.korumaGecti = "1";
        form.requestSubmit();
      });
    };
    document.addEventListener("click", tiklama, true);
    document.addEventListener("submit", gonderim, true);
    return () => {
      document.removeEventListener("click", tiklama, true);
      document.removeEventListener("submit", gonderim, true);
    };
  }, [router]);

  return (
    <>
      {simdiki.tur === "kaydediliyor" ? (
        <p className="gecis-durumu" role="status">
          {t({ tr: "Son değişiklikler kaydediliyor; kayıt bitince geçilecek…", en: "Saving your latest changes; you'll move on once saved…" })}
        </p>
      ) : null}
      <Dialog
        open={simdiki.tur === "hata"}
        onClose={() => durumYaz({ tur: "bos" })}
        title={t({ tr: "Son değişiklikler kaydedilemedi", en: "Your latest changes couldn't be saved" })}
        description={t({
          tr: "Metniniz sunucuya yazılamadığı için sayfadan ayrılmanız durduruldu. Değişiklikler bu tarayıcıda taslak olarak tutuluyor. Bağlantınızı kontrol edin; oturumunuz kapandıysa başka bir sekmede giriş yapıp yeniden deneyin.",
          en: "Leaving the page was stopped because your text couldn't be saved to the server. Your changes are kept as a draft in this browser. Check your connection; if your session ended, sign in on another tab and try again.",
        })}
      >
        <div className="gecis-hatasi-eylemler">
          <button
            type="button"
            className="projects-primary-button"
            onClick={() => {
              if (simdiki.tur === "hata") {
                const devam = simdiki.devam;
                durumYaz({ tur: "bos" });
                devam();
              }
            }}
          >
            {t({ tr: "Kaydetmeyi yeniden dene", en: "Try saving again" })}
          </button>
          <button type="button" className="projects-filter-button" onClick={() => durumYaz({ tur: "bos" })}>
            {t({ tr: "Sayfada kal", en: "Stay on this page" })}
          </button>
        </div>
      </Dialog>
    </>
  );
}
