"use client";

import { useState } from "react";
import { Wand2, Undo2 } from "lucide-react";
import { hazirKaynakcaDuzeltmeleri } from "@/app/actions/kaynakca-duzeltme";
import { duzeltmeOzetCumlesi, type DuzeltmeOzeti, type KutuphaneKaynagi } from "@/lib/atif/hazir-duzeltme";
import { ORNEK_TURU_ADI } from "@/lib/kilavuz-ornek-kunyeler";
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
  /*
    Öğrencinin seçtiği örnek, KÜNYE BAŞINA. Seçim yalnızca o künyeyi
    ilgilendiriyor: biri için yapılan seçim ötekileri bağlamaz ve
    seçim bekleyen künye ötekilerin uygulanmasını ENGELLEMEZ (yalnızca
    kendisi işaretli gelmez).
  */
  const [secilenOrnek, setSecilenOrnek] = useState<Record<string, string>>({});

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
      /*
        Özel kuralı doğrulanamayan künye varsayılan olarak SEÇİLİ DEĞİL —
        ama kılavuzdaki örneklerden biri türüne göre GÜVENLE eşleşiyorsa
        o künye de işaretli gelir ve önerilen örnek yanında yazılır.
      */
      setSecili(new Set(cevap.ozet.duzeltmeler.filter((d) => !d.ozelKural || d.ornekDurumu?.oneri).map((d) => d.anahtar)));
      setSecilenOrnek(
        Object.fromEntries(
          cevap.ozet.duzeltmeler.filter((d) => d.ornekDurumu?.oneri).map((d) => [d.anahtar, d.ornekDurumu!.oneri!]),
        ),
      );
    } catch {
      showToast("error", t({ tr: "Düzeltmeler hazırlanamadı; tekrar deneyin.", en: "The fixes couldn't be prepared; please try again." }));
    } finally {
      setYukleniyor(false);
    }
  };

  /* Bu künye için seçili örneğin seçeneği; seçim yoksa ya da örnek yoksa null. */
  const secilenSecenek = (d: DuzeltmeOzeti["duzeltmeler"][number]) =>
    d.ornekDurumu?.secenekler.find((x) => x.ornek.metin === secilenOrnek[d.anahtar]) ?? null;

  const uygula = () => {
    if (!ozet) return;
    const secilenler = ozet.duzeltmeler.filter((d) => secili.has(d.anahtar));
    /* Belgeye YAZILAN, ekranda önizlenen künyedir: seçilen örneğe göre
       üretilmişse o, yoksa çalışmanın genel stilindeki. */
    const sayi = onUygula(secilenler.map((d) => ({ anahtar: d.anahtar, parcalar: secilenSecenek(d)?.parcalar ?? d.parcalar })));
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
                    {/*
                      ÖNİZLEME SEÇİLEN ÖRNEĞE GÖRE. Kılavuzun kuralı o
                      örnekten güvenle okunabiliyorsa künye ona göre
                      yazılıyor; okunamıyorsa çalışmanın GENEL stilindeki
                      künye kalıyor ve bu ekranda söyleniyor.
                    */}
                    <p className="kaynakca-duzeltme-eski">{d.ham}</p>
                    <p className="kaynakca-duzeltme-yeni">{secilenSecenek(d)?.yeni ?? d.yeni}</p>
                    {d.sebepler.length ? <small className="muted">{d.sebepler.join(" · ")}</small> : null}
                    {/*
                      Künyeye GİRMEYEN eksikler: düzeltme engellenmiyor
                      (bu alanlar olmadan da künye doğru yazılır) ama
                      eksik olan söyleniyor — biçimleyici olmayan alanı
                      uydurmaz, hiç yazmaz.
                    */}
                    {d.eksikNotu.length ? (
                      <small className="muted">
                        {t({
                          tr: `Kayıtta yok, künyeye de yazılmadı: ${d.eksikNotu.join(", ")}.`,
                          en: `Missing from the record and left out of the reference: ${d.eksikNotu.join(", ")}.`,
                        })}
                      </small>
                    ) : null}
                    {/*
                      İNTERNET KAYNAĞI: kılavuzun bu tür için kendi
                      kuralı olabiliyor ve ArvoLab onu okumuyor.
                      Kılavuzda örnek VARSA öğrenciye kılavuzun KENDİ
                      cümleleri gösteriliyor (bölümüyle); türü güvenle
                      belirlenebiliyorsa uygun örnek önerilip künye
                      işaretli geliyor, belirsizse karar öğrencinin ve
                      künye seçilene kadar işaretlenmiyor.
                    */}
                    {d.ozelKural && d.ornekDurumu ? (
                      <div className="kaynakca-ornek">
                        {d.ornekDurumu.oneri ? (
                          <small className="muted">
                            {t({ tr: "Kılavuzunuzdaki uygun örnek:", en: "Matching example from your guideline:" })}
                          </small>
                        ) : (
                          <small className="tone-text" data-tone="warning">
                            {t({
                              tr: "Bu kaynağın türü kılavuzdaki örneklerden hangisine uyuyor, güvenle söyleyemiyorum. Karşılaştırıp seçin; seçene kadar bu künye uygulanacaklara eklenmez, ötekiler etkilenmez.",
                              en: "I can't tell with confidence which of your guideline's examples fits this source. Compare and pick one; until you do, this reference isn't included in what will be applied, and the others are unaffected.",
                            })}
                          </small>
                        )}
                        <ul className="kaynakca-ornek-liste">
                          {(d.ornekDurumu.oneri
                            ? d.ornekDurumu.secenekler.filter((x) => x.ornek.metin === d.ornekDurumu!.oneri)
                            : d.ornekDurumu.secenekler
                          ).map(({ ornek, kuralUygulandi, gerekenBilgi }) => (
                            <li key={ornek.metin} data-secili={secilenOrnek[d.anahtar] === ornek.metin || undefined}>
                              <label className="cluster">
                                <input
                                  type="radio"
                                  name={`ornek-${d.anahtar}`}
                                  checked={secilenOrnek[d.anahtar] === ornek.metin}
                                  onChange={() => {
                                    /* Seçim YALNIZCA bu künye için; öteki künyeler değişmez. */
                                    setSecilenOrnek({ ...secilenOrnek, [d.anahtar]: ornek.metin });
                                    setSecili(new Set([...secili, d.anahtar]));
                                  }}
                                />
                                <b>{t(ORNEK_TURU_ADI[ornek.tur])}</b>
                              </label>
                              {/* Kılavuzun KENDİ metni; değiştirilmiyor. */}
                              <q>{ornek.metin}</q>
                              <small className="muted">
                                {[
                                  ornek.bolum ? t({ tr: `“${ornek.bolum}” bölümü`, en: `section “${ornek.bolum}”` }) : null,
                                  ornek.sayfa ? t({ tr: `${ornek.sayfa}. sayfa`, en: `page ${ornek.sayfa}` }) : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || t({ tr: "Kılavuzdan", en: "From the guideline" })}
                              </small>
                              {/*
                                Bu örnek ne SAĞLIYOR: kural okunabildiyse
                                künye ona göre yazılıyor; okunamadıysa
                                örnek yalnızca karşılaştırma içindir ve
                                önizleme çalışmanın genel stilinde kalır.
                              */}
                              {kuralUygulandi ? (
                                <small className="tone-text" data-tone="success">
                                  {t({
                                    tr: "Kılavuzun bu örnekteki adres yazımı künyeye uygulandı.",
                                    en: "The address style from this example was applied to the reference.",
                                  })}
                                </small>
                              ) : gerekenBilgi.length ? (
                                <small className="tone-text" data-tone="warning">
                                  {t({
                                    tr: `Bu örnek ${gerekenBilgi.join(", ")} istiyor; kaydınızda yok ve uydurulmuyor. Künye çalışmanızın genel stilinde kalır.`,
                                    en: `This example requires ${gerekenBilgi.join(", ")}; it isn't in your record and is not made up. The reference stays in your work's general style.`,
                                  })}
                                </small>
                              ) : (
                                <small className="muted">
                                  {t({
                                    tr: "Bu örnekten güvenle bir biçim kuralı çıkaramadım; yalnızca karşılaştırma için. Sunulan düzeltme çalışmanızın genel stiline göre hazırlandı.",
                                    en: "I couldn't derive a format rule from this example with confidence; it's for comparison only. The offered fix follows your work's general style.",
                                  })}
                                </small>
                              )}
                            </li>
                          ))}
                        </ul>
                        <small className="muted">
                          {t({
                            tr: "Örnekteki yazar, tarih ve adres sizin künyenize taşınmaz; yalnızca kılavuzun biçim kalıbı uygulanır ve eksik bilgi tamamlanmaz.",
                            en: "The author, date and address in the example are never carried into your reference; only the guideline's format pattern is applied, and missing details are not filled in.",
                          })}
                        </small>
                      </div>
                    ) : d.ozelKural ? (
                      <small className="tone-text" data-tone="warning">
                        {t({
                          tr: "İnternet kaynağı: kılavuzunuzun bu kaynak türü için özel bir kuralı olabilir ve ArvoLab onu kılavuzdan okumuyor. Kılavuzunuzda örnek künye bulamadım; aşağıdaki düzeltme stilin genel kuralına göre.",
                          en: "Website source: your guideline may have its own rule for this source type and ArvoLab does not read it from the guideline. I found no example reference in your guideline; the fix below follows the style's general rule.",
                        })}
                        {ornekAtif ? t({ tr: ` Kılavuzunuzdaki örnek atıf: “${ornekAtif}”`, en: ` Example citation from your guideline: “${ornekAtif}”` }) : ""}
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
