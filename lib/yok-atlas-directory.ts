import { createAdminClient } from "@/lib/supabase/admin";

const YOK_ATLAS_BASE_URL = "https://yokatlas.yok.gov.tr/api/tercih-kilavuz";
const YOK_ATLAS_SOURCE_URL = "https://yokatlas.yok.gov.tr/";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type YokUniversity = {
  universiteId: number;
  universiteAdi: string;
};

type YokProgram = {
  universiteId: number;
  universiteAdi: string;
  fymkId?: number | null;
  fymkAdi?: string | null;
  birimId?: number | null;
  birimAdi: string;
  birimTuruAdi: "LISANS" | "ÖNLISANS" | "ONLISANS";
};

type YokSearchPage = {
  content: YokProgram[];
  totalPages: number;
  last: boolean;
};

type ExistingUnit = {
  id: string;
  parent_unit_id: string | null;
  name: string;
  unit_type: string;
  source_checked_at: string | null;
  source_url: string | null;
};

function normalizeTurkish(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bUNIVERSITESI\b/gi, "UNIVERSITESI")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function classifyRootUnit(name: string, programType: YokProgram["birimTuruAdi"]) {
  if (/fak[uü]ltesi$/iu.test(name)) return "fakulte";
  if (/meslek\s+y[uü]ksekokulu$/iu.test(name)) {
    return "meslek_yuksekokulu";
  }
  if (/konservatuvar[ıi]$/iu.test(name)) return "konservatuvar";
  if (/y[uü]ksekokulu$/iu.test(name)) return "yuksekokul";
  return programType === "LISANS" ? "fakulte" : "meslek_yuksekokulu";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "ArvoLabAcademicDirectoryBot/2.0",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`YÖK Atlas isteği başarısız: HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function resolveYokUniversityId(universityName: string) {
  const universities = await fetchJson<YokUniversity[]>(`${YOK_ATLAS_BASE_URL}/universiteler`);
  const target = normalizeTurkish(universityName);
  const exact = universities.find((item) => normalizeTurkish(item.universiteAdi) === target);
  if (exact) return exact.universiteId;

  const candidates = universities.filter((item) => {
    const normalized = normalizeTurkish(item.universiteAdi);
    return normalized.startsWith(target) || target.startsWith(normalized);
  });
  return candidates.length === 1 ? candidates[0].universiteId : null;
}

async function fetchUniversityPrograms(universityId: number) {
  const programs: YokProgram[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const result = await fetchJson<YokSearchPage>(`${YOK_ATLAS_BASE_URL}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filters: {
          puanTuru: null,
          universiteId: [universityId],
          birimGrupId: [],
          ilKodu: [],
          birimTuruId: null,
          universiteTuru: null,
          bursOraniId: null,
          ogrenimTuruId: null,
          kilavuzKodu: null,
          minBasariSirasi: null,
          maxBasariSirasi: null,
        },
        page,
        size: 500,
        sortBy: "basariSirasi",
        direction: "ASC",
      }),
    });
    programs.push(...result.content);
    totalPages = Math.max(1, result.totalPages);
    if (result.last) break;
    page += 1;
  }

  return programs;
}

function isFreshYokCache(units: ExistingUnit[]) {
  const cutoff = Date.now() - CACHE_MAX_AGE_MS;
  return units.some(
    (unit) =>
      unit.source_url === YOK_ATLAS_SOURCE_URL &&
      unit.source_checked_at !== null &&
      new Date(unit.source_checked_at).getTime() >= cutoff,
  );
}

export async function ensureYokAtlasDirectory(universityId: string, universityName: string) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("academic_units")
    .select("id, parent_unit_id, name, unit_type, source_checked_at, source_url")
    .eq("university_id", universityId)
    .eq("is_active", true);

  if (currentError) throw currentError;
  const existingUnits = (current ?? []) as ExistingUnit[];
  if (isFreshYokCache(existingUnits)) return { status: "fresh" as const, roots: 0, children: 0 };

  const yokUniversityId = await resolveYokUniversityId(universityName);
  if (!yokUniversityId) throw new Error(`YÖK Atlas üniversite eşleşmesi bulunamadı: ${universityName}`);

  const programs = await fetchUniversityPrograms(yokUniversityId);
  const checkedAt = new Date().toISOString();
  const rootRows = new Map<string, { name: string; unit_type: string }>();

  for (const program of programs) {
    const rootName = program.fymkAdi?.trim();
    if (!rootName) continue;
    const unitType = classifyRootUnit(rootName, program.birimTuruAdi);
    rootRows.set(`${unitType}|${normalizeTurkish(rootName)}`, { name: rootName, unit_type: unitType });
  }

  const existingRootKeys = new Set(
    existingUnits
      .filter((unit) => unit.parent_unit_id === null)
      .map((unit) => `${unit.unit_type}|${normalizeTurkish(unit.name)}`),
  );
  const missingRoots = [...rootRows.values()]
    .filter((unit) => !existingRootKeys.has(`${unit.unit_type}|${normalizeTurkish(unit.name)}`))
    .map((unit) => ({
      university_id: universityId,
      parent_unit_id: null,
      name: unit.name,
      normalized_name: normalizeTurkish(unit.name),
      unit_type: unit.unit_type,
      is_active: true,
      source_url: YOK_ATLAS_SOURCE_URL,
      source_checked_at: checkedAt,
    }));

  if (missingRoots.length > 0) {
    const { error } = await admin.from("academic_units").insert(missingRoots);
    if (error) throw error;
  }

  const { data: roots, error: rootError } = await admin
    .from("academic_units")
    .select("id, name, unit_type")
    .eq("university_id", universityId)
    .is("parent_unit_id", null)
    .eq("is_active", true);
  if (rootError) throw rootError;

  const rootByName = new Map(
    (roots ?? []).map((root) => [normalizeTurkish(root.name), root]),
  );
  const existingChildKeys = new Set(
    existingUnits
      .filter((unit) => unit.parent_unit_id !== null)
      .map((unit) => `${unit.parent_unit_id}|${unit.unit_type}|${normalizeTurkish(unit.name)}`),
  );
  const childRows = new Map<string, Record<string, unknown>>();

  for (const program of programs) {
    const root = program.fymkAdi ? rootByName.get(normalizeTurkish(program.fymkAdi)) : null;
    const childName = program.birimAdi?.trim();
    if (!root || !childName) continue;
    const unitType = program.birimTuruAdi === "LISANS" ? "bolum" : "program";
    const key = `${root.id}|${unitType}|${normalizeTurkish(childName)}`;
    if (existingChildKeys.has(key)) continue;
    childRows.set(key, {
      university_id: universityId,
      parent_unit_id: root.id,
      name: childName,
      normalized_name: normalizeTurkish(childName),
      unit_type: unitType,
      education_level: program.birimTuruAdi === "LISANS" ? "lisans" : "onlisans",
      yok_unit_id: program.birimId ? String(program.birimId) : null,
      is_active: true,
      source_url: YOK_ATLAS_SOURCE_URL,
      source_checked_at: checkedAt,
    });
  }

  if (childRows.size > 0) {
    const { error } = await admin
      .from("academic_units")
      .upsert([...childRows.values()], {
        onConflict: "university_id,parent_unit_id,unit_type,name",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  await admin
    .from("academic_units")
    .update({ source_checked_at: checkedAt })
    .eq("university_id", universityId)
    .eq("source_url", YOK_ATLAS_SOURCE_URL);

  return {
    status: "updated" as const,
    roots: missingRoots.length,
    children: childRows.size,
  };
}
