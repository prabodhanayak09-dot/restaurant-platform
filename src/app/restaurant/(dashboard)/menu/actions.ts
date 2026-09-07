"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleMenuItemAvailability(
  itemId: string,
  isAvailable: boolean,
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "staff"])
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error("Restaurant membership not found");
  }

  const { data: item, error: itemError } = await supabase
    .from("menu_items")
    .select("id, restaurant_id")
    .eq("id", itemId)
    .eq("restaurant_id", membership.restaurant_id)
    .maybeSingle();

  if (itemError || !item) {
    throw new Error("Menu item not found");
  }

  const { error: updateError } = await supabase
    .from("menu_items")
    .update({
      is_available: isAvailable,
    })
    .eq("id", itemId)
    .eq("restaurant_id", membership.restaurant_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/restaurant/menu");
}
