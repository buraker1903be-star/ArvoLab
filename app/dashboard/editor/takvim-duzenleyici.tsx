"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { tasEkle, tasGuncelle, tasSil, tasTamamla, taslakTakvimOlustur } from "@/app/actions/tez-takvimi";
import { kalanMetni, takvimSirala, taslakTakvim, tasDurumu, type TakvimTasi, type TasDurumu } from "@/lib/tez-takvimi";
import { trTarih } from "@/lib/tr-time";
import ActionForm from "../action-form";
import { showToast } from "../_components/toast-events";
import TeslimTarihiFormu from "../_components/teslim-tarihi-formu";

/*
  TEZ TAKVİMİ DÜZENLEYİCİSİ (28.10.2026): Çalışmalarım kartındaki Takvim
  penceresinin içi. Bölüm bölüm hedef tarihler; tamamlama, tarih
  değiştirme ve silme satırın içinde. Teslim tarihi varsa ve açık taş
  yoksa "Taslak takvim oluştur" kalan süreyi olağan adımlara paylaştırır
  (lib/tez-takvimi.ts) — önizlemesi düğmenin altında, basmadan görülür.
*/
const TON: Record<TasDurumu, string> = { tamam: "success", gecikti: "danger", yaklasiyor: "warning", ileride: "neutral" };

export default function TakvimDuzenleyici({
  projectId,
  projeTuru,
  taslar,
  teslimTarihi,
  bugun,
  duzenleyebilir,
}: {
  projectId: string;
  projeTuru: string;
  taslar: TakvimTasi[];
  teslimTarihi: string | null;
  bugun: string;
  duzenleyebilir: boolean;
}) {
  const router = useRouter();
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();
  const sirali = takvimSirala(taslar);
  const acikVar = taslar.some((t) => !t.tamamlandi);
  const taslak = !acikVar && teslimTarihi ? taslakTakvim(projeTuru, bugun, teslimTarihi) : [];

  const calistir = (anahtar: string, islem: () => Promise<{ error?: string }>, basari?: string) => {
    setBekleyen(anahtar);
    basla(async () => {
      const r = await islem();
      setBekleyen(null);
      if (r.error) return showToast("error", r.error);
      if (basari) showToast("success", basari);
      router.refresh();
    });
  };

  return (
    <div className="takvim-duzenleyici">
      <section className="takvim-teslim">
        <b>Teslim tarihi</b>
        {teslimTarihi ? (
          <span>
            {trTarih(teslimTarihi)} · {(() => {
              const d = tasDurumu({ hedef_tarih: teslimTarihi, tamamlandi: null }, bugun);
              return kalanMetni(d.durum, d.kalanGun);
            })()}
          </span>
        ) : duzenleyebilir ? (
          <TeslimTarihiFormu projectId={projectId} bugun={bugun} />
        ) : (
          <span>Girilmedi</span>
        )}
      </section>

      {taslak.length && duzenleyebilir ? (
        <section className="takvim-taslak">
          <p className="hint">
            Teslime kalan süreyi olağan adımlara paylaştıran bir taslak; oluşturduktan sonra her tarihi değiştirebilir ya da
            silebilirsiniz.
          </p>
          <ol className="takvim-taslak-liste">
            {taslak.map((t) => (
              <li key={t.baslik}>
                <span>{t.baslik}</span>
                <small>{trTarih(t.hedef_tarih)}</small>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="projects-primary-button button-compact"
            disabled={bekleyen === "taslak"}
            onClick={() =>
              calistir("taslak", async () => {
                const r = await taslakTakvimOlustur(projectId);
                return r.error ? r : {};
              }, "Taslak takvim oluşturuldu.")
            }
          >
            <Wand2 size={14} aria-hidden="true" /> Taslak takvimi oluştur
          </button>
        </section>
      ) : null}

      {sirali.length ? (
        <ul className="gb-liste takvim-liste">
          {sirali.map((t) => {
            const { durum, kalanGun } = tasDurumu(t, bugun);
            return (
              <li key={t.id} className="takvim-satir" data-durum={durum}>
                {duzenleyebilir ? (
                  <button
                    type="button"
                    className="takvim-onay"
                    aria-pressed={Boolean(t.tamamlandi)}
                    aria-label={t.tamamlandi ? `${t.baslik}: tamamlanmadı olarak işaretle` : `${t.baslik}: tamamlandı`}
                    disabled={bekleyen === t.id}
                    onClick={() => calistir(t.id, () => tasTamamla(t.id, !t.tamamlandi))}
                  >
                    {t.tamamlandi ? <Check size={14} aria-hidden="true" /> : null}
                  </button>
                ) : null}
                <span className="gb-satir-govde">
                  <b>{t.baslik}</b>
                  <small>{trTarih(t.hedef_tarih)}</small>
                </span>
                <span className="status-pill" data-tone={TON[durum]}>
                  {kalanMetni(durum, kalanGun)}
                </span>
                {duzenleyebilir && !t.tamamlandi ? (
                  <input
                    type="date"
                    className="takvim-tarih"
                    defaultValue={t.hedef_tarih}
                    aria-label={`${t.baslik}: hedef tarihi değiştir`}
                    onChange={(e) => {
                      const fd = new FormData();
                      fd.set("baslik", t.baslik);
                      fd.set("hedefTarih", e.target.value);
                      if (e.target.value) calistir(t.id, () => tasGuncelle(t.id, fd), "Tarih güncellendi.");
                    }}
                  />
                ) : null}
                {duzenleyebilir && t.tamamlandi ? (
                  <button type="button" className="projects-filter-button button-compact" aria-label={`${t.baslik}: geri al`} onClick={() => calistir(t.id, () => tasTamamla(t.id, false))}>
                    <RotateCcw size={13} aria-hidden="true" />
                  </button>
                ) : null}
                {duzenleyebilir ? (
                  <button
                    type="button"
                    className="projects-filter-button button-compact"
                    aria-label={`${t.baslik}: sil`}
                    disabled={bekleyen === t.id}
                    onClick={() => {
                      if (window.confirm(`“${t.baslik}” takvimden silinsin mi?`)) calistir(t.id, () => tasSil(t.id), "Silindi.");
                    }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : taslak.length ? null : (
        <p className="gb-bos">
          Henüz kilometre taşı yok. {teslimTarihi ? "Aşağıdan bölüm bölüm hedef tarih ekleyin." : "Teslim tarihini girerseniz taslak takvim önerilir."}
        </p>
      )}

      {duzenleyebilir ? (
        <ActionForm action={tasEkle.bind(null, projectId)} className="takvim-ekle" successMessage="Kilometre taşı eklendi.">
          <input name="baslik" maxLength={120} required placeholder="Örn. Yöntem bölümünü danışmana gönder" aria-label="Kilometre taşı" />
          <input type="date" name="hedefTarih" required min={bugun} max={teslimTarihi ?? undefined} aria-label="Hedef tarih" />
          <button type="submit" className="projects-filter-button button-compact">
            <Plus size={14} aria-hidden="true" /> Ekle
          </button>
        </ActionForm>
      ) : null}
    </div>
  );
}
