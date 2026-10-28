"use client";

import type { ChangeEvent } from "react";
import Form from "next/form";
import { Search } from "lucide-react";
import type { EkipFiltresi } from "@/lib/ekip-listesi";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  Ekip listesinin arama ve süzgeçleri. Değerler adres satırında
  (lib/ekip-listesi.ts); seçim değişince form kendiliğinden gönderilir.
  Durum süzgeci (sayaçlar) gizli alanla taşınıyor: yoksa rol seçilince
  "Davet bekliyor" süzgeci sessizce düşer, liste büyür ve sebebi
  görünmezdi.
*/
export default function EkipFiltreleri({
  filtre,
  roller,
  kurumlar,
}: {
  filtre: EkipFiltresi;
  roller: { value: string; label: string }[];
  kurumlar: { id: string; name: string }[];
}) {
  const t = useCeviri();
  const gonder = (event: ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();
  return (
    <Form action="/dashboard/team" className="project-filters ekip-filtreleri" role="search" aria-label={t({ tr: "Kullanıcıları süz", en: "Filter users" })}>
      <label className="project-filter-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" name="q" defaultValue={filtre.q} placeholder={t({ tr: "Ad ya da e-posta ara", en: "Search name or email" })}
          aria-label={t({ tr: "Kullanıcı ara", en: "Search users" })} maxLength={100} />
      </label>
      <select name="rol" defaultValue={filtre.rol} onChange={gonder} className="compact-select" aria-label={t({ tr: "Rol", en: "Role" })}>
        <option value="">{t({ tr: "Tüm roller", en: "All roles" })}</option>
        {roller.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {kurumlar.length ? (
        <select name="kurum" defaultValue={filtre.kurum} onChange={gonder} className="compact-select" aria-label={t({ tr: "Kurum", en: "Institution" })}>
          <option value="">{t({ tr: "Tüm kurumlar", en: "All institutions" })}</option>
          {kurumlar.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      ) : null}
      {filtre.durum !== "tumu" ? <input type="hidden" name="durum" value={filtre.durum} /> : null}
    </Form>
  );
}
