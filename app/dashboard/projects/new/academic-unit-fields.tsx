"use client";

import { useMemo, useState, useTransition } from "react";
import {
  getAcademicUnits,
  type AcademicUnit,
  type University,
} from "@/app/actions/universities";

type AcademicUnitFieldsProps = {
  universities: University[];
};

const ROOT_UNIT_TYPES = [
  "faculty",
  "institute",
  "school",
  "conservatory",
  "vocational_school",
] as const;

const CHILD_UNIT_TYPES = ["department", "division", "program"] as const;

export default function AcademicUnitFields({ universities }: AcademicUnitFieldsProps) {
  const [universityName, setUniversityName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [units, setUnits] = useState<AcademicUnit[]>([]);
  const [departments, setDepartments] = useState<AcademicUnit[]>([]);
  const [isPending, startTransition] = useTransition();

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

      <label>
        <span>Bölüm / Ana bilim dalı</span>
        <input
          name="department"
          type="text"
          list="department-options"
          value={departmentName}
          onChange={(event) => setDepartmentName(event.target.value)}
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
    </>
  );
}
