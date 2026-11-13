"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Info, Link2, LoaderCircle, Search } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { doiIleEkle } from "@/app/actions/kaynak-aktarim";
import { normalizeDoi } from "@/lib/doi";
import { YEREL } from "@/lib/dil";
import { yenilenmeSaati } from "@/lib/doi-toplu";

/*
  DOI İLE KAYNAK EKLE — GÖRÜNÜR KUTU (Phase 3, 04.11.2026).

  DOI ile ekleme vardı ama "İçe aktar" penceresinin içindeydi; o ad
  Zotero dosyası çağrıştırıyor, öğrenci DOI'yi orada aramıyordu. Üstelik
  oradaki düğme kutu boşken "DOI bulunamadı" yazıyordu: hiçbir şey
  yazmamış kullanıcıya hata gibi görünüyordu. Artık Kaynaklar'ın
  literatür kartında, listenin hemen üstünde tek satır.

  Ekleme mevcut doiIleEkle ile (Crossref, aynı DOI'ye ikinci kayıt yok,
  abonelik kapısı orada). Her sonucun ayrı durumu var: eklendi (başlıkla),
  bu çalışmada zaten var, Crossref'te bulunamadı, Crossref'e ulaşılamadı.
  Bulunamadığında ya da kutuya DOI olmayan bir şey yazıldığında "Konu ya
  da başlıkla ara" düğmesi "Kaynak bul" penceresini açar (OpenAlex ve
  Crossref'te arama; elle ekleme de orada).

  Ctrl+K'dan gelinirse (?doi=…) kutu dolu, (?ekle=1) odaklı açılır; EKLEME
  KENDİLİĞİNDEN YAPILMAZ: sayfa yenilenince ya da bağlantı paylaşılınca
  habersiz kaynak eklenmesin.
*/
type Durum =
  | { tur: "bos" }
  | { tur: "bekliyor" }
  | { tur: "eklendi"; baslik: string }
  | { tur: "vardi" }
  | { tur: "bulunamadi" }
  /* T3: ortak saatlik DOI hakkı (saatte 120) doldu; ne zaman yenileneceği. */
  | { tur: "hak"; saat: string | null }
  /* Aynı başlık ve yıl bu çalışmada var (DOI farklı): eklenmedi, birleştirilmedi. */
  | { tur: "vardi_baslik"; baslik?: string }
  | { tur: "hata"; mesaj?: string };

export default function DoiEkleKutusu({
  projectId,
  ilkDeger = "",
  odakla = false,
  aramaTetikleyicisi,
}: {
  projectId: string;
  ilkDeger?: string;
  odakla?: boolean;
  /** "Kaynak bul" düğmesinin seçicisi: konu araması o pencerede. */
  aramaTetikleyicisi: string;
}) {
  const t = useCeviri();
  const dil = useDil();
  const router = useRouter();
  const [deger, setDeger] = useState(ilkDeger);
  const [durum, setDurum] = useState<Durum>({ tur: "bos" });
  const kutu = useRef<HTMLInputElement>(null);
  const doi = normalizeDoi(deger);
  const yazili = deger.trim().length > 0;

  const konuylaAra = () => document.querySelector<HTMLButtonElement>(aramaTetikleyicisi)?.click();

  const ekle = async () => {
    if (!doi) return;
    setDurum({ tur: "bekliyor" });
    try {
      const r = await doiIleEkle(projectId, [doi]);
      if (r.error) return setDurum({ tur: "hata", mesaj: r.error });
      const s = r.sonuclar?.[0];
      if (!s) return setDurum({ tur: "hata" });
      if (s.durum === "eklendi") {
        setDurum({ tur: "eklendi", baslik: s.baslik ?? doi });
        setDeger("");
        router.refresh();
      } else if (s.durum === "vardi") setDurum({ tur: "vardi" });
      else if (s.durum === "vardi_baslik") setDurum({ tur: "vardi_baslik", baslik: s.baslik });
      else if (s.durum === "bulunamadi") setDurum({ tur: "bulunamadi" });
      else if (s.durum === "ertelendi" && s.neden === "hak") setDurum({ tur: "hak", saat: yenilenmeSaati(r.ozet?.yenilenme, YEREL[dil]) });
      // kaydedilemedi, hata, süre: yeniden denenebilir; kayıt hatasında sunucunun mesajı.
      else setDurum({ tur: "hata", mesaj: s.durum === "kaydedilemedi" ? r.error : undefined });
    } catch {
      setDurum({ tur: "hata" });
    }
  };

  return (
    <form
      className="doi-kutusu"
      onSubmit={(olay) => {
        olay.preventDefault();
        void ekle();
      }}
    >
      <label className="doi-kutusu-satir">
        <span className="sr-only">{t({ tr: "DOI ile kaynak ekle", en: "Add a source by DOI" })}</span>
        <Link2 size={16} aria-hidden="true" />
        <input
          ref={kutu}
          // Ctrl+K'dan "Kaynak ekle" ile gelindiyse kutu doğrudan yazmaya hazır.
          autoFocus={odakla}
          value={deger}
          onChange={(olay) => {
            setDeger(olay.target.value);
            if (durum.tur !== "bekliyor") setDurum({ tur: "bos" });
          }}
          placeholder={t({ tr: "DOI yapıştırın — ör. 10.1002/jae.616 ya da doi.org bağlantısı", en: "Paste a DOI — e.g. 10.1002/jae.616 or a doi.org link" })}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="doi-kutusu-durum"
        />
        <button type="submit" className="projects-primary-button button-compact" disabled={!doi || durum.tur === "bekliyor"}>
          {durum.tur === "bekliyor" ? t({ tr: "Ekleniyor…", en: "Adding…" }) : t({ tr: "Ekle", en: "Add" })}
        </button>
      </label>

      <div id="doi-kutusu-durum" className="doi-kutusu-durum" role="status" aria-live="polite">
        {durum.tur === "bekliyor" ? (
          <p data-tone="neutral">
            <LoaderCircle size={14} className="doi-kutusu-donen" aria-hidden="true" />
            {t({ tr: "Künye Crossref'ten getiriliyor…", en: "Fetching the reference from Crossref…" })}
          </p>
        ) : durum.tur === "eklendi" ? (
          <p data-tone="success">
            <CircleCheck size={14} aria-hidden="true" />
            <span>
              {t({ tr: "Eklendi: ", en: "Added: " })}
              <b>{durum.baslik}</b>
              {t({ tr: " — listede “Okunacak” olarak.", en: " — in the list as “To read”." })}
            </span>
          </p>
        ) : durum.tur === "vardi" ? (
          <p data-tone="info">
            <Info size={14} aria-hidden="true" />
            {t({ tr: "Bu kaynak bu çalışmada zaten var.", en: "This source is already in this work." })}
          </p>
        ) : durum.tur === "bulunamadi" ? (
          <p data-tone="warning">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{t({ tr: "Bu DOI Crossref'te bulunamadı. Yazımını kontrol edin ya da kaynağı konu veya başlıkla arayın.", en: "This DOI wasn't found in Crossref. Check how it's written, or search for the source by topic or title." })}</span>
            <button type="button" className="projects-filter-button button-compact" onClick={konuylaAra}>
              <Search size={14} aria-hidden="true" /> {t({ tr: "Konu ya da başlıkla ara", en: "Search by topic or title" })}
            </button>
          </p>
        ) : durum.tur === "hak" ? (
          <p data-tone="warning">
            <CircleAlert size={14} aria-hidden="true" />
            <span>
              {durum.saat
                ? t({ tr: `Saatlik DOI hakkınız doldu (yenilenme saati: ${durum.saat}). Kaynağı elle de ekleyebilirsiniz.`, en: `You've reached your hourly DOI limit; it resets at ${durum.saat}. You can also add the source manually.` })
                : t({ tr: "Saatlik DOI hakkınız doldu; biraz sonra yeniden deneyin. Kaynağı elle de ekleyebilirsiniz.", en: "You've reached your hourly DOI limit; try again a little later. You can also add the source manually." })}
            </span>
          </p>
        ) : durum.tur === "vardi_baslik" ? (
          <p data-tone="info">
            <Info size={14} aria-hidden="true" />
            <span>
              {t({ tr: "Bu çalışmada aynı başlık ve yılı taşıyan bir kaynak zaten var; DOI farklı olduğu için birleştirilmedi ve eklenmedi", en: "A source with the same title and year is already in this work; since the DOI differs it wasn't merged or added" })}
              {durum.baslik ? <>: <b>{durum.baslik}</b></> : null}.
            </span>
          </p>
        ) : durum.tur === "hata" ? (
          <p data-tone="danger">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{durum.mesaj ?? t({ tr: "Crossref'e şu an ulaşılamadı. Biraz sonra yeniden deneyin.", en: "Couldn't reach Crossref right now. Try again shortly." })}</span>
            {durum.mesaj ? null : (
              <button type="submit" className="projects-filter-button button-compact">
                {t({ tr: "Yeniden dene", en: "Try again" })}
              </button>
            )}
          </p>
        ) : yazili && !doi ? (
          <p data-tone="neutral">
            <Info size={14} aria-hidden="true" />
            <span>{t({ tr: "Bu bir DOI'ye benzemiyor (DOI “10.” ile başlar).", en: "This doesn't look like a DOI (DOIs start with “10.”)." })}</span>
            <button type="button" className="projects-filter-button button-compact" onClick={konuylaAra}>
              <Search size={14} aria-hidden="true" /> {t({ tr: "Konu ya da başlıkla ara", en: "Search by topic or title" })}
            </button>
          </p>
        ) : null}
      </div>
    </form>
  );
}
