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
