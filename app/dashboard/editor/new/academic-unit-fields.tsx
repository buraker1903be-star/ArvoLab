"use client";

import { useMemo, useState, useTransition } from "react";
import {
  getAcademicUnits,
  type AcademicUnit,
  type University,
} from "@/app/actions/universities";
import { findMatchingGuideline, type GuidelineMatch } from "@/app/actions/guidelines";

export interface InstitutionValue {
  university: string;
  universityId: string | null;
  institute: string;
  academicUnitId: string | null;
  department: string;
  departmentId: string | null;
}

type AcademicUnitFieldsProps = {
  universities: University[];
  /** Düzenleme sayfasında mevcut kurum */
  initial?: InstitutionValue;
  /** Mevcut kılavuzun adı (düzenleme sayfası) */
  initialGuidelineLabel?: string | null;
};

const ROOT_UNIT_TYPES = [
  "fakulte",
  "enstitu",
  "yuksekokul",
  "konservatuvar",
  "meslek_yuksekokulu",
] as const;

const CHILD_UNIT_TYPES = [
  "bolum",
  "anabilim_dali",
  "anasanat_dali",
  "bilim_dali",
  "program",
] as const;

// Üniversite → enstitü/fakülte → bölüm seçimi. Kimlikler gizli alanlarla gönderilir;
// tezlerde kılavuzu bu kimliklerden veritabanı belirler. Burada yalnızca önizleme yapılır.
export default function AcademicUnitFields({ universities, initial, initialGuidelineLabel }: AcademicUnitFieldsProps) {
  const [universityName, setUniversityName] = useState(initial?.university ?? "");
  const [unitName, setUnitName] = useState(initial?.institute ?? "");
  const [unitId, setUnitId] = useState(initial?.academicUnitId ?? "");
  const [departmentName, setDepartmentName] = useState(initial?.department ?? "");
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? "");
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [departments, setDepartments] = useState<AcademicUnit[]>([]);
  const [isPending, startTransition] = useTransition();
  const [guideline, setGuideline] = useState<GuidelineMatch | null>(null);
  /*
    "Kılavuz yok" ile "bakamadım" ayrı tutuluyor. Eskiden ikisi de aynı
    cümleyi veriyordu ("Bu birim için henüz onaylı bir kılavuz yok") ve
    geçici bir arıza, kullanıcıya kurumu hakkında yanlış bir kesinlik
    olarak dönüyordu.
  */
  const [kilavuzOkunamadi, setKilavuzOkunamadi] = useState(false);
  const [birimOkunamadi, setBirimOkunamadi] = useState(false);
  const [matchState, setMatchState] = useState<"idle" | "checked" | "initial">(initialGuidelineLabel !== undefined ? "initial" : "idle");

  const universityByName = useMemo(
    () => new Map(universities.map((item) => [item.name, item])),
    [universities]
  );
  const university = universityByName.get(universityName) ?? null;

  function previewGuideline(uId: string, aId: string | null, dId: string | null) {
    startTransition(async () => {
      const { eslesme, okunamadi } = await findMatchingGuideline(uId, aId, dId);
      setGuideline(eslesme);
      setKilavuzOkunamadi(okunamadi);
      setMatchState("checked");
    });
  }

  function loadUnits(uId: string) {
    startTransition(async () => {
      const { satirlar, okunamadi } = await getAcademicUnits(uId, null, [...ROOT_UNIT_TYPES]);
      setUnits(satirlar);
      setBirimOkunamadi(okunamadi);
    });
  }

  function loadDepartments(uId: string, aId: string) {
    startTransition(async () => {
      const { satirlar, okunamadi } = await getAcademicUnits(uId, aId, [...CHILD_UNIT_TYPES]);
      setDepartments(satirlar);
      setBirimOkunamadi(okunamadi);
    });
  }

  function handleUniversityChange(value: string) {
    setUniversityName(value);
    setUnitName("");
    setUnitId("");
    setDepartmentName("");
    setDepartmentId("");
    setUnits([]);
    setDepartments([]);
    setGuideline(null);
    setKilavuzOkunamadi(false);
    setBirimOkunamadi(false);
    setMatchState("idle");

    const selected = universityByName.get(value);
    if (!selected) return;
    loadUnits(selected.id);
    previewGuideline(selected.id, null, null);
  }

  function handleUnitChange(value: string) {
    setUnitName(value);
    setDepartmentName("");
    setDepartmentId("");
    setDepartments([]);

    const selected = units.find((item) => item.name === value);
    setUnitId(selected?.id ?? "");
    if (!university || !selected) return;
    loadDepartments(university.id, selected.id);
    previewGuideline(university.id, selected.id, null);
  }

  function handleDepartmentChange(value: string) {
    setDepartmentName(value);
    const selected = departments.find((item) => item.name === value);
    setDepartmentId(selected?.id ?? "");
    if (!university || !selected) return;
    previewGuideline(university.id, unitId || null, selected.id);
  }

  return (
    <>
      <label>
        <span>Üniversite</span>
        <input
          name="university"
          type="text"
          list="university-options"
          value={universityName}
          onChange={(event) => handleUniversityChange(event.target.value)}
          placeholder="Yazarak üniversite seçin"
          autoComplete="off"
        />
        <datalist id="university-options">
          {universities.map((item) => (
            <option key={item.id} value={item.name}>
              {item.city ?? ""}
            </option>
          ))}
        </datalist>
      </label>
      <input type="hidden" name="universityId" value={university?.id ?? ""} />

      <label>
        <span>Enstitü / Fakülte</span>
        <input
          name="institute"
          type="text"
          list="academic-unit-options"
          value={unitName}
          onChange={(event) => handleUnitChange(event.target.value)}
          // Düzenleme sayfasında liste ilk odaklanınca yüklenir.
          onFocus={() => {
            if (university && units.length === 0) loadUnits(university.id);
          }}
          placeholder={university ? "Yazarak enstitü veya fakülte seçin" : "Önce üniversite seçin"}
          autoComplete="off"
          disabled={!university}
        />
        <datalist id="academic-unit-options">
          {units.map((unit) => (
            <option key={unit.id} value={unit.name} />
          ))}
        </datalist>
      </label>
      <input type="hidden" name="academicUnitId" value={university ? unitId : ""} />

      <label>
        <span>Bölüm / Ana bilim dalı</span>
        <input
          name="department"
          type="text"
          list="department-options"
          value={departmentName}
          onChange={(event) => handleDepartmentChange(event.target.value)}
          onFocus={() => {
            if (university && unitId && departments.length === 0) loadDepartments(university.id, unitId);
          }}
          placeholder={unitId ? "Yazarak bölüm veya ana bilim dalı seçin" : "Önce enstitü veya fakülte seçin"}
          autoComplete="off"
          disabled={!unitId}
        />
        <datalist id="department-options">
          {departments.map((department) => (
            <option key={department.id} value={department.name} />
          ))}
        </datalist>
      </label>
      <input type="hidden" name="departmentId" value={unitId ? departmentId : ""} />

      {/* Alanlar serbest metin, o yüzden akış durmuyor; ama boş açılır liste
          "kurumum sistemde kayıtlı değil" gibi okunuyordu. */}
      {birimOkunamadi ? (
        <p className="hint project-form-full" role="alert">
          Fakülte/bölüm listesi okunamadı; adını elle yazabilirsiniz. Listenin
          boş görünmesi kurumunuzun kayıtlı olmadığı anlamına gelmez.
        </p>
      ) : null}

      <div className="project-form-full guideline-match-status" aria-live="polite">
        {isPending ? (
          <span>Kurumunuza ait onaylı tez yazım kılavuzu aranıyor…</span>
        ) : matchState === "initial" ? (
          initialGuidelineLabel ? (
            <>
              <strong>Uygulanan kılavuz</strong>
              <span>{initialGuidelineLabel}. Kurumu değiştirirseniz kılavuz yeniden eşleştirilir.</span>
            </>
          ) : (
            <span>Bu çalışmaya henüz onaylı bir kılavuz bağlı değil. Kurum seçildiğinde otomatik eşleştirilir.</span>
          )
        ) : guideline ? (
          <>
            <strong>Kılavuz otomatik eşleştirilecek</strong>
            <span>
              {guideline.document_title ?? guideline.university_name}
              {guideline.version_label ? ` — ${guideline.version_label}` : ""} · {guideline.citation_style.toUpperCase()}
              {" · tez çalışmalarında uygulanır"}
            </span>
          </>
        ) : kilavuzOkunamadi ? (
          <span role="alert">
            Kılavuz eşleştirmesi yapılamadı. Kurumunuzun kılavuzu olmadığı
            anlamına gelmez — çalışmayı oluşturabilirsiniz, kurum bilgisi
            kayıtlı kaldığı için kılavuz sonradan eşleşir.
          </span>
        ) : matchState === "checked" ? (
          <span>
            Bu birim için henüz onaylı bir kılavuz yok. Ekibimiz ekleyip onayladığında çalışmanıza kendiliğinden uygulanır.
          </span>
        ) : (
          <span>Üniversite, fakülte/enstitü ve bölüm seçildiğinde tez kılavuzu otomatik belirlenir.</span>
        )}
      </div>
    </>
  );
}
