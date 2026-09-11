import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function StaffLayout({
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
    await supabase.auth.signOut();
    redirect("/restaurant/login?error=unauthorized");
  }

  if (membership.role !== "staff") {
    if (membership.role === "owner") {
      redirect("/restaurant");
    }

    await supabase.auth.signOut();
    redirect("/restaurant/login?error=unauthorized");
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name, is_active")
    .eq("id", membership.restaurant_id)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    await supabase.auth.signOut();
    redirect("/restaurant/login?error=unauthorized");
  }

  if (!restaurant.is_active) {
    await supabase.auth.signOut();
    redirect("/restaurant/login?error=inactive");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">
              {restaurant.name}
            </p>
            <p className="text-xs text-gray-500">Staff Operations</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-56 truncate text-sm font-medium text-gray-900">
                {user.email ?? ""}
              </p>
              <p className="text-xs text-gray-500">Staff</p>
            </div>

            <form action="/api/staff/logout" method="post">
              <button
                type="submit"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
