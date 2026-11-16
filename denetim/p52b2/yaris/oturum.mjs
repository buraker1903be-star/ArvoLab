// Gerçek PostgreSQL'e birden çok psql oturumu açıp ifadeleri ADIM ADIM,
// belirlenen sırayla çalıştıran küçük yardımcı. Yarış sırasını zamanlamaya
// bırakmıyoruz: bir ifade gönderilir, sonra ya bitmesi beklenir ya da
// gözcü oturumun pg_stat_activity'de onu KİLİT BEKLERKEN görmesi beklenir.
// "Bekliyor" kararı süreye değil veritabanının kendi beyanına dayanır;
// yoksa yavaş bir makinede yarış "kanıtı" yanlış sıralamayı ölçer.
//
// Bağımlılık yok (pg paketi depoda değil): psql süreçleri stdin'den beslenir,
// her ifadenin ardından benzersiz bir işaret basılır.

import { spawn } from "node:child_process";

export const BAGLANTI =
  process.env.YARIS_URL ??
  "postgresql://postgres:yerel-yigin@127.0.0.1:56432/p52b2_yaris";

let sayac = 0;

export class Oturum {
  constructor(ad, url = BAGLANTI) {
    this.ad = ad;
    this.tampon = "";
    this.bekleyen = null;
    this.surec = spawn(
      "psql",
      [url, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=0", "-v", "VERBOSITY=terse"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const al = (parca) => {
      this.tampon += parca.toString();
      this.#denetle();
    };
    this.surec.stdout.on("data", al);
    this.surec.stderr.on("data", al);
  }

  #denetle() {
    if (!this.bekleyen) return;
    const i = this.tampon.indexOf(this.bekleyen.isaret);
    if (i === -1) return;
    const cikti = this.tampon.slice(0, i).trim();
    this.tampon = this.tampon.slice(i + this.bekleyen.isaret.length);
    const { coz } = this.bekleyen;
    this.bekleyen = null;
    const hata = cikti
      .split("\n")
      .filter((s) => /^(psql:.*)?(ERROR|HATA)/.test(s) || s.includes("ERROR:"))
      .join("\n");
    coz({ cikti, hata: hata || null });
  }

  /** İfadeyi gönderir; bittiğinde çözülen bir söz döner. */
  gonder(sql) {
    if (this.bekleyen) throw new Error(`${this.ad}: önceki ifade bitmedi`);
    const isaret = `@@SON${++sayac}@@`;
    const soz = new Promise((coz) => {
      this.bekleyen = { isaret, coz };
    });
    this.surec.stdin.write(`${sql}\n\\echo ${isaret}\n`);
    return soz;
  }

  async calistir(sql) {
    return this.gonder(sql);
  }

  async pid() {
    if (this._pid) return this._pid;
    const r = await this.calistir("select pg_backend_pid();");
    this._pid = Number(r.cikti.split("\n").pop());
    return this._pid;
  }

  kapat() {
    this.surec.stdin.end();
  }
}

/**
 * pid'li oturum bir KİLİT beklemesine girene kadar bekler (en çok `ms`).
 * Döner: true = veritabanı kilit beklediğini söyledi; false = süre doldu.
 */
export async function kilitBekliyorMu(gozcu, pid, ms = 5000) {
  const son = Date.now() + ms;
  while (Date.now() < son) {
    const r = await gozcu.calistir(
      `select wait_event_type from pg_stat_activity where pid = ${pid};`,
    );
    if (r.cikti.trim() === "Lock") return true;
    await new Promise((c) => setTimeout(c, 25));
  }
  return false;
}

/** Bir ifadenin kilide TAKILMADAN bittiğini kanıtlar (bitmesi beklenir). */
export async function bitti(soz, ms = 5000) {
  let zaman;
  const sonuc = await Promise.race([
    soz,
    new Promise((c) => {
      zaman = setTimeout(() => c("ZAMAN_ASIMI"), ms);
    }),
  ]);
  clearTimeout(zaman);
  if (sonuc === "ZAMAN_ASIMI") throw new Error("ifade beklenen sürede bitmedi");
  return sonuc;
}
