"use server";

import { createClient } from "@/lib/supabase/server";

export interface University {
  id: string;
  name: string;
  city: string | null;
  university_type: "devlet" | "vakif";
}

export async function getUniversities(): Promise<University[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, city, university_type")
    .order("name");

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export interface AcademicUnit {
  id: string;
  university_id: string;
  parent_id: string | null;
  name: string;
  unit_type: string;
}

/**
 * academic_units tablosundan hiyerarşik birimleri getirir.
 * parentId null verilirse üst seviye birimler (fakülte/enstitü/okul);
 * bir üst birim id'si verilirse onun altındaki birimler (bölüm/
 * anabilim dalı/program) döner. unitTypes ile hangi seviyenin
 * isteneceği filtrelenir.
 */
export async function getAcademicUnits(
  universityId: string,
  parentId: string | null,
  unitTypes: string[]
): Promise<AcademicUnit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("academic_units")
    .select("id, university_id, parent_id, name, unit_type")
    .eq("university_id", universityId)
    .eq("is_active", true)
    .in("unit_type", unitTypes)
    .order("name");

  query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}
