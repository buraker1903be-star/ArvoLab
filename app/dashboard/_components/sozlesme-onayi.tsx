"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, LogOut } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { kullanimSozlesmesi, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { sozlesmeyiOnayla } from "@/app/actions/sozlesme";

/*
  KULLANIM SÖZLEŞMESİ ONAY PENCERESİ (29.10.2026, kurum sahibinin isteği).

  Kapatılamaz: Esc, arka plana tıklama ya da kapatma düğmesi yok. İki çıkış
  var: sonuna kadar okuyup onaylamak ya da onaylamayıp oturumu kapatmak.
  "Okudum ve onaylıyorum" düğmesi metnin SONUNA kaydırılmadan etkinleşmez
  (kısa ekranda metin baştan sığarsa hemen etkin). Kaydırmanın tamamlandığı
  bilgisi sunucuya gider ve kayda yazılır; IP, cihaz ve zaman sunucuda
  okunur (app/actions/sozlesme.ts).

  Arka plandaki panel bu pencere açıkken etkisizdir (layout'ta inert).
*/
export default function SozlesmeOnayi({ olay, cikis }: { olay: "giris" | "odeme_sonrasi"; cikis: () => Promise<void> }) {
  const t = useCeviri();
  const dil = useDil();
  const router = useRouter();
  const metin = kullanimSozlesmesi(dil);
  const baslikId = useId();
  const kutu = useRef<HTMLDivElement>(null);
  const [okundu, setOkundu] = useState(false);
  const [ilerleme, setIlerleme] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const olc = useCallback(() => {
    const k = kutu.current;
    if (!k) return;
    const kalan = k.scrollHeight - k.clientHeight - k.scrollTop;
    const oran = k.scrollHeight <= k.clientHeight ? 1 : k.scrollTop / (k.scrollHeight - k.clientHeight);
    setIlerleme(Math.min(100, Math.round(oran * 100)));
    // Bir kez sona ulaşan kullanıcı geri kaydırsa da okumuş sayılır.
    if (kalan <= 8) setOkundu(true);
  }, []);

  useEffect(() => {
    olc();
    kutu.current?.focus();
    // Pencere boyutu değişince (telefon döndürme) metin sığabilir.
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, [olc]);

  const onayla = () => {
    setHata(null);
    basla(async () => {
      const sonuc = await sozlesmeyiOnayla({ dil, kaydirmaTamamlandi: okundu, olay });
      if ("error" in sonuc) setHata(sonuc.error);
      else router.refresh();
    });
  };

  return (
    <div className="sozlesme-onay-kok">
      <div className="sozlesme-onay-arka" aria-hidden="true" />
      <section className="sozlesme-onay" role="dialog" aria-modal="true" aria-labelledby={baslikId}>
        <header className="sozlesme-onay-baslik">
          <FileCheck2 size={20} aria-hidden="true" />
          <div>
            <h2 id={baslikId}>{metin.baslik}</h2>
            <p>
              {olay === "odeme_sonrasi"
                ? t({
                    tr: "Ödemeniz alındı. Hizmetin kullanıma açılması için sözleşmeyi sonuna kadar okuyup onaylayın.",
                    en: "Your payment has been received. To start using the service, read the agreement to the end and approve it.",
                  })
                : t({
                    tr: "ArvoLab'ı kullanmaya devam etmek için sözleşmeyi sonuna kadar okuyup onaylayın.",
                    en: "To continue using ArvoLab, read the agreement to the end and approve it.",
                  })}
            </p>
          </div>
        </header>

        <div
          ref={kutu}
          className="sozlesme-onay-metin"
          tabIndex={0}
          onScroll={olc}
          aria-label={t({ tr: "Sözleşme metni", en: "Agreement text" })}
        >
          <p className="sozlesme-onay-giris">{metin.giris}</p>
          {metin.bolumler.map((b) => (
            <section key={b.baslik}>
              <h3>{b.baslik}</h3>
              {b.paragraflar.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </section>
          ))}
          <p className="sozlesme-onay-son">{t({ tr: `Sözleşmenin sonu · Sürüm ${SOZLESME_SURUMU}`, en: `End of agreement · Version ${SOZLESME_SURUMU}` })}</p>
        </div>

        <div className="sozlesme-onay-ilerleme" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={okundu ? 100 : ilerleme} aria-label={t({ tr: "Okuma ilerlemesi", en: "Reading progress" })}>
          <span data-deger={okundu ? 100 : Math.round(ilerleme / 10) * 10} />
        </div>

        <footer className="sozlesme-onay-alt">
          <p className="sozlesme-onay-not" aria-live="polite">
            {okundu
              ? t({
                  tr: "Onay; tarih-saat, IP adresi ve cihaz bilgisiyle kaydedilir ve bir kopyası e-postanıza gönderilir.",
                  en: "Your approval is recorded with date and time, IP address and device information, and a copy is sent to your email.",
                })
              : t({ tr: "Onaylamak için metni sonuna kadar kaydırın.", en: "Scroll to the end of the text to approve." })}
          </p>
          {hata ? (
            <p className="alert" data-tone="danger" role="alert">
              {hata}
            </p>
          ) : null}
          <div className="sozlesme-onay-dugmeler">
            <form action={cikis}>
              <button type="submit" className="projects-filter-button" disabled={bekliyor}>
                <LogOut size={15} aria-hidden="true" /> {t({ tr: "Onaylamıyorum, çıkış yap", en: "I don't agree, sign out" })}
              </button>
            </form>
            <button type="button" className="projects-primary-button" disabled={!okundu || bekliyor} onClick={onayla} aria-disabled={!okundu || bekliyor}>
              {bekliyor ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : t({ tr: "Okudum ve onaylıyorum", en: "I have read and agree" })}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
