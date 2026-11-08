"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { kaydiTamamla, korumaGerekliMi, koruyucuDurumu, uygulamaIciGecisMi } from "@/lib/gezinme-korumasi";
import Dialog from "./dialog";
import { showToast } from "./toast-events";
import { bekleyenleriGonder, devirAbone, devirler, yenidenDene, type DevirDurumu } from "@/lib/bekleyen-kayit";
import { TASLAK_GUVENDE_METIN, TASLAK_YAZILAMADI_METIN } from "@/lib/taslak-durumu";

const BOS_LISTE: readonly DevirDurumu[] = [];

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

  Tarayıcının geri/ileri düğmesi DURDURULAMAZ (Next popstate'i kendisi
  işliyor, olay iptal edilemiyor). Orada kayıt KABUĞA DEVREDİLİR
  (lib/bekleyen-kayit.ts): editör kapanırken içeriğin anlık görüntüsünü
  bırakır, bu bileşen gezinme bitince gönderir, düşerse kalıcı uyarı
  gösterir (BekleyenKayitlar, aşağıda). Sekme kapatma ve yenileme
  tarayıcının kendi uyarısıyla ve tarayıcı taslağıyla korunur.
*/

type Durum = { tur: "bos" } | { tur: "kaydediliyor" } | { tur: "hata"; devam: () => void; taslakYazildi: boolean; neden: string | null };

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
      durumYaz({ tur: "hata", devam: () => void koruyarakCalistir(devam), ...koruyucuDurumu() });
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
      <BekleyenKayitlar />
      {simdiki.tur === "kaydediliyor" ? (
        <p className="gecis-durumu" role="status">
          {t({ tr: "Son değişiklikler kaydediliyor; kayıt bitince geçilecek…", en: "Saving your latest changes; you'll move on once saved…" })}
        </p>
      ) : null}
      {/*
        Aşama 2.1 (P2): açıklama başlık bölümünden gövdeye alındı; başlık
        ile düğmeler arasındaki boş gövde kalktı. Taslak cümlesi taslağın
        GERÇEK durumundan (lib/taslak-durumu.ts), neden sunucudan. Kapatma
        (×, Esc) ve "Sayfada kal" aynı şey: editörde kalınır, hiçbir şey
        silinmez; kayıtsız ayrılma seçeneği bilerek yok.
      */}
      <Dialog
        open={simdiki.tur === "hata"}
        onClose={() => durumYaz({ tur: "bos" })}
        title={t({ tr: "Son değişiklikler kaydedilemedi", en: "Your latest changes couldn't be saved" })}
      >
        {simdiki.tur === "hata" ? (
          <div className="gecis-hatasi">
            <p>
              {simdiki.neden ? `${simdiki.neden.replace(/[.!?]?\s*$/, ".")} ` : ""}
              {t({ tr: "Kayıt tamamlanmadığı için sayfadan ayrılmadınız; metniniz editörde.", en: "You haven't left the page because saving didn't finish; your text is in the editor." })}
            </p>
            <p className={simdiki.taslakYazildi ? "gecis-hatasi-not" : "gecis-hatasi-not gecis-hatasi-dikkat"}>
              {t(simdiki.taslakYazildi ? TASLAK_GUVENDE_METIN : TASLAK_YAZILAMADI_METIN)}
            </p>
            <div className="gecis-hatasi-eylemler">
              <button
                type="button"
                className="projects-primary-button"
                onClick={() => {
                  const devam = simdiki.devam;
                  durumYaz({ tur: "bos" });
                  devam();
                }}
              >
                {t({ tr: "Kaydetmeyi yeniden dene", en: "Try saving again" })}
              </button>
              <button type="button" className="projects-filter-button" onClick={() => durumYaz({ tur: "bos" })}>
                {t({ tr: "Sayfada kal", en: "Stay on this page" })}
              </button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/*
  DEVREDİLEN KAYITLAR (Aşama 2.1). Sayfa değişince editör yok; kayıt
  işini burada, gezinme BİTTİKTEN sonra göndeririz: bağlantıyla geçişte
  gezinme sürerken başlatılan kayıt sunucuya ulaşmıyordu (Aşama 2,
  ölçüldü); geçiş bittikten sonra gönderilen kayıt o yarışa girmiyor. Kayıt
  sürerken bir durum satırı, düşerse kalıcı bir uyarı (role=alert): uyarı
  kayıt olana ya da kullanıcı çalışmaya dönüp editör taslağı devralana
  kadar kalkmaz — kapatma düğmesi bilerek yok, sessiz kayıp olmasın.
*/
function BekleyenKayitlar() {
  const t = useCeviri();
  const yol = usePathname();
  const liste = useSyncExternalStore(devirAbone, devirler, () => BOS_LISTE);
  const onceki = useRef<readonly DevirDurumu[]>(BOS_LISTE);

  useEffect(() => {
    if (!liste.some((d) => d.durum === "bekliyor")) return;
    // Bir tık sonra: geçişin kendi işleri (Next'in eylem kuyruğu) bitsin.
    const z = window.setTimeout(() => void bekleyenleriGonder(), 250);
    return () => window.clearTimeout(z);
  }, [liste, yol]);

  // Gönderilip listeden düşen devir: kısa bir başarı bildirimi.
  useEffect(() => {
    for (const d of onceki.current) {
      if (d.durum === "gonderiliyor" && !liste.some((x) => x.anahtar === d.anahtar)) {
        showToast("success", t({ tr: `${d.baslik || "Çalışma"}: son değişiklikler kaydedildi.`, en: `${d.baslik || "Work"}: your latest changes were saved.` }));
      }
    }
    onceki.current = liste;
  }, [liste, t]);

  if (!liste.length) return null;
  return (
    <div className="devir-uyarilari">
      {liste.map((d) =>
        d.durum === "hata" ? (
          <section key={d.anahtar} className="devir-uyari" role="alert" aria-label={t({ tr: "Kaydedilemeyen değişiklikler", en: "Unsaved changes" })}>
            <p className="devir-uyari-baslik">
              <b>{d.baslik || t({ tr: "Çalışma", en: "Work" })}</b>
              {t({ tr: ": son değişiklikler sunucuya kaydedilemedi.", en: ": the latest changes couldn't be saved to the server." })}
            </p>
            <p className="devir-uyari-metin">
              {d.neden ? `${d.neden.replace(/[.!?]?\s*$/, ".")} ` : ""}
              {t(d.taslakYazildi ? TASLAK_GUVENDE_METIN : TASLAK_YAZILAMADI_METIN)}{" "}
              {d.taslakYazildi
                ? t({ tr: "Çalışmaya dönünce geri yüklemeniz önerilir.", en: "When you return to the work, you'll be offered to restore it." })
                : ""}
            </p>
            <div className="devir-uyari-eylemler">
              <button type="button" className="projects-primary-button button-compact" onClick={() => yenidenDene(d.anahtar)}>
                {t({ tr: "Yeniden dene", en: "Try again" })}
              </button>
              <Link href={d.adres} className="projects-filter-button button-compact">
                {t({ tr: "Çalışmaya dön", en: "Back to the work" })}
              </Link>
            </div>
          </section>
        ) : (
          <p key={d.anahtar} className="devir-durum" role="status">
            {t({ tr: `${d.baslik || "Çalışma"}: son değişiklikler kaydediliyor…`, en: `${d.baslik || "Work"}: saving your latest changes…` })}
          </p>
        ),
      )}
    </div>
  );
}
