"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { startSubscriptionCheckout } from "@/lib/subscription";

// Bireysel abonenin "Aboneliği başlat / yenile" düğmesi. Tutar ArvoOS'ta
// belirlenir; buradan tutar gönderilmez, yalnızca kim olduğu bildirilir.

export async function payArvolabSubscription() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/?error=session-missing");

  const profile = await getCurrentProfile();
  if (profile?.organization_id) {
    // Kurum üyesinin aboneliğini kurumu öder; kişisel ödeme almayalım.
    redirect("/dashboard?error=kurum-aboneligi");
  }

  const result = await startSubscriptionCheckout({ id: user.id, email: user.email, fullName: profile?.full_name });
  if (!result?.checkoutUrl) redirect("/dashboard?error=odeme-baslatilamadi");
  redirect(result.checkoutUrl);
}
