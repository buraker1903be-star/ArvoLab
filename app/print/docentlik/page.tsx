import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { getDoktoraTarihi, getHedefler, getMyScoreEntries } from "@/app/actions/scoring";
import { etkinHedefler, faaliyetDonemi, hedefDurumlari, puanGruplari, puanYazisi } from "@/lib/docentlik-ozeti";
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
export default async function DocentlikDokumu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");
  if (await isSubscriptionBlocked()) {
    return (
      <div className="print-page">
        <p className="makbuz-uyari">{SUBSCRIPTION_BLOCKED_MESSAGE}</p>
      </div>
    );
  }

  const [profile, { satirlar: tumu, okunamadi }, { satirlar: hedefler, okunamadi: hedefOkunamadi }, doktora, params] = await Promise.all([
    getCurrentProfile(),
    getMyScoreEntries(),
    getHedefler(),
    getDoktoraTarihi(),
    searchParams,
  ]);
  // Ekrandaki dönem süzgeciyle aynı kural (lib/docentlik-ozeti.ts → faaliyetDonemi).
  const sonrasi = params.donem === "sonra";
  if (okunamadi || (sonrasi && doktora.okunamadi)) {
    return (
      <div className="print-page">
        <PrintActions backHref="/dashboard/associate-professorship" autoPrint={false} backLabel="Doçentlik Puanı'na dön" />
        <p className="makbuz-uyari">Faaliyet kayıtları okunamadı; eksik bir döküm basılmasın diye sayfa boş bırakıldı. Sayfayı yenileyin.</p>
      </div>
    );
  }
  const satirlar = sonrasi ? tumu.filter((e) => faaliyetDonemi(e.faaliyet_tarihi, doktora.tarih) === "sonra") : tumu;
  const { toplam, gruplar } = puanGruplari(satirlar);
  const { toplamHedef, grupHedefleri } = hedefDurumlari(etkinHedefler(hedefler, profile?.organization_id ?? null), toplam, gruplar);
  const belgesiz = satirlar.filter((e) => !e.belge_yolu).length;

  return (
    <div className="print-page">
      <PrintActions backHref="/dashboard/associate-professorship" autoPrint={false} backLabel="Doçentlik Puanı'na dön" />
      <article className="print-sheet makbuz docentlik-dokum">
        <header>
          <h1>Doçentlik puan dökümü</h1>
          <p>
            {profile?.full_name ?? ctx.user.email} · {trTarih(new Date())}
            {sonrasi ? ` · Doktora sonrası (${doktora.tarih ? trTarih(doktora.tarih) : "tarih girilmemiş"})` : ""}
          </p>
        </header>

        <dl className="docentlik-dokum-ozet">
          <dt>{sonrasi ? "Doktora sonrası puan" : "Toplam puan"}</dt>
          <dd className="makbuz-tutar">
            {puanYazisi(toplam)}
            {toplamHedef ? ` / ${puanYazisi(toplamHedef.hedef)}` : ""}
          </dd>
          {toplamHedef ? (
            <div>
              <dt>Hedefe kalan</dt>
              <dd>{toplamHedef.eksik > 0 ? `${puanYazisi(toplamHedef.eksik)} puan eksik` : "Hedef tamam"}</dd>
            </div>
          ) : null}
          {gruplar.map((g) => {
            const h = grupHedefleri.find((x) => x.grup === g.grup);
            return (
              <div key={g.grup}>
                <dt>{g.grup}</dt>
                <dd>
                  {puanYazisi(g.toplam)} puan · {g.kayitlar.length} faaliyet
                  {h ? ` · hedef ${puanYazisi(h.hedef)}${h.eksik > 0 ? `, ${puanYazisi(h.eksik)} eksik` : ", tamam"}` : ""}
                </dd>
              </div>
            );
          })}
          {grupHedefleri
            .filter((h) => !gruplar.some((g) => g.grup === h.grup))
            .map((h) => (
              <div key={h.grup}>
                <dt>{h.grup}</dt>
                <dd>0 puan · hedef {puanYazisi(h.hedef)}, {puanYazisi(h.eksik)} eksik</dd>
              </div>
            ))}
          <div>
            <dt>Belgesi eksik faaliyet</dt>
            <dd>{belgesiz ? `${belgesiz} / ${satirlar.length}` : "Yok"}</dd>
          </div>
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
                  <th>Tarih</th>
                  <th>Birim</th>
                  <th>Yazar</th>
                  <th>Belge</th>
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
                    <td>{e.faaliyet_tarihi ? trTarih(e.faaliyet_tarihi) : "—"}</td>
                    <td>{puanYazisi(e.unit_count)}</td>
                    <td>
                      {e.yazar_sayisi > 1
                        ? `${e.yazar_sayisi} · ${e.baslica_yazar ? "başlıca" : "diğer"}${e.paylasim_katsayisi < 1 ? ` ×${puanYazisi(e.paylasim_katsayisi)}` : ""}`
                        : "Tek"}
                    </td>
                    <td>{e.belge_yolu ? "Var" : "Eksik"}</td>
                    <td>{puanYazisi(e.computed_points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {gruplar.length === 0 ? <p>Henüz faaliyet eklenmedi.</p> : null}

        {hedefOkunamadi ? <p className="makbuz-uyari">Hedefler okunamadı; eksik puanlar bu dökümde yok.</p> : null}
        <p className="makbuz-uyari">
          Bu döküm resmî bir belge değildir ve ÜAK duyurusunun yerini tutmaz. Puanlar, kurumunuzun ArvoLab&apos;a girdiği
          kriterlere göre hesaplanmıştır; başvurudan önce güncel resmî kriterlerle karşılaştırın.
        </p>
      </article>
    </div>
  );
}
