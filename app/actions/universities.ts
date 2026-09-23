"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { createClient } from "@/lib/supabase/server";
import { ensureYokAtlasDirectory } from "@/lib/yok-atlas-directory";

export interface University {
  id: string;
  name: string;
  city: string | null;
  university_type: "devlet" | "vakif";
}

/*
  Okunamadı ile "üniversite kaydı yok" ayrı. Liste boş gelince form yine
  çalışıyor (alan serbest metin) ama kılavuz eşleşmesi SESSİZCE olmuyor:
  kullanıcıya "kılavuzunuz otomatik uygulanır" denip hiçbir şey
  uygulanmıyordu ve sebebini öğrenemiyordu.
*/
export async function getUniversities(): Promise<ListeSonucu<University>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, city, university_type")
    .order("name");

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export interface AcademicUnit {
  id: string;
  university_id: string;
  parent_unit_id: string | null;
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
): Promise<ListeSonucu<AcademicUnit>> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return listeBasarili([]);

  if (parentId === null) {
    const { data: university } = await supabase
      .from("universities")
      .select("name")
      .eq("id", universityId)
      .single();

    if (university?.name) {
      try {
        await ensureYokAtlasDirectory(universityId, university.name);
      } catch (error) {
        console.error("YÖK Atlas akademik birim senkronizasyonu başarısız:", error);
      }
    }
  }

  let query = supabase
    .from("academic_units")
    .select("id, university_id, parent_unit_id, name, unit_type")
    .eq("university_id", universityId)
    .eq("is_active", true)
    .in("unit_type", unitTypes)
    .order("name");

  query = parentId === null
    ? query.is("parent_unit_id", null)
    : query.eq("parent_unit_id", parentId);

  const { data, error } = await query;

  if (error) {
    console.error(error);
    // Alan serbest metin: liste okunamasa da kullanıcı birimini yazabilir.
    // Ama bunu BİLMESİ gerekiyor; boş açılır liste "kurumum sistemde yok"
    // gibi okunuyordu.
    return listeOkunamadi();
  }
  return listeBasarili(data);
}
