"use client";

import { useMemo, useState, useTransition } from "react";
import {
  getAcademicUnits,
  type AcademicUnit,
  type University,
} from "@/app/actions/universities";
import { findMatchingGuideline, type GuidelineMatch } from "@/app/actions/guidelines";

type AcademicUnitFieldsProps = {
  universities: University[];
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

export default function AcademicUnitFields({ universities }: AcademicUnitFieldsProps) {
  const [universityName, setUniversityName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [departments, setDepartments] = useState<AcademicUnit[]>([]);
  const [isPending, startTransition] = useTransition();
  const [guideline, setGuideline] = useState<GuidelineMatch | null>(null);
  const [matchChecked, setMatchChecked] = useState(false);

  const universityByName = useMemo(
    () => new Map(universities.map((item) => [item.name, item])),
    [universities]
  );

  function handleUniversityChange(value: string) {
    setUniversityName(value);
    setUnitName("");
    setDepartmentName("");
    setUnits([]);
    setDepartments([]);
    setGuideline(null);
    setMatchChecked(false);

    const selectedUniversity = universityByName.get(value);
    if (!selectedUniversity) return;

    startTransition(async () => {
      const result = await getAcademicUnits(
        selectedUniversity.id,
        null,
        [...ROOT_UNIT_TYPES]
      );
      setUnits(result);
    });
  }

  function handleUnitChange(value: string) {
    setUnitName(value);
    setDepartmentName("");
    setDepartments([]);
    setGuideline(null);
    setMatchChecked(false);

    const selectedUniversity = universityByName.get(universityName);
    const selectedUnit = units.find((item) => item.name === value);
    if (!selectedUniversity || !selectedUnit) return;

    startTransition(async () => {
      const result = await getAcademicUnits(
        selectedUniversity.id,
        selectedUnit.id,
        [...CHILD_UNIT_TYPES]
      );
      setDepartments(result);
    });
  }

  function handleDepartmentChange(value: string) {
    setDepartmentName(value);
    setGuideline(null);
    setMatchChecked(false);

    const university = universityByName.get(universityName);
    const unit = units.find((item) => item.name === unitName);
    const department = departments.find((item) => item.name === value);
    if (!university) return;

    startTransition(async () => {
      const match = await findMatchingGuideline(
        university.id,
        unit?.id ?? null,
        department?.id ?? null
      );
      setGuideline(match);
      setMatchChecked(true);
    });
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
          {universities.map((university) => (
            <option key={university.id} value={university.name}>
              {university.city ?? ""}
            </option>
          ))}
        </datalist>
      </label>
      <input type="hidden" name="universityId" value={universityByName.get(universityName)?.id ?? ""} />

      <label>
        <span>Enstitü / Fakülte</span>
        <input
          name="institute"
          type="text"
          list="academic-unit-options"
          value={unitName}
          onChange={(event) => handleUnitChange(event.target.value)}
          placeholder={
            universityByName.has(universityName)
              ? "Yazarak enstitü veya fakülte seçin"
              : "Önce üniversite seçin"
          }
          autoComplete="off"
          disabled={isPending && units.length === 0}
        />
        <datalist id="academic-unit-options">
          {units.map((unit) => (
            <option key={unit.id} value={unit.name} />
          ))}
        </datalist>
      </label>
      <input type="hidden" name="academicUnitId" value={units.find((item) => item.name === unitName)?.id ?? ""} />

      <label>
        <span>Bölüm / Ana bilim dalı</span>
        <input
          name="department"
          type="text"
          list="department-options"
          value={departmentName}
          onChange={(event) => handleDepartmentChange(event.target.value)}
          placeholder={
            units.some((item) => item.name === unitName)
              ? "Yazarak bölüm veya ana bilim dalı seçin"
              : "Önce enstitü veya fakülte seçin"
          }
          autoComplete="off"
          disabled={isPending && departments.length === 0}
        />
        <datalist id="department-options">
          {departments.map((department) => (
            <option key={department.id} value={department.name} />
          ))}
        </datalist>
      </label>
      <input type="hidden" name="departmentId" value={departments.find((item) => item.name === departmentName)?.id ?? ""} />

      <div className="project-form-full guideline-match-status" aria-live="polite">
        {isPending ? (
          <span>Kurumunuza ait onaylı tez yazım kılavuzu aranıyor…</span>
        ) : guideline ? (
          <>
            <strong>Kılavuz otomatik eşleştirildi</strong>
            <span>
              {guideline.document_title ?? guideline.university_name}
              {guideline.version_label ? ` — ${guideline.version_label}` : ""} · {guideline.citation_style.toUpperCase()}
            </span>
          </>
        ) : matchChecked ? (
          <span>Bu akademik birim için henüz onaylı ve güncel bir kılavuz bulunamadı.</span>
        ) : (
          <span>Üniversite, fakülte/enstitü ve bölüm seçildiğinde kılavuz otomatik belirlenir.</span>
        )}
      </div>
    </>
  );
}
