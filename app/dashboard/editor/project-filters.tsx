"use client";

import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { filtreAdresi, type ProjectFilters as Filters } from "@/lib/project-filters";
import { useCeviri } from "@/app/_components/dil-saglayici";
import Secici from "@/app/dashboard/_components/secici";
import type { Tone } from "@/lib/status-tone";

// Çalışmalarım: arama, durum/sorumlu filtresi ve sıralama. Değerler adres satırında tutulur
// (yenileyince ve paylaşınca korunur); seçim değişince liste sayfa yenilenmeden güncellenir.
export default function ProjectFilters({
  filters,
  statuses,
  showAssignee,
  total,
  shown,
  filtered,
}: {
  filters: Filters;
  statuses: { value: string; label: string; tone?: Tone }[];
  showAssignee: boolean;
  total: number;
  shown: number;
  filtered: boolean;
}) {
  const t = useCeviri();

  /*
    "Onay bekleyenler" ve "yorumu olanlar" filtreleri ana sayfadaki dikkat
    kartlarından geliyor; çubukta kendi seçicileri yok. İkisi de GİZLİ ALANLA
    taşınıyor, yoksa kullanıcı sıralamayı değiştirdiği anda form adresi
    sıfırdan kurar ve filtre sessizce düşerdi — liste büyür, sebebi
    görünmezdi. Yanlarındaki çip hem filtrenin açık olduğunu söylüyor hem de
    kaldırma yolunu veriyor.
  */
  const adres = (degisiklik: Partial<Filters>) => filtreAdresi({ ...filters, ...degisiklik });

  return (
    <Form action="/dashboard/editor" className="project-filters" role="search" aria-label={t({ tr: "Çalışmaları filtrele", en: "Filter works" })}>
      <label className="project-filter-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" name="q" defaultValue={filters.q} placeholder={
            showAssignee
              ? t({ tr: "Başlık, öğrenci ya da üniversite ara", en: "Search title, student or university" })
              : t({ tr: "Başlık ya da üniversite ara", en: "Search title or university" })
          }
          aria-label={t({ tr: "Çalışma ara", en: "Search works" })} maxLength={100} />
      </label>
      {/* Durum seçenekleri üç grupta: teslim tarihine göre süzgeçler ile
          çalışmanın aşaması ayrı şeyler, eskiden tek düz listedeydi. */}
      <Secici
        name="durum"
        deger={filters.status}
        otomatikGonder
        etiket={t({ tr: "Durum", en: "Status" })}
        onEk={t({ tr: "Durum", en: "Status" })}
        gruplar={[
          {
            secenekler: [
              { deger: "tumu", etiket: t({ tr: "Tüm durumlar", en: "All statuses" }) },
              { deger: "aktif", etiket: t({ tr: "Aktif (teslim edilmemiş)", en: "Active (not submitted)" }), ton: "accent" },
            ],
          },
          {
            baslik: t({ tr: "Teslim", en: "Due date" }),
            secenekler: [
              { deger: "gecikmis", etiket: t({ tr: "Teslimi geçmiş", en: "Overdue" }), ton: "danger" },
              { deger: "yaklasan", etiket: t({ tr: "7 gün içinde teslim", en: "Due within 7 days" }), ton: "warning" },
            ],
          },
          {
            baslik: t({ tr: "Aşama", en: "Stage" }),
            secenekler: statuses.map((status) => ({ deger: status.value, etiket: status.label, ton: status.tone })),
          },
        ]}
      />
      {showAssignee ? (
        <Secici
          name="atanan"
          deger={filters.assignee}
          otomatikGonder
          etiket={t({ tr: "Sorumlu", en: "Assignee" })}
          onEk={t({ tr: "Sorumlu", en: "Assignee" })}
          gruplar={[
            {
              secenekler: [
                { deger: "tumu", etiket: t({ tr: "Tüm sorumlular", en: "All assignees" }) },
                { deger: "benim", etiket: t({ tr: "Bana atananlar", en: "Assigned to me" }) },
                { deger: "atanmamis", etiket: t({ tr: "Sorumlu atanmamış", en: "Unassigned" }) },
              ],
            },
          ]}
        />
      ) : null}
      <Secici
        name="sirala"
        deger={filters.sort}
        otomatikGonder
        etiket={t({ tr: "Sıralama", en: "Sort" })}
        onEk={t({ tr: "Sırala", en: "Sort" })}
        gruplar={[
          {
            secenekler: [
              { deger: "yeni", etiket: t({ tr: "Son eklenen", en: "Recently added" }) },
              { deger: "duzenleme", etiket: t({ tr: "Son düzenlenen", en: "Recently edited" }) },
              { deger: "teslim", etiket: t({ tr: "Teslim tarihi yakın", en: "Due soonest" }) },
              { deger: "baslik", etiket: t({ tr: "Başlığa göre (A–Z)", en: "By title (A–Z)" }) },
            ],
          },
        ]}
      />
      {filters.approval !== "tumu" ? <input type="hidden" name="onay" value={filters.approval} /> : null}
      {filters.comments !== "tumu" ? <input type="hidden" name="yorum" value={filters.comments} /> : null}
      {filters.approval === "bekliyor" ? (
        <Link href={adres({ approval: "tumu" })} className="chip" data-tone="info">
          {t({ tr: "Yalnızca onay bekleyenler", en: "Only awaiting approval" })} ✕
        </Link>
      ) : null}
      {filters.comments === "acik" ? (
        <Link href={adres({ comments: "tumu" })} className="chip" data-tone="info">
          {t({ tr: "Yalnızca yorumu olanlar", en: "Only with comments" })} ✕
        </Link>
      ) : null}
      <span className="muted text-sm project-filter-count" role="status">
        {shown === total
          ? t({ tr: `${total} çalışma`, en: `${total} work${total === 1 ? "" : "s"}` })
          : t({ tr: `${total} çalışmadan ${shown} gösteriliyor`, en: `Showing ${shown} of ${total} works` })}
      </span>
      {filtered ? (
        <Link href="/dashboard/editor" className="result-link">
          {t({ tr: "Filtreyi temizle", en: "Clear filter" })}
        </Link>
      ) : null}
    </Form>
  );
}
