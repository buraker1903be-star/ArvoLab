import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { getDoktoraTarihi, getHedefler, getMyScoreEntries } from "@/app/actions/scoring";
import { etkinHedefler, faaliyetDonemi, hedefDurumlari, puanGruplari, puanYazisi, tavanUygula } from "@/lib/docentlik-ozeti";
import { trTarih } from "@/lib/tr-time";
import PrintActions from "../manuscript/[id]/print-actions";

export const metadata: Metadata = { title: "Doçentlik puan dökümü", robots: { index: false } };

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
  // Ekranla aynı kurallar: alan, tavan ve doktora sonrası şartlar (app/dashboard/associate-professorship/page.tsx).
  const alan = (typeof params.alan === "string" && params.alan.trim()) || doktora.temelAlan || null;
  const altAlan =
    (typeof params.altalan === "string" && params.altalan.trim()) || (alan && alan === doktora.temelAlan ? doktora.altAlan : null) || null;
  const etkin = etkinHedefler(hedefler, profile?.organization_id ?? null, alan, altAlan);
  const sonraSatirlari = doktora.tarih ? tumu.filter((e) => faaliyetDonemi(e.faaliyet_tarihi, doktora.tarih) === "sonra") : null;
  const tumOzet = tavanUygula(puanGruplari(tumu), etkin);
  const sonraOzet = sonraSatirlari ? tavanUygula(puanGruplari(sonraSatirlari), etkin) : null;
  const satirlar = sonrasi ? (sonraSatirlari ?? []) : tumu;
  const gorunen = sonrasi ? (sonraOzet ?? tavanUygula(puanGruplari([]), etkin)) : tumOzet;
  const { toplam, gruplar } = gorunen;
  const { toplamHedefleri, grupHedefleri } = hedefDurumlari(etkin, tumOzet, sonraOzet);
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
            {alan ? ` · ${alan}` : ""}
            {altAlan ? ` · ${altAlan}` : ""}
          </p>
        </header>

        <dl className="docentlik-dokum-ozet">
          <dt>{sonrasi ? "Doktora sonrası sayılan puan" : "Sayılan puan"}</dt>
          <dd className="makbuz-tutar">{puanYazisi(toplam)}</dd>
          {gorunen.ham > toplam ? (
            <div>
              <dt>Tavan nedeniyle sayılmayan</dt>
              <dd>{puanYazisi(gorunen.ham - toplam)} puan (beyan edilen {puanYazisi(gorunen.ham)})</dd>
            </div>
          ) : null}
          {toplamHedefleri.map((h) => (
            <div key={String(h.doktoraSonrasi)}>
              <dt>{h.doktoraSonrasi ? "Doktora sonrası en az" : "Toplam en az"} {puanYazisi(h.hedef)}</dt>
              <dd>
                {puanYazisi(h.mevcut)} · {h.eksik > 0 ? `${puanYazisi(h.eksik)} puan eksik` : "tamam"}
              </dd>
            </div>
          ))}
          {[...new Set([...gruplar.map((g) => g.grup), ...grupHedefleri.map((h) => h.grup!)])].map((grup) => {
            const g = gruplar.find((x) => x.grup === grup);
            const sartlar = grupHedefleri.filter((x) => x.grup === grup);
            return (
              <div key={grup}>
                <dt>{grup}</dt>
                <dd>
                  {puanYazisi(g?.toplam ?? 0)} puan · {g?.kayitlar.length ?? 0} faaliyet
                  {g?.azami != null ? ` · en fazla ${puanYazisi(g.azami)}` : ""}
                  {sartlar
                    .map((h) => ` · en az ${puanYazisi(h.hedef)}${h.doktoraSonrasi ? " (doktora sonrası)" : ""}: ${h.eksik > 0 ? `${puanYazisi(h.eksik)} eksik` : "tamam"}`)
                    .join("")}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>Belgesi eksik faaliyet</dt>
            <dd>{belgesiz ? `${belgesiz} / ${satirlar.length}` : "Yok"}</dd>
          </div>
        </dl>

        {gruplar.map((g) => (
          <section key={g.grup}>
            <h2>
              {g.grup} — {puanYazisi(g.toplam)} puan{g.ham > g.toplam ? ` (beyan ${puanYazisi(g.ham)}, tavan ${puanYazisi(g.azami ?? 0)})` : ""}
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
