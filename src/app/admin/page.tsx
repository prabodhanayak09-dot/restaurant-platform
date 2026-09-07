import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_platform_admin");

  if (adminError || !isAdmin) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorized");
  }

  const { count: restaurantCount } = await supabase
    .from("restaurants")
    .select("id", { count: "exact", head: true });

  const { count: activeRestaurantCount } = await supabase
    .from("restaurants")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: tableCount } = await supabase
    .from("restaurant_tables")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: qrCount } = await supabase
    .from("table_qr_codes")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Restaurant Platform
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Manage restaurants, tables, QR codes and platform operations.
            </p>
          </div>

          <form
            action={async () => {
              "use server";

              const supabase = await createClient();
              await supabase.auth.signOut();
              redirect("/admin/login");
            }}
          >
            <button
              type="submit"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              SIGN OUT
            </button>
          </form>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total restaurants</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {restaurantCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active restaurants</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {activeRestaurantCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active tables</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {tableCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active QR codes</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {qrCount ?? 0}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <a
            href="/admin/restaurants"
            className="rounded-2xl bg-black p-6 text-white shadow-sm transition hover:bg-gray-800"
          >
            <p className="text-2xl">🏪</p>
            <h2 className="mt-4 text-xl font-bold">
              Restaurants
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              Create and manage restaurants and their owners.
            </p>
          </a>

          <a
            href="/admin/tables"
            className="rounded-2xl bg-white p-6 text-gray-900 shadow-sm transition hover:bg-gray-50"
          >
            <p className="text-2xl">🪑</p>
            <h2 className="mt-4 text-xl font-bold">
              Tables & QR
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Manage restaurant tables and generated QR codes.
            </p>
          </a>

          <a
            href="/admin/menu"
            className="rounded-2xl bg-white p-6 text-gray-900 shadow-sm transition hover:bg-gray-50"
          >
            <p className="text-2xl">🍽️</p>
            <h2 className="mt-4 text-xl font-bold">
              Menu
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Manage categories, items, prices and availability.
            </p>
          </a>
        </section>

        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">
            Signed in as
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            {user.email}
          </p>

          <div className="mt-4 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            PLATFORM ADMIN
          </div>
        </section>
      </div>
    </main>
  );
}