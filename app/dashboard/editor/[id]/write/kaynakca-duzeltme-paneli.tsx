"use client";

import { useState } from "react";
import { Wand2, Undo2 } from "lucide-react";
import { hazirKaynakcaDuzeltmeleri } from "@/app/actions/kaynakca-duzeltme";
import { duzeltmeOzetCumlesi, type DuzeltmeOzeti, type KutuphaneKaynagi } from "@/lib/atif/hazir-duzeltme";
import { stilAdiMetni } from "@/lib/atif/stiller";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  HAZIR KAYNAKÇA DÜZELTMELERİ (23.11.2026).

  Denetim neyin yanlış olduğunu söylüyordu; düzeltmeyi öğrenci otuz künye
  için elle yapıyordu. Panelin kuralları:

  - DENETİM BELGEYİ DEĞİŞTİRMEZ. Liste istek üzerine getiriliyor,
    belgeye yazan tek şey "Uygula" düğmesi.
  - ÖNİZLEME ZORUNLU. Her satırda künyenin ŞU ANKİ hâli ve olacağı hâl
    yan yana; istemediğini işaretten çıkarır.
  - TEK GERİ ALMA. Uygulama tek işlem; "Geri al" hepsini birden kaldırır
    (Ctrl+Z ile aynı adım).
  - BELİRSİZLİK ÖTEKİLERİ ENGELLEMEZ. Kütüphanede karşılığı olmayan ya da
    iki kayda birden uyan künye için düzeltme ÜRETİLMİYOR (künye
    uydurmamak için), ama ötekiler yine sunuluyor. Kaydı eksik olanlarda
    hangi bilginin gerektiği yazılı — eksik alan tamamlanmıyor.
*/

export default function KaynakcaDuzeltmePaneli({
  projectId,
  ornekAtif,
  onUygula,
  onKaynakEkle,
  onGeriAl,
}: {
  projectId: string;
  /* Kılavuzun örnek atfı (lib/atif/tyk.ts); özel kural doğrulanamadığında
     öğrenciye GÖSTERİLİYOR — kural adına karar verilmiyor. */
  ornekAtif?: string | null;
  /** Seçilen düzeltmeleri belgeye yazar; uygulanan satır sayısını döner. */
  onUygula: (duzeltmeler: { anahtar: string; parcalar: { text: string; italic?: boolean }[] }[]) => number;
  /** Eksik künyeleri ÇALIŞMANIN stilinde Kaynakça'ya yazar; eklenen sayısını döner. */
  onKaynakEkle: (kaynaklar: KutuphaneKaynagi[]) => number;
  onGeriAl: () => void;
}) {
  const t = useCeviri();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [ozet, setOzet] = useState<DuzeltmeOzeti | null>(null);
  const [stil, setStil] = useState("");
  const [denetimYok, setDenetimYok] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [uygulandi, setUygulandi] = useState<number | null>(null);
  const [eklenecekler, setEklenecekler] = useState<KutuphaneKaynagi[]>([]);
  const [calismaStili, setCalismaStili] = useState("");

  const getir = async () => {
    setYukleniyor(true);
    setUygulandi(null);
    try {
      const cevap = await hazirKaynakcaDuzeltmeleri(projectId);
      if ("hata" in cevap) {
        showToast("error", cevap.hata);
        return;
      }
      setOzet(cevap.ozet);
      setStil(cevap.stil);
      setCalismaStili(cevap.calismaStili);
      setEklenecekler(cevap.eklenecekler);
      setDenetimYok(Boolean(cevap.denetimYok));
      /* Özel kuralı doğrulanamayan künye varsayılan olarak SEÇİLİ DEĞİL. */
      setSecili(new Set(cevap.ozet.duzeltmeler.filter((d) => !d.ozelKural).map((d) => d.anahtar)));
    } catch {
      showToast("error", t({ tr: "Düzeltmeler hazırlanamadı; tekrar deneyin.", en: "The fixes couldn't be prepared; please try again." }));
    } finally {
      setYukleniyor(false);
    }
  };

  const uygula = () => {
    if (!ozet) return;
    const secilenler = ozet.duzeltmeler.filter((d) => secili.has(d.anahtar));
    const sayi = onUygula(secilenler.map((d) => ({ anahtar: d.anahtar, parcalar: d.parcalar })));
    setUygulandi(sayi);
    if (sayi === 0) {
      /* Eşleşen satır bulunamadı: denetimden sonra kaynakça değişmiş
         olabilir. "Uygulandı" demek, yapılmamış bir değişikliği
         bildirmek olurdu. */
      showToast("error", t({
        tr: "Kaynakçada bu künyeler bulunamadı; denetimden sonra değişmiş olabilir. Yeniden denetleyin.",
        en: "These references weren't found in the reference list; it may have changed since the check. Run the check again.",
      }));
      return;
    }
    showToast("success", t({
      tr: `${sayi} künye düzeltildi. İstemezseniz "Geri al" ya da Ctrl+Z.`,
      en: `${sayi} ${sayi === 1 ? "reference" : "references"} fixed. Use “Undo” or Ctrl+Z if you don't want it.`,
    }));
  };

  return (
    <div className="kaynakca-duzeltme">
      <button type="button" className="projects-filter-button button-compact" onClick={() => void getir()} disabled={yukleniyor}>
        <Wand2 size={15} aria-hidden="true" />
        {yukleniyor
          ? t({ tr: "Hazırlanıyor…", en: "Preparing…" })
          : ozet
            ? t({ tr: "Düzeltmeleri yenile", en: "Refresh fixes" })
            : t({ tr: "Hazır düzeltmeleri göster", en: "Show ready fixes" })}
      </button>

      {denetimYok ? (
        <p className="muted text-sm">
          {t({
            tr: "Henüz kaynakça denetimi yapılmamış. Düzeltmeler son denetimin bulgularından çıkarılıyor.",
            en: "No reference check has been run yet. Fixes are derived from the findings of the last check.",
          })}
        </p>
      ) : null}

      {ozet && !denetimYok ? (
        <>
          <p className="kaynakca-duzeltme-ozet">
            <b>{t(duzeltmeOzetCumlesi(ozet))}</b>{" "}
            <span className="muted">
              {t({ tr: `Denetlenen stil: ${t(stilAdiMetni(stil))}.`, en: `Checked style: ${t(stilAdiMetni(stil))}.` })}
            </span>
          </p>

          {ozet.duzeltmeler.length ? (
            <>
              <ul className="kaynakca-duzeltme-liste">
                {ozet.duzeltmeler.map((d) => (
                  <li key={d.anahtar}>
                    <label className="cluster">
                      <input
                        type="checkbox"
                        checked={secili.has(d.anahtar)}
                        onChange={(e) => {
                          const yeni = new Set(secili);
                          if (e.target.checked) yeni.add(d.anahtar);
                          else yeni.delete(d.anahtar);
                          setSecili(yeni);
                        }}
                      />
                      <span className="kaynakca-duzeltme-ad">{t({ tr: "Bu künyeyi düzelt", en: "Fix this reference" })}</span>
                    </label>
                    <p className="kaynakca-duzeltme-eski">{d.ham}</p>
                    <p className="kaynakca-duzeltme-yeni">{d.yeni}</p>
                    {d.sebepler.length ? <small className="muted">{d.sebepler.join(" · ")}</small> : null}
                    {d.ozelKural ? (
                      <small className="tone-text" data-tone="warning">
                        {t({
                          tr: "İnternet kaynağı: kılavuzunuzun bu kaynak türü için özel bir kuralı olabilir ve ArvoLab onu kılavuzdan okumuyor. Aşağıdaki düzeltme stilin genel kuralına göre; uygulamadan önce kılavuzunuzdaki örnekle karşılaştırın.",
                          en: "Website source: your guideline may have its own rule for this source type and ArvoLab does not read it from the guideline. The fix below follows the style's general rule; compare it with the example in your guideline before applying.",
                        })}
                        {ornekAtif ? t({ tr: ` Kılavuzunuzdaki örnek: “${ornekAtif}”`, en: ` Example from your guideline: “${ornekAtif}”` }) : ""}
                      </small>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="cluster">
                <button type="button" className="projects-primary-button button-compact" onClick={uygula} disabled={secili.size === 0}>
                  {t({ tr: `Seçilenleri uygula (${secili.size})`, en: `Apply selected (${secili.size})` })}
                </button>
                {uygulandi ? (
                  <button type="button" className="projects-filter-button button-compact" onClick={() => { onGeriAl(); setUygulandi(null); }}>
                    <Undo2 size={15} aria-hidden="true" />
                    {t({ tr: "Geri al", en: "Undo" })}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {/*
            KAYNAKÇAYA EKLE: metinde anılan ama kaynakçada olmayan
            kaynaklar. Künye ÇALIŞMANIN kayıtlı stiliyle yazılıyor —
            denetim tek seferlik başka bir stille yapılmış olabilir ve
            belgeye giren biçim ondan etkilenmemeli. Yol editördeki atıf
            eklemeyle aynı (kaynakcaGirdisiIslemi): aynı kaynak ikinci
            kez eklenmiyor.
          */}
          {eklenecekler.length ? (
            <div className="kaynakca-duzeltme-eksik" data-tur="eklenecek">
              <strong>
                {t({
                  tr: `Metinde anılan ${eklenecekler.length} kaynak kaynakçada yok`,
                  en: `${eklenecekler.length} source${eklenecekler.length === 1 ? "" : "s"} cited in the text ${eklenecekler.length === 1 ? "is" : "are"} missing from the reference list`,
                })}
              </strong>
              <ul className="kaynakca-duzeltme-liste">
                {eklenecekler.map((k) => (
                  <li key={k.id}>
                    <p className="kaynakca-duzeltme-yeni">{[k.authors, k.year, k.title].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="projects-filter-button button-compact"
                onClick={() => {
                  const sayi = onKaynakEkle(eklenecekler);
                  setUygulandi(sayi);
                  showToast(sayi ? "success" : "error", sayi
                    ? t({
                        tr: `${sayi} künye ${t(stilAdiMetni(calismaStili))} biçiminde kaynakçaya eklendi. İstemezseniz "Geri al" ya da Ctrl+Z.`,
                        en: `${sayi} ${sayi === 1 ? "reference" : "references"} added to the list in ${t(stilAdiMetni(calismaStili))}. Use “Undo” or Ctrl+Z if you don't want it.`,
                      })
                    : t({ tr: "Bu kaynaklar kaynakçada zaten var; yeniden eklenmedi.", en: "These sources are already in the reference list; nothing was added again." }));
                }}
              >
                {t({
                  tr: `Kaynakçaya ekle (${t(stilAdiMetni(calismaStili))})`,
                  en: `Add to the reference list (${t(stilAdiMetni(calismaStili))})`,
                })}
              </button>
            </div>
          ) : null}

          {ozet.eksikler.length ? (
            <div className="kaynakca-duzeltme-eksik">
              <strong>{t({ tr: "Künye bilgisi eksik", en: "Missing reference details" })}</strong>
              <p className="muted text-sm">
                {t({
                  tr: "Bu kaynaklar kütüphanenizde var ama künye tam yazılamıyor; eksik bilgi tamamlanmadan düzeltme sunulmuyor.",
                  en: "These sources are in your library but the reference can't be written in full; no fix is offered until the missing details are added.",
                })}
              </p>
              <ul className="kaynakca-duzeltme-liste">
                {ozet.eksikler.map((e) => (
                  <li key={e.anahtar}>
                    <p className="kaynakca-duzeltme-eski">{e.ham}</p>
                    <small>{t({ tr: `Gereken: ${e.alanlar.join(", ")}`, en: `Needed: ${e.alanlar.join(", ")}` })}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {ozet.eslesmeyen.length ? (
            <p className="muted text-sm">
              {t({
                tr: `${ozet.eslesmeyen.length} künye kütüphanenizdeki tek bir kayda bağlanamadı; onlara hazır düzeltme üretilmiyor (yanlış kaynağın künyesini yazmamak için).`,
                en: `${ozet.eslesmeyen.length} reference(s) couldn't be matched to a single record in your library; no ready fix is produced for them (so the wrong source's reference is never written).`,
              })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
