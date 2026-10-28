"use client";

import { useMemo, useState, useTransition } from "react";
import {
  getAcademicUnits,
  type AcademicUnit,
  type University,
} from "@/app/actions/universities";
import { findMatchingGuideline, type GuidelineMatch } from "@/app/actions/guidelines";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
  const t = useCeviri();
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
        <span>{t({ tr: "Üniversite", en: "University" })}</span>
        <input
          name="university"
          type="text"
          list="university-options"
          value={universityName}
          onChange={(event) => handleUniversityChange(event.target.value)}
          placeholder={t({ tr: "Yazarak üniversite seçin", en: "Type to choose a university" })}
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
        <span>{t({ tr: "Enstitü / Fakülte", en: "Graduate school / Faculty" })}</span>
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
          placeholder={
            university
              ? t({ tr: "Yazarak enstitü veya fakülte seçin", en: "Type to choose a graduate school or faculty" })
              : t({ tr: "Önce üniversite seçin", en: "Choose a university first" })
          }
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
        <span>{t({ tr: "Bölüm / Ana bilim dalı", en: "Department / Division" })}</span>
        <input
          name="department"
          type="text"
          list="department-options"
          value={departmentName}
          onChange={(event) => handleDepartmentChange(event.target.value)}
          onFocus={() => {
            if (university && unitId && departments.length === 0) loadDepartments(university.id, unitId);
          }}
          placeholder={
            unitId
              ? t({ tr: "Yazarak bölüm veya ana bilim dalı seçin", en: "Type to choose a department or division" })
              : t({ tr: "Önce enstitü veya fakülte seçin", en: "Choose a graduate school or faculty first" })
          }
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
          {t({
            tr: "Fakülte/bölüm listesi okunamadı; adını elle yazabilirsiniz. Listenin boş görünmesi kurumunuzun kayıtlı olmadığı anlamına gelmez.",
            en: "The faculty/department list could not be loaded; you can type the name. An empty list does not mean your institution is not registered.",
          })}
        </p>
      ) : null}

      <div className="project-form-full guideline-match-status" aria-live="polite">
        {isPending ? (
          <span>{t({ tr: "Kurumunuza ait onaylı tez yazım kılavuzu aranıyor…", en: "Looking for your institution's approved thesis writing guideline…" })}</span>
        ) : matchState === "initial" ? (
          initialGuidelineLabel ? (
            <>
              <strong>{t({ tr: "Uygulanan kılavuz", en: "Applied guideline" })}</strong>
              <span>
                {initialGuidelineLabel}.{" "}
                {t({ tr: "Kurumu değiştirirseniz kılavuz yeniden eşleştirilir.", en: "If you change the institution, the guideline is matched again." })}
              </span>
            </>
          ) : (
            <span>
              {t({
                tr: "Bu çalışmaya henüz onaylı bir kılavuz bağlı değil. Kurum seçildiğinde otomatik eşleştirilir.",
                en: "No approved guideline is linked to this work yet. It is matched automatically once an institution is chosen.",
              })}
            </span>
          )
        ) : guideline ? (
          <>
            <strong>{t({ tr: "Kılavuz otomatik eşleştirilecek", en: "Guideline will be matched automatically" })}</strong>
            <span>
              {guideline.document_title ?? guideline.university_name}
              {guideline.version_label ? ` — ${guideline.version_label}` : ""} · {guideline.citation_style.toUpperCase()}
              {t({ tr: " · tez çalışmalarında uygulanır", en: " · applied to theses" })}
            </span>
          </>
        ) : kilavuzOkunamadi ? (
          <span role="alert">
            {t({
              tr: "Kılavuz eşleştirmesi yapılamadı. Kurumunuzun kılavuzu olmadığı anlamına gelmez — çalışmayı oluşturabilirsiniz, kurum bilgisi kayıtlı kaldığı için kılavuz sonradan eşleşir.",
              en: "The guideline could not be matched. This does not mean your institution has no guideline — you can create the work; the institution is saved, so the guideline will be matched later.",
            })}
          </span>
        ) : matchState === "checked" ? (
          <span>
            {t({
              tr: "Bu birim için henüz onaylı bir kılavuz yok. Ekibimiz ekleyip onayladığında çalışmanıza kendiliğinden uygulanır.",
              en: "There is no approved guideline for this unit yet. Once our team adds and approves one, it is applied to your work automatically.",
            })}
          </span>
        ) : (
          <span>
            {t({
              tr: "Üniversite, fakülte/enstitü ve bölüm seçildiğinde tez kılavuzu otomatik belirlenir.",
              en: "Once the university, faculty/graduate school and department are chosen, the thesis guideline is determined automatically.",
            })}
          </span>
        )}
      </div>
    </>
  );
}
