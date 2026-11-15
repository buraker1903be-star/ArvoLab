/*
  project_manuscripts.updated_at karşılaştırması (P52a2). Damga iyimser
  kilidin anahtarı: "satır hâlâ editörün açtığı hâlde mi?" sorusu ona
  soruluyor. İki damga METİN olarak karşılaştırılmaz: PostgREST aynı anı aynı
  biçimde yazsa da istemcinin elindeki değer başka bir yoldan gelmiş olabilir
  ("…T10:00:00.123Z" ile "…T10:00:00.123+00:00" aynı an) ve Postgres
  ondalığın sonundaki sıfırları atar (".1230" değil ".123"). Mikrosaniye
  JavaScript Date'ine sığmadığı için (milisaniye) saniye ve ondalık ayrı
  karşılaştırılır: tetikleyici (20261115…_metin_surum_damgasi) damgayı
  mikrosaniye hassasiyetinde yazıyor ve aynı milisaniyedeki iki kayıt ancak
  böyle ayırt edilir.
*/

const DESEN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** [UTC epoch saniyesi, nanosaniye]; çözülemezse null. */
export function damgaCoz(damga: string): [number, number] | null {
  const m = DESEN.exec(damga.trim());
  if (!m) return null;
  const [, y, ay, g, sa, dk, sn, ondalik = "", bolge = "Z"] = m;
  let fark = 0;
  if (bolge !== "Z") {
    const isaret = bolge[0] === "-" ? -1 : 1;
    const rakam = bolge.slice(1).replace(":", "");
    fark = isaret * (Number(rakam.slice(0, 2)) * 60 + Number(rakam.slice(2, 4) || "0")) * 60;
  }
  const saniye = Date.UTC(+y, +ay - 1, +g, +sa, +dk, +sn) / 1000 - fark;
  return [saniye, Number(ondalik.padEnd(9, "0"))];
}

export function damgaAyniMi(a: string, b: string): boolean {
  if (a === b) return true;
  const x = damgaCoz(a);
  const y = damgaCoz(b);
  if (!x || !y) return false;
  return x[0] === y[0] && x[1] === y[1];
}
