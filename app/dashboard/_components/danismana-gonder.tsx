"use client";

import { useState, useTransition } from "react";
import { Copy, FileDown, FileText, Link2, Mail, MessageCircle } from "lucide-react";
import { createShareLink } from "@/app/actions/share-links";
import { danismanMesaji, epostaAdresi, whatsappAdresi } from "@/lib/danismana-gonder";
import { showToast } from "./toast-events";
import { wordDosyasiniIndir } from "./word-indir";

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
  const [baglanti, setBaglanti] = useState<string | null>(null);
  const [bekleniyor, basla] = useTransition();
  const [wordHazirlaniyor, setWordHazirlaniyor] = useState(false);

  const mesaj = danismanMesaji({ baslik, url: baglanti, gun: GUN });

  const olustur = () =>
    basla(async () => {
      const sonuc = await createShareLink(projectId, { days: GUN, label: "Danışmanım" });
      if (sonuc.error || !sonuc.url) {
        showToast("error", sonuc.error ?? "Bağlantı oluşturulamadı.");
        return;
      }
      setBaglanti(sonuc.url);
    });

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(mesaj);
      showToast("success", "Mesaj ve bağlantı panoya kopyalandı.");
    } catch {
      showToast("error", "Kopyalanamadı; bağlantıyı seçip elle kopyalayın.");
    }
  };

  const wordIndir = async () => {
    setWordHazirlaniyor(true);
    try {
      const hata = await wordDosyasiniIndir(projectId);
      if (hata) showToast("error", hata);
    } finally {
      setWordHazirlaniyor(false);
    }
  };

  return (
    <article className="gb-kart gb-sutun">
      <header className="gb-kart-bas">
        <div>
          <h2>Danışmanıma gönder</h2>
          <p>{sonGonderim && sonGonderimMetni ? sonGonderimMetni : "Metninizin son kaydedilmiş hâli"}</p>
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
            <a className="projects-filter-button button-compact" href={epostaAdresi(`Tez taslağı: ${baslik}`, mesaj)}>
              <Mail size={15} aria-hidden="true" /> E-posta
            </a>
            <button type="button" className="projects-filter-button button-compact" onClick={kopyala}>
              <Copy size={15} aria-hidden="true" /> Kopyala
            </button>
          </div>
          <p className="muted text-sm">Alan herkes okuyabilir, düzenleyemez · {GUN} gün geçerli</p>
        </div>
      ) : (
        <div className="danisman-gonder">
          <button type="button" className="projects-primary-button button-compact" onClick={olustur} disabled={bekleniyor}>
            <Link2 size={15} aria-hidden="true" />
            {bekleniyor ? "Hazırlanıyor…" : "Okuma bağlantısı oluştur"}
          </button>
          <p className="muted text-sm">Danışmanınız giriş yapmadan okur; açınca size bildirim gelir.</p>
        </div>
      )}

      <div className="danisman-dosyalar">
        <span className="muted text-sm">Dosya olarak:</span>
        <button type="button" className="projects-filter-button button-compact" onClick={wordIndir} disabled={wordHazirlaniyor}>
          <FileDown size={14} aria-hidden="true" /> {wordHazirlaniyor ? "Hazırlanıyor…" : "Word"}
        </button>
        <a className="projects-filter-button button-compact" href={`/print/manuscript/${projectId}?auto=1`} target="_blank" rel="noopener noreferrer">
          <FileText size={14} aria-hidden="true" /> PDF
        </a>
      </div>

      <p className="danisman-not">Danışmanın metninize yorum yazması için kurumunuzun ArvoLab kullanması gerekir.</p>
    </article>
  );
}
