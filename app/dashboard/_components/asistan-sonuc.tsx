"use client";

import { useState, useTransition, type ReactNode } from "react";
import { History, RotateCcw } from "lucide-react";
import { asistanGecmisim } from "@/app/actions/ai-gecmis";
import type { GecmisKaydi } from "@/lib/ai/gecmis";
import type { Bulgu } from "@/lib/ai/bulgu";
import type { YetenekAdi } from "@/lib/ai/kayit-gorunum";
import { trTarihSaat } from "@/lib/tr-time";
import AsistanPuan from "./asistan-puan";

/*
  Asistan sonucunun ortak görünümü. Üç yetenek de aynı bileşeni kullanıyor:
  daha önce her sayfa kendi işaretlemesini taşıyordu, bulgu kutusunun tonu
  ve boşlukları sayfadan sayfaya kayıyordu.

  Geçmiş burada duruyor çünkü asıl amacı sonuca bakarken "bunu zaten
  sormuştum" dedirtmek: kullanıcı aynı soruyu ikinci kez sordurmasın.
*/

const BULGU_TONU = { uyari: "danger", oneri: "warning", bilgi: "info" } as const;

export type Etiketler = { uyari: string; oneri: string; bilgi: string };

export type AsistanSonucVerisi = {
  hata?: string;
  bulgular?: Bulgu[];
  aramalar?: string[];
  kirpilanlar?: string[];
  kayitId?: string | null;
  kayitliCevap?: { tarih: string } | null;
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
      {bulgular.map((bulgu, index) => (
        <li className="asistan-bulgu" data-tone={BULGU_TONU[bulgu.tur]} key={index}>
          <span className="asistan-bulgu-etiket">{etiketler[bulgu.tur]}</span>
          <span className="asistan-bulgu-metin">
            <b>{bulgu.baslik}</b>
            {bulgu.aciklama}
          </span>
          {eylem ? <span className="asistan-bulgu-eylem">{eylem(bulgu, index)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function AramaListesi({ aramalar, onCalistir }: { aramalar: string[]; onCalistir?: (arama: string) => void }) {
  return (
    <div className="asistan-bolum">
      <h4 className="asistan-bolum-baslik">Arama dizeleri</h4>
      <ul className="asistan-aramalar">
        {aramalar.map((arama, index) => (
          <li key={index}>
            <code>{arama}</code>
            {/* Dize kurup "şimdi bunu bir yere yapıştırın" demek işi yarıda
                bırakıyordu; sayfanın kendi bulucusu varken tek tık yeter. */}
            {onCalistir && (
              <button type="button" className="asistan-arama-calistir" onClick={() => onCalistir(arama)}>
                Bu aramayı çalıştır
              </button>
            )}
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
        </p>
      )}

      {sonuc?.kayitliCevap && (
        <div className="asistan-uyari asistan-uyari-eylemli" data-tone="info">
          <span>
            Bu soruyu {trTarihSaat(sonuc.kayitliCevap.tarih)} tarihinde sormuştunuz; kayıtlı cevap gösteriliyor.
            Yeni bir denetim için yeniden sorgulayın.
          </span>
          {onYenidenSorgula && (
            <button type="button" className="asistan-ikincil-dugme" onClick={onYenidenSorgula} disabled={bekleniyor}>
              <RotateCcw size={14} aria-hidden="true" /> Yeniden sorgula
            </button>
          )}
        </div>
      )}

      {sonuc?.kirpilanlar && sonuc.kirpilanlar.length > 0 && (
        <p className="asistan-uyari" data-tone="neutral">
          Uzunluk sınırı nedeniyle asistana gönderilemeyen bölümler: {sonuc.kirpilanlar.join(", ")}.
        </p>
      )}

      {aramalar.length > 0 && <AramaListesi aramalar={aramalar} onCalistir={onAramaCalistir} />}

      {bulgular.length > 0 && (
        <div className="asistan-bolum">
          <h4 className="asistan-bolum-baslik">{bulguBasligi}</h4>
          <BulguListesi bulgular={bulgular} etiketler={etiketler} eylem={bulguEylemi} />
        </div>
      )}

      {temiz && (
        <p className="asistan-uyari" data-tone="success" role="status">
          Asistan bu metinde işaretlenecek bir sorun bulmadı. Bu bir onay değil: yalnızca kendi denetim
          listesinde bir eksik görmediği anlamına gelir.
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
          <History size={14} aria-hidden="true" /> Önceki sorgularım
        </summary>
        {yukleniyor && <p className="asistan-gecmis-bos">Yükleniyor…</p>}
        {gecmis && gecmis.length === 0 && (
          <p className="asistan-gecmis-bos">Bu bölümde henüz kayıtlı sorgunuz yok.</p>
        )}
        {gecmis && gecmis.length > 0 && (
          <ul className="asistan-gecmis-listesi">
            {gecmis.map((kayit) => (
              <li key={kayit.id}>
                <details>
                  <summary>
                    <b>{kayit.ozet}</b>
                    <small>{trTarihSaat(kayit.created_at)}</small>
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
