"use client";

import { useState, useTransition } from "react";
import { Copy, FileDown, FileText, Link2, Mail, MessageCircle } from "lucide-react";
import { createShareLink } from "@/app/actions/share-links";
import { danismanMesaji, epostaAdresi, whatsappAdresi } from "@/lib/danismana-gonder";
import { showToast } from "./toast-events";
import { wordDosyasiniIndir } from "./word-indir";
import TeslimPaketi from "./teslim-paketi";
import AracMenusu from "./acilir-menu";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  DANIŞMANIMA GÖNDER (bireysel abonenin ana sayfası, 26.10.2026).

  Danışmanın ArvoLab'da yorum yazabilmesi için kurumun abone olması
  gerekiyor. Bireysel abonenin danışmanı sistemde değil; bu kartta
  "Danışman yorumları" hep boş kalırdı. Onun yerine öğrencinin gerçekten
  yaptığı iş: metni danışmana göndermek. Üç yol, hepsi zaten vardı ama
  editörün menülerine dağılmıştı:

  1. Salt okunur bağlantı (önerilen): danışman giriş yapmadan son
     kaydedilmiş metni okur; açtığında öğrenciye bildirim gelir ve kaç
     kez açtığı burada görünür. WhatsApp'ta ya da e-postada metni hazır
     açılır — gönderen öğrencinin kendisi, sunucudan mesaj çıkmıyor.
  2. Word dosyası: danışman değişiklik izleyerek düzeltecekse.
  3. PDF: yazdırma sayfası açılır, "PDF olarak kaydet" seçilir.

  Bağlantı 30 gün geçerli: bir danışman turu için yeterli, süresi dolan
  bağlantı kendiliğinden kapanıyor. Daha uzun ya da kısa süre ve iptal
  editördeki Paylaş penceresinde.
*/

export type SonGonderim = {
  olusturuldu: string;
  sonAcilis: string | null;
  acilmaSayisi: number;
  bitis: string;
} | null;

const GUN = 30;

export default function DanismanaGonder({
  projectId,
  baslik,
  sonGonderim,
  sonGonderimMetni,
}: {
  projectId: string;
  baslik: string;
  sonGonderim: SonGonderim;
  /** Sunucuda kurulmuş durum cümlesi ("3 kez açıldı · son 2 saat önce"). */
  sonGonderimMetni: string | null;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [baglanti, setBaglanti] = useState<string | null>(null);
  const [bekleniyor, basla] = useTransition();
  const [wordHazirlaniyor, setWordHazirlaniyor] = useState(false);

  const mesaj = danismanMesaji({ baslik, url: baglanti, gun: GUN }, dil);

  const olustur = () =>
    basla(async () => {
      const sonuc = await createShareLink(projectId, { days: GUN, label: t({ tr: "Danışmanım", en: "My advisor" }) });
      if (sonuc.error || !sonuc.url) {
        showToast("error", sonuc.error ?? t({ tr: "Bağlantı oluşturulamadı.", en: "Could not create the link." }));
        return;
      }
      setBaglanti(sonuc.url);
    });

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(mesaj);
      showToast("success", t({ tr: "Mesaj ve bağlantı panoya kopyalandı.", en: "Message and link copied to the clipboard." }));
    } catch {
      showToast("error", t({ tr: "Kopyalanamadı; bağlantıyı seçip elle kopyalayın.", en: "Couldn't copy; select the link and copy it manually." }));
    }
  };

  const wordIndir = async () => {
    setWordHazirlaniyor(true);
    try {
      const hata = await wordDosyasiniIndir(projectId, dil);
      if (hata) showToast("error", hata);
    } finally {
      setWordHazirlaniyor(false);
    }
  };

  return (
    <article className="gb-kart gb-sutun">
      <header className="gb-kart-bas">
        <div>
          <h2>{t({ tr: "Danışmanıma gönder", en: "Send to my advisor" })}</h2>
          <p>{sonGonderim && sonGonderimMetni ? sonGonderimMetni : t({ tr: "Metninizin son kaydedilmiş hâli", en: "The last saved version of your text" })}</p>
        </div>
      </header>

      {baglanti ? (
        <div className="danisman-gonder">
          <p className="danisman-baglanti" title={baglanti}>
            <Link2 size={14} aria-hidden="true" /> {baglanti}
          </p>
          <div className="danisman-dugmeler">
            <a className="projects-primary-button button-compact" href={whatsappAdresi(mesaj)} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> WhatsApp
            </a>
            <a className="projects-filter-button button-compact" href={epostaAdresi(t({ tr: `Tez taslağı: ${baslik}`, en: `Thesis draft: ${baslik}` }), mesaj)}>
              <Mail size={15} aria-hidden="true" /> {t({ tr: "E-posta", en: "Email" })}
            </a>
            <button type="button" className="projects-filter-button button-compact" onClick={kopyala}>
              <Copy size={15} aria-hidden="true" /> {t({ tr: "Kopyala", en: "Copy" })}
            </button>
          </div>
          <p className="muted text-sm">
            {t({
              tr: `Alan herkes okuyabilir, düzenleyemez · ${GUN} gün geçerli`,
              en: `Anyone with the link can read, not edit · valid for ${GUN} days`,
            })}
          </p>
        </div>
      ) : (
        <div className="danisman-gonder">
          {/* İkincil: ana sayfanın tek ana eylemi "Yazmaya devam et" (Phase 3). */}
          <button type="button" className="projects-filter-button button-compact" onClick={olustur} disabled={bekleniyor}>
            <Link2 size={15} aria-hidden="true" />
            {bekleniyor ? t({ tr: "Hazırlanıyor…", en: "Preparing…" }) : t({ tr: "Okuma bağlantısı oluştur", en: "Create read-only link" })}
          </button>
          <p className="muted text-sm">
            {t({
              tr: "Danışmanınız giriş yapmadan okur; açınca size bildirim gelir.",
              en: "Your advisor reads it without signing in; you get a notification when they open it.",
            })}
          </p>
        </div>
      )}

      {/*
        DOSYA OLARAK TEK MENÜDE (Premium Simplicity Aşama 2, 08.11.2026).
        Eskiden "Dosya olarak:" etiketi ve üç ayrı düğme (Word, PDF, ZIP +
        kaynaklar) ile altında kurum notu vardı: kart beş denetim ve iki
        açıklama taşıyordu. Üç çıktı aynı, tek ikincil menüde. "Danışmanın
        yorum yazması için kurumunuzun ArvoLab kullanması gerekir" notu
        kalktı: bir karar ya da eylem doğurmuyordu.
      */}
      <div className="danisman-dosyalar">
        <AracMenusu
          dugmeSinifi="projects-filter-button button-compact"
          ikon={<FileDown size={14} aria-hidden="true" />}
          etiket={t({ tr: "Dosya olarak gönder", en: "Send as a file" })}
          aciklama={t({ tr: "Word, PDF ya da kaynaklarıyla ZIP", en: "Word, PDF or ZIP with sources" })}
        >
          <button type="button" className="arac-menu-oge" onClick={wordIndir} disabled={wordHazirlaniyor}>
            <FileDown size={16} aria-hidden="true" /> <span>{wordHazirlaniyor ? t({ tr: "Hazırlanıyor…", en: "Preparing…" }) : t({ tr: "Word (.docx)", en: "Word (.docx)" })}</span>
          </button>
          <a className="arac-menu-oge" href={`/print/manuscript/${projectId}?auto=1`} target="_blank" rel="noopener noreferrer">
            <FileText size={16} aria-hidden="true" /> <span>PDF</span>
          </a>
          <TeslimPaketi projectId={projectId} className="arac-menu-oge" etiket={t({ tr: "ZIP + kaynaklar", en: "ZIP + sources" })} />
        </AracMenusu>
      </div>
    </article>
  );
}
