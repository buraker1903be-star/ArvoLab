"use server";

import { createClient } from "@/lib/supabase/server";

export interface University {
  id: string;
  name: string;
  city: string | null;
  university_type: "devlet" | "vakif";
}

export type AcademicUnitType =
  | "faculty"
  | "institute"
  | "school"
  | "conservatory"
  | "vocational_school"
  | "department"
  | "division"
  | "program";

export interface AcademicUnit {
  id: string;
  university_id: string;
  parent_id: string | null;
  name: string;
  unit_type: AcademicUnitType;
}

export async function getUniversities(): Promise<University[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, city, university_type")
    .order("name");

  if (error) {
    console.error("Universities could not be loaded:", error);
    return [];
  }
  return data ?? [];
}

export async function getAcademicUnits(
  universityId: string,
  parentId: string | null,
  unitTypes: AcademicUnitType[]
): Promise<AcademicUnit[]> {
  if (!universityId || unitTypes.length === 0) return [];

  const supabase = await createClient();
  let query = supabase
    .from("academic_units")
    .select("id, university_id, parent_id, name, unit_type")
    .eq("university_id", universityId)
    .eq("is_active", true)
    .in("unit_type", unitTypes)
    .order("name");

  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);

  const { data, error } = await query;
  if (error) {
    console.error("Academic units could not be loaded:", error);
    return [];
  }

  return (data ?? []) as AcademicUnit[];
}
