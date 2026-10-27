/*
  PROFİL GRAFİĞİ (karma ANOVA, 27.10.2026): her grubun ölçümler boyunca
  ortalaması. Etkileşim sayıdan önce gözle okunur — çizgiler paralelse
  etkileşim yok, açılıyor ya da kesişiyorsa var. SPSS'in "Profile Plots"
  çıktısının karşılığı; tez bulgularına çoğunlukla bu grafik konuyor.

  Renkler token sınıflarıyla (genel-bakis.css), satır içi stil yok.
*/
export default function ProfilGrafigi({
  olcumler,
  gruplar,
  ortalamalar,
}: {
  olcumler: string[];
  gruplar: string[];
  /** [grup][ölçüm] */
  ortalamalar: number[][];
}) {
  const G = 420;
  const Y = 220;
  const sol = 44;
  const sag = 16;
  const ust = 14;
  const alt = 34;
  const hepsi = ortalamalar.flat().filter(Number.isFinite);
  if (!hepsi.length || olcumler.length < 2) return null;
  let min = Math.min(...hepsi);
  let max = Math.max(...hepsi);
  const pay = (max - min || 1) * 0.12;
  min -= pay;
  max += pay;
  const x = (t: number) => sol + (t * (G - sol - sag)) / (olcumler.length - 1);
  const y = (v: number) => ust + ((max - v) * (Y - ust - alt)) / (max - min);
  const cizgiler = [0, 0.5, 1].map((k) => min + k * (max - min));

  return (
    <figure className="profil-grafigi">
      <svg viewBox={`0 0 ${G} ${Y}`} role="img" aria-label="Grupların ölçümler boyunca ortalamaları">
        {cizgiler.map((v) => (
          <g key={v}>
            <line className="profil-izgara" x1={sol} x2={G - sag} y1={y(v)} y2={y(v)} />
            <text className="profil-eksen" x={sol - 6} y={y(v) + 4} textAnchor="end">
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {olcumler.map((o, t) => (
          <text key={o} className="profil-eksen" x={x(t)} y={Y - 12} textAnchor="middle">
            {o.length > 14 ? `${o.slice(0, 13)}…` : o}
          </text>
        ))}
        {gruplar.map((g, j) => (
          <g key={g} className="profil-seri" data-sira={j % 5}>
            <polyline points={ortalamalar[j].map((v, t) => `${x(t)},${y(v)}`).join(" ")} />
            {ortalamalar[j].map((v, t) => (
              <circle key={t} cx={x(t)} cy={y(v)} r={3.5} />
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="cluster">
        {gruplar.map((g, j) => (
          <span key={g} className="profil-lejant" data-sira={j % 5}>
            {g}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
