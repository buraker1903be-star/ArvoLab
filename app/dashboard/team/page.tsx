import Link from "next/link";
import type { Metadata } from "next";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { Ban, Building2, MailPlus, Plus, Search, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { getCurrentProfile } from "@/app/actions/profile";
import {
  createOrganization,
  getAllProfiles,
  getOrganizations,
  inviteUser,
  setUserAccess,
  updateUserOrganization,
  updateUserRole,
} from "@/app/actions/team";
import { ROLE_LABELS, type UserRole } from "@/lib/project-labels";
import ActionForm from "../action-form";
import PanelDrawer from "../_components/panel-drawer";
import BosDurum from "../_components/bos-durum";
import EkipFiltreleri from "./ekip-filtreleri";
import { basHarfler, ekipAdresi, ekipFiltresiOku, ekipSayaclari, ekipSuz } from "@/lib/ekip-listesi";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Ekip Yönetimi", en: "Team Management" }) };
}

const ROLE_ORDER: UserRole[] = [
  "client",
  "employee",
  "expert",
  "controller",
  "academic_manager",
  "system_admin",
  "founder",
];

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih, tarihSaat } = await tarihler();
  const [profile, params] = await Promise.all([getCurrentProfile(), searchParams]);
  const isAdmin = profile?.role === "system_admin" || profile?.role === "founder";

  if (!isAdmin) {
    return (
      <main className="dashboard-page">
        {/* Yetki reddi de ortak kalıpta: iki sayfada iki ayrı elle
            yazılmış blok vardı ve ikisinde de geri dönüş yolu yoktu —
            kullanıcı menüden başka bir yere tıklamak zorunda kalıyordu. */}
        <BosDurum
          ikon={ShieldAlert}
          baslik={t({ tr: "Bu sayfa size kapalı", en: "You don't have access to this page" })}
          aciklama={t({
            tr: "Bu sayfaya yalnızca Sistem Yöneticisi ve Kurucu rolleri erişebilir.",
            en: "Only the System Administrator and Founder roles can access this page.",
          })}
          eylem={{ etiket: t({ tr: "Ana sayfaya dön", en: "Back to home" }), href: "/dashboard" }}
        />
      </main>
    );
  }

  const [{ members, directoryAvailable, okunamadi }, { satirlar: organizations, okunamadi: kurumOkunamadi }] = await Promise.all([getAllProfiles(), getOrganizations()]);
  const assignableRoles = profile?.role === "founder" ? ROLE_ORDER : ROLE_ORDER.filter((r) => r !== "founder");
  const kurumAdi = new Map(organizations.map((o) => [o.id, o.name]));

  // Arama, süzgeç, sayaçlar ve seçim adres satırında (lib/ekip-listesi.ts).
  const filtre = ekipFiltresiOku(params, ROLE_ORDER);
  const gorunen = ekipSuz(members, filtre);
  const sayaclar = ekipSayaclari(members, filtre, dil);
  const istenen = typeof params.sec === "string" ? params.sec : null;
  const secili = gorunen.find((m) => m.id === istenen) ?? gorunen[0] ?? null;

  async function handleRoleChange(userId: string, formData: FormData) {
    "use server";
    const role = String(formData.get("role") ?? "");
    return updateUserRole(userId, role);
  }

  async function handleOrgChange(userId: string, formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organizationId") ?? "");
    return updateUserOrganization(userId, organizationId);
  }

  async function handleCreateOrganization(formData: FormData) {
    "use server";
    return createOrganization(formData);
  }

  async function handleInvite(formData: FormData) {
    "use server";
    return inviteUser(formData);
  }

  async function handleAccess(userId: string, enabled: boolean) {
    "use server";
    return setUserAccess(userId, enabled);
  }

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Ekip Yönetimi", en: "Team Management" })}</h1>
          <p>
            {t({
              tr: "Kullanıcıları davet edin, rollerini ve kurumlarını belirleyin. Davetsiz kayıt olanlar",
              en: "Invite users and set their roles and institutions. People who sign up without an invitation start with the",
            })}{" "}
            <strong>{t(ROLE_LABELS.client)}</strong>{" "}
            {t({ tr: "rolüyle başlar ve yalnızca kendi çalışmasını görür.", en: "role and see only their own work." })}
          </p>
        </div>
        <div className="cluster">
          <PanelDrawer
            triggerLabel={t({ tr: "Kurum ekle", en: "Add institution" })}
            triggerIcon={<Building2 size={16} aria-hidden="true" />}
            triggerClassName="projects-filter-button"
            kicker={t({ tr: "Ekip", en: "Team" })}
            title={t({ tr: "Yeni kurum ekle", en: "Add a new institution" })}
            description={t({
              tr: "Kullanıcıları bir kuruma bağlamak için önce kurumu oluşturun.",
              en: "Create the institution first to link users to it.",
            })}
          >
            <ActionForm
              className="project-form-grid"
              action={handleCreateOrganization}
              successMessage={t({ tr: "Kurum eklendi.", en: "Institution added." })}
            >
              <label className="project-form-full">
                <span>{t({ tr: "Kurum adı", en: "Institution name" })}</span>
                <input name="name" type="text" placeholder={t({ tr: "Örn. AkademikMerkez", en: "E.g. AcademicCenter" })} required />
              </label>
              {organizations.length > 0 ? (
                <p className="hint project-form-full">
                  {t({ tr: "Mevcut kurumlar:", en: "Existing institutions:" })} {organizations.map((o) => o.name).join(", ")}
                </p>
              ) : null}
              <div className="project-form-actions">
                <button type="submit" className="projects-primary-button">
                  <Plus size={16} aria-hidden="true" />
                  {t({ tr: "Kurumu ekle", en: "Add institution" })}
                </button>
              </div>
            </ActionForm>
          </PanelDrawer>

          {directoryAvailable ? (
            <PanelDrawer
              triggerLabel={t({ tr: "Kullanıcı davet et", en: "Invite user" })}
              triggerIcon={<MailPlus size={16} aria-hidden="true" />}
              kicker={t({ tr: "Ekip", en: "Team" })}
              title={t({ tr: "Kullanıcı davet et", en: "Invite user" })}
              description={t({
                tr: "Davet edilen kişiye şifresini belirleyeceği bir bağlantı gönderilir. Rol ve kurum davetle birlikte atanır.",
                en: "The invited person receives a link to set their password. The role and institution are assigned with the invitation.",
              })}
            >
              <ActionForm
                className="project-form-grid"
                action={handleInvite}
                successMessage={t({ tr: "Davet e-postası gönderildi.", en: "Invitation email sent." })}
              >
                <label>
                  <span>{t({ tr: "E-posta", en: "Email" })}</span>
                  <input name="email" type="email" placeholder={t({ tr: "ornek@kurum.com", en: "name@institution.edu" })} autoComplete="off" required />
                </label>
                <label>
                  <span>{t({ tr: "Ad soyad", en: "Full name" })}</span>
                  <input name="fullName" type="text" placeholder={t({ tr: "Ayşe Demir", en: "Jane Smith" })} maxLength={120} />
                </label>
                <label>
                  <span>{t({ tr: "Rol", en: "Role" })}</span>
                  <select name="role" defaultValue="employee">
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {t(ROLE_LABELS[r])}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t({ tr: "Kurum", en: "Institution" })}</span>
                  <select name="organizationId" defaultValue={profile?.organization_id ?? ""}>
                    <option value="">{t({ tr: "Kurum yok", en: "No institution" })}</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="project-form-actions">
                  <button type="submit" className="projects-primary-button">
                    <MailPlus size={16} aria-hidden="true" />
                    {t({ tr: "Davet gönder", en: "Send invitation" })}
                  </button>
                </div>
              </ActionForm>
            </PanelDrawer>
          ) : null}
        </div>
      </section>

      {!directoryAvailable ? (
        <p className="alert" data-tone="warning" role="status">
          {t({
            tr: "Davet, e-posta listesi ve erişim durdurma için sunucuda",
            en: "Invitations, the email list and access suspension require the",
          })}{" "}
          <code>SUPABASE_SECRET_KEY</code>{" "}
          {t({ tr: "ortam değişkeni tanımlı olmalı.", en: "environment variable on the server." })}
        </p>
      ) : null}

      {kurumOkunamadi ? (
        /* Eskiden kurum listesinin okunamaması sessizdi: kurum adları boş,
           kurum seçici gizli, davet formu yalnızca "Kurum yok" sunuyordu ve
           yönetici farkında olmadan kurumsuz bir Kontrolör davet edebiliyordu. */
        <p className="alert" data-tone="danger" role="alert">
          {t({
            tr: "Kurum listesi okunamadı; kurum adları ve kurum seçimi eksik görünür. Davet ya da kurum ataması yapmadan önce sayfayı yenileyin.",
            en: "The institution list could not be loaded; institution names and selection will look incomplete. Refresh the page before inviting or assigning institutions.",
          })}
        </p>
      ) : null}
      {okunamadi ? (
        <section className="alert" data-tone="danger" role="alert">
          <strong>{t({ tr: "Kullanıcı listesi okunamadı.", en: "The user list could not be loaded." })}</strong>
          <p>
            {t({
              tr: "Bu bir bağlantı ya da yetki arızası; kullanıcılar yerinde duruyor. Sayfayı yenileyin.",
              en: "This is a connection or permission failure; the users are still there. Refresh the page.",
            })}
          </p>
        </section>
      ) : members.length === 0 ? (
        /* Eskiden liste boşken başlığın altı tamamen boş bir <div> kalıyordu. */
        <BosDurum
          ikon={UserCog}
          aciklama={t({
            tr: "Listelenecek kullanıcı yok. Yeni kullanıcılar davet edildiğinde ya da kayıt olduğunda burada görünür.",
            en: "No users to list. New users appear here when they are invited or sign up.",
          })}
        />
      ) : (
        <>
          {/* Sayaçlar filtredir: sayı, basınca açılan listenin uzunluğu. */}
          <nav className="personel-sayaclar" aria-label={t({ tr: "Kullanıcı durumları", en: "User statuses" })}>
            {sayaclar.map((sayac) => (
              <Link
                key={sayac.durum}
                href={sayac.href}
                className="personel-sayac"
                data-tone={sayac.sayi ? sayac.ton : undefined}
                aria-current={sayac.secili ? "true" : undefined}
              >
                <b>{sayac.sayi}</b>
                <span>{sayac.etiket}</span>
              </Link>
            ))}
          </nav>

          <EkipFiltreleri
            key={JSON.stringify(filtre)}
            filtre={filtre}
            roller={ROLE_ORDER.map((r) => ({ value: r, label: t(ROLE_LABELS[r]) }))}
            kurumlar={organizations}
          />

          {/*
            İKİ KART (26.10.2026): solda kullanıcılar, sağda seçili
            kullanıcının rolü, kurumu ve erişimi. Eskiden her kullanıcı
            üç formlu uzun bir karttı ve sayfa yüz kullanıcıda
            kilometrelerce kayıyordu.
          */}
          <section className="gb-sutunlar calismalar-ikili" aria-label={t({ tr: "Kullanıcılar", en: "Users" })}>
            <article className="gb-kart gb-sutun">
              <header className="gb-kart-bas">
                <div>
                  <h2>{t({ tr: "Kullanıcılar", en: "Users" })}</h2>
                  <p>
                    {gorunen.length === members.length
                      ? t({ tr: `${members.length} kullanıcı`, en: `${members.length} ${members.length === 1 ? "user" : "users"}` })
                      : t({ tr: `${gorunen.length}/${members.length} kullanıcı`, en: `${gorunen.length}/${members.length} users` })}
                  </p>
                </div>
              </header>
              {gorunen.length === 0 ? (
                <BosDurum
                  kompakt
                  ikon={Search}
                  aciklama={t({ tr: "Süzgece uyan kullanıcı yok.", en: "No users match the filter." })}
                  eylem={{ etiket: t({ tr: "Süzgeci temizle", en: "Clear filter" }), href: "/dashboard/team" }}
                />
              ) : (
                <ul className="gb-liste calisma-secim">
                  {gorunen.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={ekipAdresi(filtre, m.id)}
                        className="gb-satir"
                        aria-current={m.id === secili?.id ? "true" : undefined}
                        scroll={false}
                      >
                        <span className="ekip-avatar" aria-hidden="true">
                          {basHarfler(m.full_name, m.email)}
                        </span>
                        <span className="gb-satir-govde">
                          <b>
                            {m.full_name || m.email || t({ tr: "İsimsiz kullanıcı", en: "Unnamed user" })}
                            {m.id === profile?.id ? t({ tr: " (siz)", en: " (you)" }) : ""}
                          </b>
                          <small>
                            {[t(ROLE_LABELS[m.role]), m.organization_id ? kurumAdi.get(m.organization_id) : t({ tr: "Kurum yok", en: "No institution" }), m.full_name ? m.email : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        </span>
                        {m.disabled ? (
                          <span className="status-pill" data-tone="danger">{t({ tr: "Durduruldu", en: "Suspended" })}</span>
                        ) : m.pendingInvite ? (
                          <span className="status-pill" data-tone="warning">{t({ tr: "Davet", en: "Invited" })}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {secili ? (
              <article className="gb-kart gb-sutun calisma-durum kayan-kart" aria-label={t({
                  tr: `${secili.full_name || secili.email || "Kullanıcı"}: ayrıntı`,
                  en: `${secili.full_name || secili.email || "User"}: details`,
                })}>
                <header className="calisma-durum-bas">
                  <div className="ekip-kimlik">
                    <span className="ekip-avatar ekip-avatar-buyuk" aria-hidden="true">
                      {basHarfler(secili.full_name, secili.email)}
                    </span>
                    <div>
                      <span className="calisma-durum-ust">
                        <span className="status-pill" data-tone="neutral">{t(ROLE_LABELS[secili.role])}</span>
                        {secili.pendingInvite ? <span className="status-pill" data-tone="warning">{t({ tr: "Davet bekliyor", en: "Invitation pending" })}</span> : null}
                        {secili.disabled ? <span className="status-pill" data-tone="danger">{t({ tr: "Erişim durduruldu", en: "Access suspended" })}</span> : null}
                      </span>
                      <h2>
                        {secili.full_name || t({ tr: "İsimsiz kullanıcı", en: "Unnamed user" })}
                        {secili.id === profile?.id ? t({ tr: " (siz)", en: " (you)" }) : ""}
                      </h2>
                      <span className="personel-ogrenci">{secili.email ?? <span className="mono">{secili.id}</span>}</span>
                    </div>
                  </div>
                </header>

                <dl className="tez-olcumler calisma-olcumler">
                  <div className="tez-olcu">
                    <dt>{t({ tr: "Kurum", en: "Institution" })}</dt>
                    <dd className="ekip-olcu-metin">
                      {secili.organization_id ? kurumAdi.get(secili.organization_id) ?? t({ tr: "Bilinmeyen kurum", en: "Unknown institution" }) : "—"}
                    </dd>
                    <span>{secili.organization_id ? t({ tr: "Bağlı", en: "Linked" }) : t({ tr: "Kuruma bağlı değil", en: "Not linked to an institution" })}</span>
                  </div>
                  <div className="tez-olcu">
                    <dt>{t({ tr: "Kayıt", en: "Joined" })}</dt>
                    <dd className="ekip-olcu-metin">{tarih(secili.created_at)}</dd>
                    <span>{secili.pendingInvite ? t({ tr: "Davetle eklendi", en: "Added by invitation" }) : t({ tr: "Hesap açıldı", en: "Account created" })}</span>
                  </div>
                  <div className="tez-olcu">
                    <dt>{t({ tr: "Son giriş", en: "Last sign-in" })}</dt>
                    <dd className="ekip-olcu-metin">{secili.lastSignInAt ? tarih(secili.lastSignInAt) : "—"}</dd>
                    <span>
                      {secili.lastSignInAt
                        ? tarihSaat(secili.lastSignInAt)
                        : directoryAvailable
                          ? t({ tr: "Hiç giriş yapmadı", en: "Never signed in" })
                          : t({ tr: "Dizin kapalı (sunucu anahtarı yok)", en: "Directory unavailable (no server key)" })}
                    </span>
                  </div>
                </dl>

                <section className="personel-denetim" aria-label={t({ tr: "Rol ve kurum", en: "Role and institution" })}>
                  <h3 className="calisma-durum-alt">{t({ tr: "Rol ve kurum", en: "Role and institution" })}</h3>
                  {secili.id === profile?.id ? (
                    <p className="muted text-sm">
                      {t({ tr: "Kendi rolünüzü değiştiremezsiniz; başka bir yöneticiden isteyin.", en: "You cannot change your own role; ask another administrator." })}
                    </p>
                  ) : null}
                  <ActionForm action={handleRoleChange.bind(null, secili.id)} className="personel-denetim-satir" successMessage={t({ tr: "Rol kaydedildi.", en: "Role saved." })}>
                    <label className="personel-ata">
                      <span className="muted text-sm">{t({ tr: "Rol", en: "Role" })}</span>
                      <select
                        name="role"
                        defaultValue={secili.role}
                        className="compact-select"
                        disabled={secili.id === profile?.id}
                        aria-label={t({ tr: "Rol", en: "Role" })}
                      >
                        {/* Kurucu rolünü yalnızca kurucu atayabilir; mevcut rol listede kalmalı ki seçim bozulmasın. */}
                        {(assignableRoles.includes(secili.role) ? assignableRoles : [...assignableRoles, secili.role]).map((r) => (
                          <option key={r} value={r}>
                            {t(ROLE_LABELS[r])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="projects-filter-button button-compact" disabled={secili.id === profile?.id}>
                      {t({ tr: "Rolü kaydet", en: "Save role" })}
                    </button>
                  </ActionForm>
                  {organizations.length > 0 ? (
                    <ActionForm action={handleOrgChange.bind(null, secili.id)} className="personel-denetim-satir" successMessage={t({ tr: "Kurum kaydedildi.", en: "Institution saved." })}>
                      <label className="personel-ata">
                        <span className="muted text-sm">{t({ tr: "Kurum", en: "Institution" })}</span>
                        <select
                          name="organizationId"
                          defaultValue={secili.organization_id ?? ""}
                          className="compact-select"
                          aria-label={t({ tr: "Kurum", en: "Institution" })}
                        >
                          <option value="">{t({ tr: "Kurum yok", en: "No institution" })}</option>
                          {organizations.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="submit" className="projects-filter-button button-compact">
                        {t({ tr: "Kurumu kaydet", en: "Save institution" })}
                      </button>
                    </ActionForm>
                  ) : null}
                </section>

                {directoryAvailable && secili.id !== profile?.id ? (
                  <section className="personel-denetim ekip-erisim" data-tone={secili.disabled ? undefined : "danger"} aria-label={t({ tr: "Erişim", en: "Access" })}>
                    <h3 className="calisma-durum-alt">{t({ tr: "Erişim", en: "Access" })}</h3>
                    <div className="personel-denetim-satir">
                      <span className="muted text-sm">
                        {secili.disabled
                          ? t({
                              tr: "Kullanıcı giriş yapamıyor. Erişimi açınca kaldığı yerden devam eder; verileri silinmedi.",
                              en: "The user cannot sign in. Once access is restored they pick up where they left off; their data was not deleted.",
                            })
                          : t({
                              tr: "Durdurulursa kullanıcı giriş yapamaz; açık oturumu en geç 1 saat içinde kapanır. Verileri silinmez.",
                              en: "If suspended, the user cannot sign in; any open session ends within 1 hour at most. Their data is not deleted.",
                            })}
                      </span>
                      <ActionForm
                        action={handleAccess.bind(null, secili.id, secili.disabled)}
                        confirmMessage={
                          secili.disabled
                            ? t({
                                tr: `${secili.full_name || secili.email || "Bu kullanıcı"} için erişim yeniden açılsın mı?`,
                                en: `Restore access for ${secili.full_name || secili.email || "this user"}?`,
                              })
                            : t({
                                tr: `${secili.full_name || secili.email || "Bu kullanıcı"} için erişim durdurulsun mu? Kullanıcı giriş yapamaz; açık oturumu en geç 1 saat içinde kapanır.`,
                                en: `Suspend access for ${secili.full_name || secili.email || "this user"}? They will not be able to sign in; any open session ends within 1 hour at most.`,
                              })
                        }
                        successMessage={
                          secili.disabled ? t({ tr: "Erişim yeniden açıldı.", en: "Access restored." }) : t({ tr: "Erişim durduruldu.", en: "Access suspended." })
                        }
                      >
                        <button type="submit" className={secili.disabled ? "button-success button-compact" : "button-danger button-compact"}>
                          {secili.disabled ? <ShieldCheck size={14} aria-hidden="true" /> : <Ban size={14} aria-hidden="true" />}
                          {secili.disabled ? t({ tr: "Erişimi aç", en: "Restore access" }) : t({ tr: "Erişimi durdur", en: "Suspend access" })}
                        </button>
                      </ActionForm>
                    </div>
                  </section>
                ) : null}
              </article>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
