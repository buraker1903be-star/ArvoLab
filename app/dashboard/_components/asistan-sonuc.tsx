"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { CircleAlert, Copy, CreditCard, History, Info, Lightbulb, Play, RotateCcw } from "lucide-react";
import { showToast } from "./toast-events";
import { asistanGecmisim } from "@/app/actions/ai-gecmis";
import type { GecmisKaydi } from "@/lib/ai/gecmis";
import type { Bulgu } from "@/lib/ai/bulgu";
import type { YetenekAdi } from "@/lib/ai/kayit-gorunum";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import AsistanPuan from "./asistan-puan";

/*
  Asistan sonucunun ortak görünümü. Üç yetenek de aynı bileşeni kullanıyor:
  daha önce her sayfa kendi işaretlemesini taşıyordu, bulgu kutusunun tonu
  ve boşlukları sayfadan sayfaya kayıyordu.

  Geçmiş burada duruyor çünkü asıl amacı sonuca bakarken "bunu zaten
  sormuştum" dedirtmek: kullanıcı aynı soruyu ikinci kez sordurmasın.
*/

const BULGU_TONU = { uyari: "danger", oneri: "warning", bilgi: "info" } as const;
const BULGU_IKONU = { uyari: CircleAlert, oneri: Lightbulb, bilgi: Info } as const;

export type Etiketler = { uyari: string; oneri: string; bilgi: string };

export type AsistanSonucVerisi = {
  hata?: string;
  /** Deneme hakkı bitti (lib/ai/erisim.ts): hata kutusunda Abonelik'e giden düğme. */
  odemeGerekli?: boolean;
  bulgular?: Bulgu[];
  aramalar?: string[];
  kirpilanlar?: string[];
  kayitId?: string | null;
  kayitliCevap?: { tarih: string } | null;
  /** Kredi azalıyor (lib/ai/erisim.ts). Eskiden kapıda hesaplanıp hiçbir yetenekte gösterilmiyordu. */
  krediUyarisi?: string;
};

function BulguListesi({
  bulgular,
  etiketler,
  eylem,
}: {
  bulgular: Bulgu[];
  etiketler: Etiketler;
  eylem?: (bulgu: Bulgu, sira: number) => ReactNode;
}) {
  return (
    <ul className="asistan-bulgular">
      {bulgular.map((bulgu, index) => {
        const Ikon = BULGU_IKONU[bulgu.tur];
        return (
        <li className="asistan-bulgu" data-tone={BULGU_TONU[bulgu.tur]} key={index}>
          <span className="asistan-bulgu-etiket">
            <Ikon size={13} aria-hidden="true" />
            {etiketler[bulgu.tur]}
          </span>
          <span className="asistan-bulgu-metin">
            <b>{bulgu.baslik}</b>
            {bulgu.aciklama}
          </span>
          {eylem ? <span className="asistan-bulgu-eylem">{eylem(bulgu, index)}</span> : null}
        </li>
        );
      })}
    </ul>
  );
}

function AramaListesi({ aramalar, onCalistir }: { aramalar: string[]; onCalistir?: (arama: string) => void }) {
  const t = useCeviri();
  return (
    <div className="asistan-bolum">
      <h4 className="asistan-bolum-baslik">{t({ tr: "Arama dizeleri", en: "Search strings" })}</h4>
      <ul className="asistan-aramalar">
        {aramalar.map((arama, index) => (
          <li key={index}>
            <code>{arama}</code>
            <span className="asistan-arama-eylem">
              {/* Kopyalamak, dizeyi Scholar ya da kütüphane veritabanına
                  taşımanın yolu; eskiden metni elle seçmek gerekiyordu. */}
              <button
                type="button"
                className="asistan-arama-calistir"
                aria-label={t({ tr: "Kopyala", en: "Copy" })}
                title={t({ tr: "Kopyala", en: "Copy" })}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(arama)
                    .then(() => showToast("success", t({ tr: "Arama dizesi kopyalandı.", en: "Search string copied." })))
                    .catch(() => showToast("error", t({ tr: "Kopyalanamadı.", en: "Couldn't copy." })))
                }
              >
                <Copy size={13} aria-hidden="true" />
              </button>
              {/* Dize kurup "şimdi bunu bir yere yapıştırın" demek işi yarıda
                  bırakıyordu; sayfanın kendi bulucusu varken tek tık yeter. */}
              {onCalistir && (
                <button type="button" className="asistan-arama-calistir" onClick={() => onCalistir(arama)}>
                  <Play size={12} aria-hidden="true" />
                  {t({ tr: "Çalıştır", en: "Run" })}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AsistanSonuc({
  sonuc,
  yetenek,
  etiketler,
  bulguBasligi,
  onYenidenSorgula,
  bekleniyor,
  onAramaCalistir,
  bulguEylemi,
  gecmisGizli = false,
}: {
  sonuc: AsistanSonucVerisi | null;
  yetenek: YetenekAdi;
  etiketler: Etiketler;
  bulguBasligi: string;
  /** "Yeniden sorgula": kayıtlı cevabı atlayıp modele gider. */
  onYenidenSorgula?: () => void;
  bekleniyor?: boolean;
  /** Verilirse her arama dizesinin yanında "Bu aramayı çalıştır" çıkar. */
  onAramaCalistir?: (arama: string) => void;
  /** Her bulgunun sağında çizilen düğme (Kaynakça: "Yapılacaklara ekle"). */
  bulguEylemi?: (bulgu: Bulgu, sira: number) => ReactNode;
  /** Geçmiş başka yerde gösteriliyorsa (Kaynakça penceresinin sol kartı). */
  gecmisGizli?: boolean;
}) {
  const t = useCeviri();
  const dil = useDil();
  const { tarihSaat } = useTarihler();
  const [gecmis, setGecmis] = useState<GecmisKaydi[] | null>(null);
  const [yukleniyor, basla] = useTransition();

  const bulgular = sonuc?.bulgular ?? [];
  const aramalar = sonuc?.aramalar ?? [];
  /* Bilerek boş liste (lib/ai/bulgu.ts, bosListeMi): asistan baktı, işaretlenecek bir şey bulmadı.
     Puanlanabilir bir sonuç; "yanlış alarm vermedi" de eğitim verisi. */
  const temiz = Boolean(sonuc && !sonuc.hata && sonuc.bulgular && sonuc.bulgular.length === 0 && aramalar.length === 0);
  const doluSonuc = bulgular.length > 0 || aramalar.length > 0 || temiz;

  return (
    <>
      {sonuc?.hata && (
        <p className="asistan-uyari" data-tone="danger" role="alert">
          {sonuc.hata}
          {sonuc.odemeGerekli ? (
            <>
              {" "}
              <Link href="/dashboard/abonelik" className="projects-primary-button button-compact">
                <CreditCard size={14} aria-hidden="true" /> {t({ tr: "Aboneliği başlat", en: "Start subscription" })}
              </Link>
            </>
          ) : null}
        </p>
      )}

      {sonuc?.krediUyarisi && !sonuc.hata && (
        <p className="asistan-uyari" data-tone="neutral" role="status">
          {sonuc.krediUyarisi}
        </p>
      )}

      {sonuc?.kayitliCevap && (
        <div className="asistan-uyari asistan-uyari-eylemli" data-tone="info">
          <span>
            {t({
              tr: `Bu soruyu ${tarihSaat(sonuc.kayitliCevap.tarih)} tarihinde sormuştunuz; kayıtlı cevap gösteriliyor. Yeni bir denetim için yeniden sorgulayın.`,
              en: `You asked this on ${tarihSaat(sonuc.kayitliCevap.tarih)}; the saved answer is shown. Ask again for a fresh check.`,
            })}
          </span>
          {onYenidenSorgula && (
            <button type="button" className="asistan-ikincil-dugme" onClick={onYenidenSorgula} disabled={bekleniyor}>
              <RotateCcw size={14} aria-hidden="true" /> {t({ tr: "Yeniden sorgula", en: "Ask again" })}
            </button>
          )}
        </div>
      )}

      {sonuc?.kirpilanlar && sonuc.kirpilanlar.length > 0 && (
        <p className="asistan-uyari" data-tone="neutral">
          {t({
            tr: `Uzunluk sınırı nedeniyle asistana gönderilemeyen bölümler: ${sonuc.kirpilanlar.join(", ")}.`,
            en: `Sections not sent to the assistant because of the length limit: ${sonuc.kirpilanlar.join(", ")}.`,
          })}
        </p>
      )}

      {aramalar.length > 0 && <AramaListesi aramalar={aramalar} onCalistir={onAramaCalistir} />}

      {bulgular.length > 0 && (
        <div className="asistan-bolum">
          {/* Başlığın yanında türlere göre sayı: öğrenci listeyi okumadan
              önce kaç uyarı olduğunu görüyor. Sıra asistanınki (öncelik). */}
          <div className="asistan-bolum-bas">
            <h4 className="asistan-bolum-baslik">{bulguBasligi}</h4>
            <span className="asistan-bulgu-sayilari">
              {(["uyari", "oneri", "bilgi"] as const).map((tur) => {
                const sayi = bulgular.filter((b) => b.tur === tur).length;
                return sayi ? (
                  <span key={tur} data-tone={BULGU_TONU[tur]}>
                    {sayi} {etiketler[tur].toLocaleLowerCase(dil === "en" ? "en-US" : "tr-TR")}
                  </span>
                ) : null;
              })}
            </span>
          </div>
          <BulguListesi bulgular={bulgular} etiketler={etiketler} eylem={bulguEylemi} />
        </div>
      )}

      {temiz && (
        <p className="asistan-uyari" data-tone="success" role="status">
          {t({
            tr: "Asistan bu metinde işaretlenecek bir sorun bulmadı. Bu bir onay değil: yalnızca kendi denetim listesinde bir eksik görmediği anlamına gelir.",
            en: "The assistant found nothing to flag in this text. This is not an approval: it only means it saw no gaps against its own checklist.",
          })}
        </p>
      )}

      {doluSonuc && !sonuc?.kayitliCevap && <AsistanPuan kayitId={sonuc?.kayitId} />}

      {gecmisGizli ? null : (
      <details
        className="asistan-gecmis"
        onToggle={(event) => {
          if (!event.currentTarget.open || gecmis) return;
          basla(async () => setGecmis(await asistanGecmisim(yetenek)));
        }}
      >
        <summary>
          <History size={14} aria-hidden="true" /> {t({ tr: "Önceki sorgularım", en: "My previous queries" })}
        </summary>
        {yukleniyor && <p className="asistan-gecmis-bos">{t({ tr: "Yükleniyor…", en: "Loading…" })}</p>}
        {gecmis && gecmis.length === 0 && (
          <p className="asistan-gecmis-bos">{t({ tr: "Bu bölümde henüz kayıtlı sorgunuz yok.", en: "You have no saved queries in this section yet." })}</p>
        )}
        {gecmis && gecmis.length > 0 && (
          <ul className="asistan-gecmis-listesi">
            {gecmis.map((kayit) => (
              <li key={kayit.id}>
                <details>
                  <summary>
                    <b>{kayit.ozet}</b>
                    <small>{tarihSaat(kayit.created_at)}</small>
                  </summary>
                  {kayit.aramalar && kayit.aramalar.length > 0 && <AramaListesi aramalar={kayit.aramalar} onCalistir={onAramaCalistir} />}
                  {kayit.bulgular.length > 0 && <BulguListesi bulgular={kayit.bulgular} etiketler={etiketler} />}
                </details>
              </li>
            ))}
          </ul>
        )}
      </details>
      )}
    </>
  );
}
