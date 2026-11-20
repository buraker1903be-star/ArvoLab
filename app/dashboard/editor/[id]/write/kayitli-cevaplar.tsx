"use client";

import { useEffect, useState } from "react";
import { Check, Copy, CornerDownLeft } from "lucide-react";
import { kayitliCevabiDenetle, kayitliYazimCevaplari } from "@/app/actions/ai-yazim-kayitlari";
import { anaHattiCozumle, paragraflara } from "@/lib/ai/yazim-metni";
import type { KayitliCevap } from "@/lib/ai/kayitli-cevaplar";
import { YEREL } from "@/lib/dil";
import { useCeviri, useDil, useSaatDilimi } from "@/app/_components/dil-saglayici";

/*
  KAYITLI SEKME (19.11.2026, kabul turu 2). Yazım asistanının bu çalışmadaki
  tamamlanmış cevapları, en yenisi başta. Sekme açılınca bir kez okunur
  (kayitliYazimCevaplari): model çağrılmaz, hak tüketilmez. "İmlece ekle"
  önce sunucuda güncel kaynak denetimini çalıştırır (kayitliCevabiDenetle);
  geçmezse metin eklenmez ve nedeni kartta yazar.
*/

type Durum = { tur: "yukleniyor" } | { tur: "hata"; mesaj: string } | { tur: "hazir"; cevaplar: KayitliCevap[]; dahaVar: boolean };

export default function KayitliCevaplar({
  projectId,
  onEkle,
  onKopyala,
}: {
  projectId: string;
  /** Denetimden geçen metni belgeye ekler (panelin ekleme yolu, asistan iziyle). */
  onEkle: (cevap: { id: string; metin: string; gorev: KayitliCevap["gorev"] }) => boolean | Promise<boolean>;
  onKopyala: (metin: string) => void;
}) {
  const t = useCeviri();
  const dil = useDil();
  const saatDilimi = useSaatDilimi();
  const [durum, setDurum] = useState<Durum>({ tur: "yukleniyor" });
  const [ekleniyor, setEkleniyor] = useState<string | null>(null);
  const [eklenen, setEklenen] = useState<Set<string>>(new Set());
  const [kartHatasi, setKartHatasi] = useState<Record<string, string>>({});

  useEffect(() => {
    let iptal = false;
    void kayitliYazimCevaplari(projectId)
      .then((r) => {
        if (iptal) return;
        setDurum(r.hata ? { tur: "hata", mesaj: r.hata } : { tur: "hazir", cevaplar: r.cevaplar ?? [], dahaVar: Boolean(r.dahaVar) });
      })
      .catch(() => {
        if (!iptal) setDurum({ tur: "hata", mesaj: t({ tr: "Kayıtlı cevaplar okunamadı; tekrar deneyin.", en: "Saved answers could not be read; try again." }) });
      });
    return () => {
      iptal = true;
    };
  }, [projectId, t]);

  const dahaFazla = async () => {
    if (durum.tur !== "hazir" || !durum.cevaplar.length) return;
    const son = durum.cevaplar[durum.cevaplar.length - 1].tarih;
    const r = await kayitliYazimCevaplari(projectId, son);
    if (r.hata) return setKartHatasi((o) => ({ ...o, _liste: r.hata! }));
    setDurum({ tur: "hazir", cevaplar: [...durum.cevaplar, ...(r.cevaplar ?? [])], dahaVar: Boolean(r.dahaVar) });
  };

  const ekle = async (c: KayitliCevap) => {
    setEkleniyor(c.id);
    setKartHatasi((o) => ({ ...o, [c.id]: "" }));
    try {
      const d = await kayitliCevabiDenetle(projectId, c.id);
      if (d.hata || !d.metin) {
        setKartHatasi((o) => ({ ...o, [c.id]: d.hata ?? t({ tr: "Metin eklenmedi.", en: "The text was not inserted." }) }));
        return;
      }
      if (await onEkle({ id: c.id, metin: d.metin, gorev: d.gorev ?? c.gorev })) setEklenen((o) => new Set(o).add(c.id));
    } catch {
      setKartHatasi((o) => ({ ...o, [c.id]: t({ tr: "Denetim yapılamadı; metin eklenmedi.", en: "The check could not run; the text was not inserted." }) }));
    } finally {
      setEkleniyor(null);
    }
  };

  if (durum.tur === "yukleniyor") return <p className="yazim-kayitli-bos" role="status">{t({ tr: "Kayıtlı cevaplar okunuyor…", en: "Reading saved answers…" })}</p>;
  if (durum.tur === "hata") return <p className="yazim-kayitli-bos" role="alert">{durum.mesaj}</p>;
  if (!durum.cevaplar.length)
    return (
      <p className="yazim-kayitli-bos">
        {t({
          tr: "Bu çalışmada henüz kayıtlı bir asistan cevabı yok. Sohbette aldığınız her cevap burada saklanır; panel kapansa da kaybolmaz.",
          en: "There are no saved assistant answers for this work yet. Every answer you get in the chat is kept here, even after the panel closes.",
        })}
      </p>
    );

  return (
    <div className="yazim-kayitli">
      <p className="yazim-kayitli-not">
        {t({
          tr: "Yalnızca sizin bu çalışmadaki cevaplarınız. Eklemeden önce atıflar güncel kütüphanenize karşı yeniden denetlenir.",
          en: "Only your answers in this work. Citations are re-checked against your current library before inserting.",
        })}
      </p>
      <ol className="yazim-kayitli-liste">
        {durum.cevaplar.map((c) => {
          const anaHat = c.gorev === "anahat" ? anaHattiCozumle(c.metin) : [];
          return (
            <li key={c.id} className="yazim-kayitli-kart">
              <header>
                <time dateTime={c.tarih}>{new Date(c.tarih).toLocaleString(YEREL[dil], { dateStyle: "medium", timeStyle: "short", timeZone: saatDilimi })}</time>
                {c.istek ? <b>{c.istek}</b> : null}
              </header>
              {c.yanit ? <p className="yazim-kayitli-yanit">{c.yanit}</p> : null}
              {c.metin ? (
                <div className="yazim-oneri-metin">
                  {anaHat.length ? (
                    <ul className="yazim-anahat">
                      {anaHat.map((s, j) => (
                        <li key={j} data-duzey={s.duzey}>
                          <b>{s.baslik}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    paragraflara(c.metin).map((p, j) => <p key={j}>{p}</p>)
                  )}
                </div>
              ) : null}
              {kartHatasi[c.id] ? (
                <p className="yazim-kayitli-hata" role="alert">
                  {kartHatasi[c.id]}
                </p>
              ) : null}
              {c.metin ? (
                <div className="yazim-oneri-eylem">
                  <button type="button" className="projects-primary-button button-compact" onClick={() => void ekle(c)} disabled={ekleniyor === c.id || eklenen.has(c.id)}>
                    {eklenen.has(c.id) ? <Check size={14} aria-hidden="true" /> : <CornerDownLeft size={14} aria-hidden="true" />}
                    {eklenen.has(c.id)
                      ? t({ tr: "Eklendi", en: "Inserted" })
                      : ekleniyor === c.id
                        ? t({ tr: "Denetleniyor…", en: "Checking…" })
                        : t({ tr: "İmlece ekle", en: "Insert at cursor" })}
                  </button>
                  <button type="button" className="projects-filter-button button-compact" onClick={() => onKopyala(c.metin)}>
                    <Copy size={14} aria-hidden="true" /> {t({ tr: "Kopyala", en: "Copy" })}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {kartHatasi._liste ? <p className="yazim-kayitli-hata" role="alert">{kartHatasi._liste}</p> : null}
      {durum.dahaVar ? (
        <button type="button" className="projects-filter-button button-compact" onClick={() => void dahaFazla()}>
          {t({ tr: "Daha eski cevaplar", en: "Older answers" })}
        </button>
      ) : null}
    </div>
  );
}
