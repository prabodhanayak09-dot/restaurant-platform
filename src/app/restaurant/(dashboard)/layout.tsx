import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RestaurantNav from "./RestaurantNav";

export default async function RestaurantDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/restaurant/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/restaurant/onboarding");
  }

  if (membership.role !== "owner" && membership.role !== "staff") {
    await supabase.auth.signOut();
    redirect("/restaurant/login?error=unauthorized");
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name, slug, is_active")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    redirect("/restaurant/onboarding");
  }

  if (!restaurant.is_active) {
    await supabase.auth.signOut();
    redirect("/restaurant/login?error=inactive");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RestaurantNav
        restaurantName={restaurant.name}
        userEmail={user.email ?? ""}
        role={membership.role}
      />

      <main className="pt-16 lg:pl-64">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}