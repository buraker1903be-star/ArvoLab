"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { tasEkle, tasGuncelle, tasSil, tasTamamla, taslakTakvimOlustur } from "@/app/actions/tez-takvimi";
import { kalanMetni, takvimSirala, taslakTakvim, tasDurumu, type TakvimTasi, type TasDurumu } from "@/lib/tez-takvimi";
import { useCeviri, useDil, useTarihler } from "@/app/_components/dil-saglayici";
import TarihSecici from "@/app/dashboard/_components/tarih-secici";
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
  const t = useCeviri();
  const dil = useDil();
  const { tarih } = useTarihler();
  const router = useRouter();
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  const [, basla] = useTransition();
  const sirali = takvimSirala(taslar);
  /* Taslak yalnızca takvim BOŞKEN önerilir: bütün taşları bitiren öğrenciye
     "taslak oluştur" göstermek, bitmiş planı yeniden kurmaya çağırıyordu. */
  const taslak = !taslar.length && teslimTarihi ? taslakTakvim(projeTuru, bugun, teslimTarihi, dil) : [];

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
        <b>{t({ tr: "Teslim tarihi", en: "Due date" })}</b>
        {teslimTarihi ? (
          <span>
            {tarih(teslimTarihi)} · {(() => {
              const d = tasDurumu({ hedef_tarih: teslimTarihi, tamamlandi: null }, bugun);
              return kalanMetni(d.durum, d.kalanGun, dil);
            })()}
          </span>
        ) : duzenleyebilir ? (
          <TeslimTarihiFormu projectId={projectId} bugun={bugun} />
        ) : (
          <span>{t({ tr: "Girilmedi", en: "Not set" })}</span>
        )}
      </section>

      {taslak.length && duzenleyebilir ? (
        <section className="takvim-taslak">
          <p className="hint">
            {t({
              tr: "Teslime kalan süreyi olağan adımlara paylaştıran bir taslak; oluşturduktan sonra her tarihi değiştirebilir ya da silebilirsiniz.",
              en: "A draft that spreads the time until submission over the usual steps; once created, you can change or delete any date.",
            })}
          </p>
          <ol className="takvim-taslak-liste">
            {taslak.map((adim) => (
              <li key={adim.baslik}>
                <span>{adim.baslik}</span>
                <small>{tarih(adim.hedef_tarih)}</small>
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
              }, t({ tr: "Taslak takvim oluşturuldu.", en: "Draft schedule created." }))
            }
          >
            <Wand2 size={14} aria-hidden="true" /> {t({ tr: "Taslak takvimi oluştur", en: "Create draft schedule" })}
          </button>
        </section>
      ) : null}

      {sirali.length ? (
        <ul className="gb-liste takvim-liste">
          {sirali.map((tas) => {
            const { durum, kalanGun } = tasDurumu(tas, bugun);
            return (
              <li key={tas.id} className="takvim-satir" data-durum={durum}>
                {duzenleyebilir ? (
                  <button
                    type="button"
                    className="takvim-onay"
                    aria-pressed={Boolean(tas.tamamlandi)}
                    aria-label={
                      tas.tamamlandi
                        ? t({ tr: `${tas.baslik}: tamamlanmadı olarak işaretle`, en: `${tas.baslik}: mark as not done` })
                        : t({ tr: `${tas.baslik}: tamamlandı`, en: `${tas.baslik}: done` })
                    }
                    disabled={bekleyen === tas.id}
                    onClick={() => calistir(tas.id, () => tasTamamla(tas.id, !tas.tamamlandi))}
                  >
                    {tas.tamamlandi ? <Check size={14} aria-hidden="true" /> : null}
                  </button>
                ) : null}
                <span className="gb-satir-govde">
                  <b>{tas.baslik}</b>
                  <small>{tarih(tas.hedef_tarih)}</small>
                </span>
                <span className="status-pill" data-tone={TON[durum]}>
                  {kalanMetni(durum, kalanGun, dil)}
                </span>
                {duzenleyebilir && !tas.tamamlandi ? (
                  <TarihSecici
                    sinif="takvim-tarih"
                    deger={tas.hedef_tarih}
                    gerekli
                    etiket={t({ tr: `${tas.baslik}: hedef tarihi değiştir`, en: `${tas.baslik}: change target date` })}
                    degisince={(yeni) => {
                      const fd = new FormData();
                      fd.set("baslik", tas.baslik);
                      fd.set("hedefTarih", yeni);
                      if (yeni) calistir(tas.id, () => tasGuncelle(tas.id, fd), t({ tr: "Tarih güncellendi.", en: "Date updated." }));
                    }}
                  />
                ) : null}
                {duzenleyebilir && tas.tamamlandi ? (
                  <button type="button" className="projects-filter-button button-compact" aria-label={t({ tr: `${tas.baslik}: geri al`, en: `${tas.baslik}: undo` })} onClick={() => calistir(tas.id, () => tasTamamla(tas.id, false))}>
                    <RotateCcw size={13} aria-hidden="true" />
                  </button>
                ) : null}
                {duzenleyebilir ? (
                  <button
                    type="button"
                    className="projects-filter-button button-compact"
                    aria-label={t({ tr: `${tas.baslik}: sil`, en: `${tas.baslik}: delete` })}
                    disabled={bekleyen === tas.id}
                    onClick={() => {
                      if (window.confirm(t({ tr: `“${tas.baslik}” takvimden silinsin mi?`, en: `Delete “${tas.baslik}” from the schedule?` })))
                        calistir(tas.id, () => tasSil(tas.id), t({ tr: "Silindi.", en: "Deleted." }));
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
          {t({ tr: "Henüz kilometre taşı yok.", en: "No milestones yet." })}{" "}
          {teslimTarihi
            ? t({ tr: "Aşağıdan bölüm bölüm hedef tarih ekleyin.", en: "Add target dates chapter by chapter below." })
            : t({ tr: "Teslim tarihini girerseniz taslak takvim önerilir.", en: "Enter the due date and a draft schedule will be suggested." })}
        </p>
      )}

      {duzenleyebilir ? (
        <ActionForm action={tasEkle.bind(null, projectId)} className="takvim-ekle" successMessage={t({ tr: "Kilometre taşı eklendi.", en: "Milestone added." })}>
          <input name="baslik" maxLength={120} required placeholder={t({ tr: "Örn. Yöntem bölümünü danışmana gönder", en: "E.g. Send the methods chapter to the advisor" })}
            aria-label={t({ tr: "Kilometre taşı", en: "Milestone" })} />
          <TarihSecici name="hedefTarih" gerekli enAz={bugun} enCok={teslimTarihi} etiket={t({ tr: "Hedef tarih", en: "Target date" })} yerTutucu={t({ tr: "Hedef tarih", en: "Target date" })} />
          <button type="submit" className="projects-filter-button button-compact">
            <Plus size={14} aria-hidden="true" /> {t({ tr: "Ekle", en: "Add" })}
          </button>
        </ActionForm>
      ) : null}
    </div>
  );
}
