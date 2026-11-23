"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Lightbulb } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { GUC_YONTEMLERI, yontemMetni, yontemTanimi } from "@/lib/guc-yontemleri";
import { GUC_ENGEL_METNI, ornekemBuyuklugu, type GucGirdisi, type GucYontemi, type TestYonu } from "@/lib/stats-guc";

/*
  GÜÇ ve ÖRNEKLEM PANELİ (23.11.2026).

  VERİ DOSYASI İSTEMEYEN AYRI BİR AKIŞ. Örneklem kararı veri
  toplanmadan ÖNCE verilir; bu yüzden Analiz Merkezi'nin üçüncü
  sekmesi ve dosya yükleme akışından tümüyle bağımsız.

  Yöntemler araştırma sorusuyla anlatılıyor ("İki ayrı grubun
  puanlarını karşılaştıracağım"): öğrenci testin adını bilmeden de
  doğru satırı bulabilsin. Hesap lib/stats-guc.ts'te; burada yalnızca
  girdi, çıktı ve açıklama var.
*/
export default function GucPaneli() {
  const t = useCeviri();
  const dil = useDil();
  const [yontem, setYontem] = useState<GucYontemi>("bagimsizT");
  const [etki, setEtki] = useState("");
  const [alfa, setAlfa] = useState("0.05");
  const [hedefGuc, setHedefGuc] = useState("0.80");
  const [yon, setYon] = useState<TestYonu>("iki");
  const [grupSayisi, setGrupSayisi] = useState("3");
  const [yordayiciSayisi, setYordayiciSayisi] = useState("3");
  const [dagilimOrani, setDagilimOrani] = useState("1");
  const [kayipOrani, setKayipOrani] = useState("");
  const [ornekDolduruldu, setOrnekDolduruldu] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);

  const tanim = yontemTanimi(yontem);

  const girdi: GucGirdisi = useMemo(
    () => ({
      yontem,
      etki: Number(etki.replace(",", ".")),
      alfa: Number(alfa.replace(",", ".")),
      hedefGuc: Number(hedefGuc.replace(",", ".")),
      yon: tanim.yonSecilir ? yon : "iki",
      grupSayisi: Number(grupSayisi),
      yordayiciSayisi: Number(yordayiciSayisi),
      dagilimOrani: Number(dagilimOrani.replace(",", ".")),
      kayipOrani: kayipOrani.trim() === "" ? 0 : Number(kayipOrani.replace(",", ".")) ,
    }),
    [yontem, etki, alfa, hedefGuc, yon, grupSayisi, yordayiciSayisi, dagilimOrani, kayipOrani, tanim.yonSecilir],
  );

  const sonuc = useMemo(() => (etki.trim() === "" ? null : ornekemBuyuklugu(girdi)), [girdi, etki]);
  const metin = sonuc && sonuc.engel === null ? yontemMetni(girdi, sonuc, dil) : null;

  const ornegiDoldur = useCallback(() => {
    const o = tanim.ornek;
    setEtki(String(o.etki));
    setAlfa(String(o.alfa));
    setHedefGuc(String(o.hedefGuc));
    if (o.grupSayisi) setGrupSayisi(String(o.grupSayisi));
    if (o.yordayiciSayisi) setYordayiciSayisi(String(o.yordayiciSayisi));
    setOrnekDolduruldu(true);
  }, [tanim]);

  const yontemDegistir = (y: GucYontemi) => {
    setYontem(y);
    setOrnekDolduruldu(false);
  };

  const kopyala = async () => {
    if (!metin) return;
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      /* Pano yoksa kullanıcı metni seçip kopyalayabilir. */
    }
  };

  const yuzde = (x: number) => (dil === "en" ? `${(x * 100).toFixed(1)}%` : `%${(x * 100).toFixed(1).replace(".", ",")}`);
  const say = (x: number, b = 3) => (dil === "en" ? x.toFixed(b) : x.toFixed(b).replace(".", ","));

  return (
    <section className="project-form-card analiz-guc">
      <div className="project-form-heading">
        <h2>{t({ tr: "Güç ve Örneklem", en: "Power and Sample Size" })}</h2>
        <p>
          {t({
            tr: "Veri toplamadan önce kaç kişi gerektiğini hesaplar. Bu bölüm dosya istemez: yalnızca planladığınız analizi, beklediğiniz etki büyüklüğünü ve hedef gücü girersiniz.",
            en: "Works out how many people you need before you collect data. This section needs no file: you enter the analysis you plan, the effect size you expect and your target power.",
          })}
        </p>
      </div>

      {/* ---------- Yöntem: araştırma sorusuyla ---------- */}
      <fieldset className="analiz-guc-yontem">
        <legend>{t({ tr: "Ne yapacaksınız?", en: "What will you do?" })}</legend>
        {GUC_YONTEMLERI.map((y) => (
          <label key={y.anahtar} className="analiz-guc-secenek">
            <input type="radio" name="guc-yontem" value={y.anahtar} checked={yontem === y.anahtar} onChange={() => yontemDegistir(y.anahtar)} />
            <span>
              <b>{t(y.soru)}</b>
              <small>{t(y.testAdi)}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {/* ---------- "Hangi bilgiler gerekli?" ---------- */}
      <section className="analiz-veri-karti" aria-label={t({ tr: "Hangi bilgiler gerekli?", en: "What information is needed?" })}>
        <h4>
          <Lightbulb size={16} aria-hidden="true" /> {t({ tr: "Hangi bilgiler gerekli?", en: "What information is needed?" })}
        </h4>
        <ul>
          <li>
            <b>{t({ tr: "Etki büyüklüğü", en: "Effect size" })}</b>{" "}
            {t({
              tr: "— aradığınız farkın ne kadar büyük olduğunu, ölçü biriminden bağımsız anlatan sayı. Burada",
              en: "— a number that says how large the difference you are looking for is, independently of the unit. Here it is",
            })}{" "}
            <b>{tanim.etkiSimgesi}</b>: {t(tanim.etkiAdi)}.
          </li>
          <li>
            <b>{t({ tr: "Alfa", en: "Alpha" })}</b>{" "}
            {t({
              tr: "— gerçekte fark yokken \"fark var\" deme riskiniz. Yaygın değer 0,05: yüz çalışmanın beşinde yanlış alarm.",
              en: "— your risk of saying \"there is a difference\" when there is none. Commonly .05: a false alarm in five studies out of a hundred.",
            })}
          </li>
          <li>
            <b>{t({ tr: "Hedef güç", en: "Target power" })}</b>{" "}
            {t({
              tr: "— gerçekten varsa farkı YAKALAMA olasılığınız. Yaygın değer 0,80: fark gerçekse onu beş denemenin dördünde bulursunuz.",
              en: "— your chance of DETECTING the difference if it is really there. Commonly .80: if the effect is real you find it in four attempts out of five.",
            })}
          </li>
        </ul>
        <p className="muted text-sm">
          {t({
            tr: "Etki büyüklüğünü kendiniz gerekçelendirmelisiniz: (1) aynı konudaki ÖNCEKİ ARAŞTIRMALARIN bildirdiği değer, (2) kendi PİLOT çalışmanızın sonucu ya da (3) alanınızda anlamlı sayacağınız EN KÜÇÜK FARK. Üçü de yoksa Cohen'in eşikleri bir başlangıçtır, gerekçe değildir.",
            en: "You must justify the effect size yourself: (1) a value reported by PREVIOUS RESEARCH on the same topic, (2) the result of your own PILOT study, or (3) the SMALLEST DIFFERENCE you would call meaningful in your field. Without one of these, Cohen's conventions are a starting point, not a justification.",
          })}
        </p>
        <p className="muted text-sm">
          {t({ tr: `${tanim.etkiSimgesi} için Cohen eşikleri: küçük ${tanim.esikler.kucuk}, orta ${tanim.esikler.orta}, büyük ${tanim.esikler.buyuk}.`,
               en: `Cohen's conventions for ${tanim.etkiSimgesi}: small ${tanim.esikler.kucuk}, medium ${tanim.esikler.orta}, large ${tanim.esikler.buyuk}.` })}
        </p>
        <div className="cluster">
          <button type="button" className="projects-filter-button button-compact" onClick={ornegiDoldur}>
            {t({ tr: "Örneği doldur", en: "Fill in the example" })}
          </button>
        </div>
        {ornekDolduruldu ? (
          <p className="alert mt-sm" data-tone="warning" role="status">
            {t({
              tr: `ÖRNEK DEĞERLER dolduruldu (${tanim.etkiSimgesi} = ${tanim.ornek.etki}, α = ${tanim.ornek.alfa}, güç = ${tanim.ornek.hedefGuc}). Bunlar sizin çalışmanızın sayıları DEĞİLDİR; yalnızca aracın nasıl çalıştığını gösterir. Kendi etki büyüklüğünüzü yukarıdaki üç yoldan biriyle gerekçelendirin.`,
              en: `EXAMPLE VALUES filled in (${tanim.etkiSimgesi} = ${tanim.ornek.etki}, α = ${tanim.ornek.alfa}, power = ${tanim.ornek.hedefGuc}). These are NOT your study's numbers; they only show how the tool works. Justify your own effect size in one of the three ways above.`,
            })}
          </p>
        ) : null}
      </section>

      {/* ---------- Girdiler ---------- */}
      <div className="project-form-grid">
        <label>
          <span>{t({ tr: `Etki büyüklüğü (${tanim.etkiSimgesi})`, en: `Effect size (${tanim.etkiSimgesi})` })}</span>
          <input type="text" inputMode="decimal" value={etki} onChange={(e) => setEtki(e.target.value)} placeholder={String(tanim.ornek.etki)} />
        </label>
        <label>
          <span>{t({ tr: "Alfa", en: "Alpha" })}</span>
          <input type="text" inputMode="decimal" value={alfa} onChange={(e) => setAlfa(e.target.value)} />
        </label>
        <label>
          <span>{t({ tr: "Hedef güç", en: "Target power" })}</span>
          <input type="text" inputMode="decimal" value={hedefGuc} onChange={(e) => setHedefGuc(e.target.value)} />
        </label>
        {tanim.yonSecilir ? (
          <label>
            <span>{t({ tr: "Test yönü", en: "Test direction" })}</span>
            <select value={yon} onChange={(e) => setYon(e.target.value as TestYonu)}>
              <option value="iki">{t({ tr: "Çift yönlü", en: "Two-tailed" })}</option>
              <option value="tek">{t({ tr: "Tek yönlü", en: "One-tailed" })}</option>
            </select>
          </label>
        ) : null}
        {yontem === "tekYonluAnova" ? (
          <label>
            <span>{t({ tr: "Grup sayısı", en: "Number of groups" })}</span>
            <input type="number" min={2} step={1} value={grupSayisi} onChange={(e) => setGrupSayisi(e.target.value)} />
          </label>
        ) : null}
        {yontem === "regresyon" ? (
          <label>
            <span>{t({ tr: "Yordayıcı sayısı", en: "Number of predictors" })}</span>
            <input type="number" min={1} step={1} value={yordayiciSayisi} onChange={(e) => setYordayiciSayisi(e.target.value)} />
          </label>
        ) : null}
        {yontem === "bagimsizT" ? (
          <label>
            <span>{t({ tr: "Dağılım oranı (2. grup / 1. grup)", en: "Allocation ratio (group 2 / group 1)" })}</span>
            <input type="text" inputMode="decimal" value={dagilimOrani} onChange={(e) => setDagilimOrani(e.target.value)} />
          </label>
        ) : null}
        <label>
          <span>{t({ tr: "Beklenen kayıp oranı (isteğe bağlı)", en: "Expected dropout rate (optional)" })}</span>
          <input type="text" inputMode="decimal" value={kayipOrani} onChange={(e) => setKayipOrani(e.target.value)} placeholder={dil === "en" ? "e.g. 0.10" : "örn. 0,10"} />
        </label>
      </div>

      {/* ---------- Sonuç ---------- */}
      {sonuc === null ? (
        <p className="muted text-sm">{t({ tr: "Sonuç için etki büyüklüğünü girin.", en: "Enter an effect size to see the result." })}</p>
      ) : sonuc.engel !== null ? (
        <p className="alert mt-sm" data-tone="danger" role="status">
          {t(GUC_ENGEL_METNI[sonuc.engel])}
        </p>
      ) : (
        <div className="analiz-guc-sonuc">
          <div className="table-scroll" role="region" aria-label={t({ tr: "Örneklem sonucu", en: "Sample size result" })} tabIndex={0}>
            <table className="stats-result-table">
              <tbody>
                <tr>
                  <th scope="row">
                    {sonuc.birim === "katilimci"
                      ? t({ tr: "Analize gereken katılımcı sayısı", en: "Participants needed for the analysis" })
                      : t({ tr: "Analize gereken en düşük toplam örneklem", en: "Minimum total sample needed for the analysis" })}
                  </th>
                  <td>
                    <b>{sonuc.n}</b>
                  </td>
                </tr>
                {sonuc.grupBasina ? (
                  <tr>
                    <th scope="row">{t({ tr: "Grup başına", en: "Per group" })}</th>
                    <td>{sonuc.grupBasina.join(" + ")}</td>
                  </tr>
                ) : null}
                <tr>
                  <th scope="row">{t({ tr: "Yuvarlamadan sonra ulaşılan güç", en: "Power achieved after rounding" })}</th>
                  <td>{say(sonuc.ulasilanGuc)}</td>
                </tr>
                {sonuc.birKucukGuc !== null ? (
                  <tr>
                    <th scope="row">
                      {t({ tr: `Bir küçük örneklemde (${sonuc.n - sonuc.adim}) güç`,
                           en: `Power at the next smaller sample (${sonuc.n - sonuc.adim})` })}
                    </th>
                    <td className="tone-text" data-tone="warning">
                      {say(sonuc.birKucukGuc)} — {t({ tr: "hedefin altında", en: "below the target" })}
                    </td>
                  </tr>
                ) : null}
                {sonuc.baslangicN !== null ? (
                  <tr>
                    <th scope="row">
                      {t({ tr: `Başlangıçta alınması gereken (${yuzde(girdi.kayipOrani ?? 0)} kayıp payıyla)`, en: `To recruit at the start (allowing ${yuzde(girdi.kayipOrani ?? 0)} dropout)` })}
                    </th>
                    <td>
                      <b>{sonuc.baslangicN}</b>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="muted text-sm">
            {t({
              tr: `Hesap ${t(tanim.cumleIciAd)} için, test istatistiğinin merkezi olmayan dağılımıyla yapıldı. Örneklem tam sayı olduğu için ulaşılan güç hedefin biraz üstündedir.`,
              en: `Computed for the ${t(tanim.cumleIciAd)} using the non-central distribution of the test statistic. Because the sample must be a whole number, the achieved power is slightly above the target.`,
            })}
            {tanim.yonSecilir ? "" : t({ tr: " Bu testin omnibus F sınavı tek kuyrukludur; yön seçeneği yoktur.", en: " The omnibus F test is one-tailed by construction; there is no direction option." })}
          </p>
          {metin ? (
            <div className="analiz-guc-metin">
              <div className="cluster">
                <strong>{t({ tr: "Tez önerisi / etik kurul için yöntem metni", en: "Method paragraph for a proposal or ethics application" })}</strong>
                <button type="button" className="projects-filter-button button-compact" onClick={kopyala}>
                  {kopyalandi ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {kopyalandi ? t({ tr: "Kopyalandı", en: "Copied" }) : t({ tr: "Kopyala", en: "Copy" })}
                </button>
              </div>
              <p>{metin}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
