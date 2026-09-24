"use client";

import type { ChangeEvent } from "react";
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import type { ProjectFilters as Filters } from "@/lib/project-filters";

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
  const submit = (event: ChangeEvent<HTMLSelectElement>) => event.currentTarget.form?.requestSubmit();

  /*
    "Onay bekleyenler" ve "yorumu olanlar" filtreleri ana sayfadaki dikkat
    kartlarından geliyor; çubukta kendi seçicileri yok. İkisi de GİZLİ ALANLA
    taşınıyor, yoksa kullanıcı sıralamayı değiştirdiği anda form adresi
    sıfırdan kurar ve filtre sessizce düşerdi — liste büyür, sebebi
    görünmezdi. Yanlarındaki çip hem filtrenin açık olduğunu söylüyor hem de
    kaldırma yolunu veriyor.
  */
  const adres = (degisiklik: Partial<Filters>) => {
    const sonuc = { ...filters, ...degisiklik };
    const p = new URLSearchParams();
    if (sonuc.q) p.set("q", sonuc.q);
    if (sonuc.status !== "tumu") p.set("durum", sonuc.status);
    if (sonuc.sort !== "yeni") p.set("sirala", sonuc.sort);
    if (sonuc.assignee !== "tumu") p.set("atanan", sonuc.assignee);
    if (sonuc.approval !== "tumu") p.set("onay", sonuc.approval);
    if (sonuc.comments !== "tumu") p.set("yorum", sonuc.comments);
    const sorgu = p.toString();
    return sorgu ? `/dashboard/editor?${sorgu}` : "/dashboard/editor";
  };

  return (
    <Form action="/dashboard/editor" className="project-filters" role="search" aria-label="Çalışmaları filtrele">
      <label className="project-filter-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" name="q" defaultValue={filters.q} placeholder="Başlık ya da üniversite ara" aria-label="Çalışma ara" maxLength={100} />
      </label>
      <select name="durum" defaultValue={filters.status} onChange={submit} className="compact-select" aria-label="Durum">
        <option value="tumu">Tüm durumlar</option>
        <option value="aktif">Aktif (teslim edilmemiş)</option>
        <option value="gecikmis">Teslimi geçmiş</option>
        <option value="yaklasan">7 gün içinde teslim</option>
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      {showAssignee ? (
        <select name="atanan" defaultValue={filters.assignee} onChange={submit} className="compact-select" aria-label="Sorumlu">
          <option value="tumu">Tüm sorumlular</option>
          <option value="benim">Bana atananlar</option>
          <option value="atanmamis">Sorumlu atanmamış</option>
        </select>
      ) : null}
      <select name="sirala" defaultValue={filters.sort} onChange={submit} className="compact-select" aria-label="Sıralama">
        <option value="yeni">Son eklenen</option>
        <option value="duzenleme">Son düzenlenen</option>
        <option value="teslim">Teslim tarihi yakın</option>
        <option value="baslik">Başlığa göre (A–Z)</option>
      </select>
      {filters.approval !== "tumu" ? <input type="hidden" name="onay" value={filters.approval} /> : null}
      {filters.comments !== "tumu" ? <input type="hidden" name="yorum" value={filters.comments} /> : null}
      {filters.approval === "bekliyor" ? (
        <Link href={adres({ approval: "tumu" })} className="chip" data-tone="info">
          Yalnızca onay bekleyenler ✕
        </Link>
      ) : null}
      {filters.comments === "acik" ? (
        <Link href={adres({ comments: "tumu" })} className="chip" data-tone="info">
          Yalnızca yorumu olanlar ✕
        </Link>
      ) : null}
      <span className="muted text-sm project-filter-count" role="status">
        {shown === total ? `${total} çalışma` : `${total} çalışmadan ${shown} gösteriliyor`}
      </span>
      {filtered ? (
        <Link href="/dashboard/editor" className="result-link">
          Filtreyi temizle
        </Link>
      ) : null}
    </Form>
  );
}
