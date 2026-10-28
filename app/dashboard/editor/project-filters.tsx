"use client";

import type { ChangeEvent } from "react";
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { filtreAdresi, type ProjectFilters as Filters } from "@/lib/project-filters";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
  statuses: { value: string; label: string }[];
  showAssignee: boolean;
  total: number;
  shown: number;
  filtered: boolean;
}) {
  const t = useCeviri();
  const submit = (event: ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();

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
      <select name="durum" defaultValue={filters.status} onChange={submit} className="compact-select" aria-label={t({ tr: "Durum", en: "Status" })}>
        <option value="tumu">{t({ tr: "Tüm durumlar", en: "All statuses" })}</option>
        <option value="aktif">{t({ tr: "Aktif (teslim edilmemiş)", en: "Active (not submitted)" })}</option>
        <option value="gecikmis">{t({ tr: "Teslimi geçmiş", en: "Overdue" })}</option>
        <option value="yaklasan">{t({ tr: "7 gün içinde teslim", en: "Due within 7 days" })}</option>
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      {showAssignee ? (
        <select name="atanan" defaultValue={filters.assignee} onChange={submit} className="compact-select" aria-label={t({ tr: "Sorumlu", en: "Assignee" })}>
          <option value="tumu">{t({ tr: "Tüm sorumlular", en: "All assignees" })}</option>
          <option value="benim">{t({ tr: "Bana atananlar", en: "Assigned to me" })}</option>
          <option value="atanmamis">{t({ tr: "Sorumlu atanmamış", en: "Unassigned" })}</option>
        </select>
      ) : null}
      <select name="sirala" defaultValue={filters.sort} onChange={submit} className="compact-select" aria-label={t({ tr: "Sıralama", en: "Sort" })}>
        <option value="yeni">{t({ tr: "Son eklenen", en: "Recently added" })}</option>
        <option value="duzenleme">{t({ tr: "Son düzenlenen", en: "Recently edited" })}</option>
        <option value="teslim">{t({ tr: "Teslim tarihi yakın", en: "Due soonest" })}</option>
        <option value="baslik">{t({ tr: "Başlığa göre (A–Z)", en: "By title (A–Z)" })}</option>
      </select>
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
