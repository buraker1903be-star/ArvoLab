"use client";

/*
  SÜTUN SEÇİMİ: onay kutuları (27.10.2026).

  Madde, yordayıcı ve ölçüm seçimi eskiden çoklu <select> idi ve
  "Ctrl/Cmd ile birden çok seçin" yazıyordu. Öğrencilerin çoğu bunu
  bilmiyor: tıkladığı her madde öncekini siliyordu, telefonda Ctrl hiç
  yok. Yirmi maddelik bir ölçekte bir kez yanlış tıklamak bütün seçimi
  sıfırlıyordu. Onay kutusu her yerde aynı çalışır.

  Seçim sırası VERİDEKİ sırayı izler (Friedman'da ölçümlerin sırası
  raporun sırasıdır; öğrencinin tıklama sırasına bağlı olmasın).
*/
export default function SutunSecimi({
  etiket,
  sutunlar,
  secili,
  degistir,
  ipucu,
}: {
  etiket: string;
  sutunlar: string[];
  secili: string[];
  degistir: (yeni: string[]) => void;
  ipucu?: string;
}) {
  const ac = (sutun: string, isaretli: boolean) =>
    degistir(sutunlar.filter((c) => (c === sutun ? isaretli : secili.includes(c))));

  return (
    <fieldset className="project-form-full sutun-secimi">
      <legend>
        {etiket} <small className="muted">· {secili.length} seçili</small>
      </legend>
      <div className="cluster">
        <button type="button" className="projects-filter-button button-compact" onClick={() => degistir([...sutunlar])}>
          Tümünü seç
        </button>
        <button type="button" className="projects-filter-button button-compact" onClick={() => degistir([])} disabled={!secili.length}>
          Temizle
        </button>
      </div>
      <div className="sutun-secimi-liste">
        {sutunlar.map((c) => (
          <label key={c}>
            <input type="checkbox" checked={secili.includes(c)} onChange={(e) => ac(c, e.target.checked)} />
            <span>{c}</span>
          </label>
        ))}
      </div>
      {ipucu ? <p className="hint">{ipucu}</p> : null}
    </fieldset>
  );
}
