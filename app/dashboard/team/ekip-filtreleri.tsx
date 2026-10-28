"use client";

import Form from "next/form";
import { Search } from "lucide-react";
import type { EkipFiltresi } from "@/lib/ekip-listesi";
import { useCeviri } from "@/app/_components/dil-saglayici";
import Secici from "@/app/dashboard/_components/secici";

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
  return (
    <Form action="/dashboard/team" className="project-filters ekip-filtreleri" role="search" aria-label={t({ tr: "Kullanıcıları süz", en: "Filter users" })}>
      <label className="project-filter-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" name="q" defaultValue={filtre.q} placeholder={t({ tr: "Ad ya da e-posta ara", en: "Search name or email" })}
          aria-label={t({ tr: "Kullanıcı ara", en: "Search users" })} maxLength={100} />
      </label>
      <Secici
        name="rol"
        deger={filtre.rol}
        otomatikGonder
        etiket={t({ tr: "Rol", en: "Role" })}
        onEk={t({ tr: "Rol", en: "Role" })}
        gruplar={[
          { secenekler: [{ deger: "", etiket: t({ tr: "Tüm roller", en: "All roles" }) }] },
          { secenekler: roller.map((r) => ({ deger: r.value, etiket: r.label })) },
        ]}
      />
      {kurumlar.length ? (
        <Secici
          name="kurum"
          deger={filtre.kurum}
          otomatikGonder
          etiket={t({ tr: "Kurum", en: "Institution" })}
          onEk={t({ tr: "Kurum", en: "Institution" })}
          gruplar={[
            { secenekler: [{ deger: "", etiket: t({ tr: "Tüm kurumlar", en: "All institutions" }) }] },
            { secenekler: kurumlar.map((k) => ({ deger: k.id, etiket: k.name })) },
          ]}
        />
      ) : null}
      {filtre.durum !== "tumu" ? <input type="hidden" name="durum" value={filtre.durum} /> : null}
    </Form>
  );
}
