import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { getMyScoreEntries } from "@/app/actions/scoring";
import { puanGruplari, puanYazisi } from "@/lib/docentlik-ozeti";
import { trTarih } from "@/lib/tr-time";
import PrintActions from "../manuscript/[id]/print-actions";

export const metadata: Metadata = { title: "Doçentlik puan dökümü · ArvoLab", robots: { index: false } };

/*
  DOÇENTLİK PUAN DÖKÜMÜ (26.10.2026). Başvuru dosyasını hazırlayan
  akademisyen faaliyetlerini grup grup, toplamlarıyla elinde tutmak
  istiyor; ekran bunu yalnızca açılır satırlarla veriyordu.

  Toplamlar ekranla AYNI fonksiyondan (lib/docentlik-ozeti.ts). Döküm
  RESMÎ DEĞİL: puanlar kurumun girdiği kriterlere göre hesaplanıyor ve
  sayfa bunu açıkça yazıyor.

  Abonelik kapısı: veri dışarı çıkaran bir yol (/dashboard dışında,
  paneldeki kapıya takılmıyor) — yazdırma sayfasıyla aynı kural.
*/
export default async function DocentlikDokumu() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");
  if (await isSubscriptionBlocked()) {
    return (
      <div className="print-page">
        <p className="makbuz-uyari">{SUBSCRIPTION_BLOCKED_MESSAGE}</p>
      </div>
    );
  }

  const [profile, { satirlar, okunamadi }] = await Promise.all([getCurrentProfile(), getMyScoreEntries()]);
  if (okunamadi) {
    return (
      <div className="print-page">
        <PrintActions backHref="/dashboard/associate-professorship" autoPrint={false} backLabel="Doçentlik Puanı'na dön" />
        <p className="makbuz-uyari">Faaliyet kayıtları okunamadı; eksik bir döküm basılmasın diye sayfa boş bırakıldı. Sayfayı yenileyin.</p>
      </div>
    );
  }
  const { toplam, gruplar } = puanGruplari(satirlar);

  return (
    <div className="print-page">
      <PrintActions backHref="/dashboard/associate-professorship" autoPrint={false} backLabel="Doçentlik Puanı'na dön" />
      <article className="print-sheet makbuz docentlik-dokum">
        <header>
          <h1>Doçentlik puan dökümü</h1>
          <p>
            {profile?.full_name ?? ctx.user.email} · {trTarih(new Date())}
          </p>
        </header>

        <dl className="docentlik-dokum-ozet">
          <dt>Toplam puan</dt>
          <dd className="makbuz-tutar">{puanYazisi(toplam)}</dd>
          {gruplar.map((g) => (
            <div key={g.grup}>
              <dt>{g.grup}</dt>
              <dd>
                {puanYazisi(g.toplam)} puan · {g.kayitlar.length} faaliyet
              </dd>
            </div>
          ))}
        </dl>

        {gruplar.map((g) => (
          <section key={g.grup}>
            <h2>
              {g.grup} — {puanYazisi(g.toplam)} puan
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Faaliyet</th>
                  <th>Birim</th>
                  <th>Puan</th>
                </tr>
              </thead>
              <tbody>
                {g.kayitlar.map((e) => (
                  <tr key={e.id}>
                    <td>{e.criteria?.code ?? "—"}</td>
                    <td>
                      {e.title}
                      {e.notes ? <small>{e.notes}</small> : null}
                    </td>
                    <td>{puanYazisi(e.unit_count)}</td>
                    <td>{puanYazisi(e.computed_points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {gruplar.length === 0 ? <p>Henüz faaliyet eklenmedi.</p> : null}

        <p className="makbuz-uyari">
          Bu döküm resmî bir belge değildir ve ÜAK duyurusunun yerini tutmaz. Puanlar, kurumunuzun ArvoLab&apos;a girdiği
          kriterlere göre hesaplanmıştır; başvurudan önce güncel resmî kriterlerle karşılaştırın.
        </p>
      </article>
    </div>
  );
}
