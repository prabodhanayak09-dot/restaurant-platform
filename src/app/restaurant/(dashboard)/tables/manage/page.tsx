import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ManagePageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function ManageTablesPage({
  searchParams,
}: ManagePageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/restaurant/login");
  }

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    redirect("/restaurant/onboarding");
  }

  if (membership.role !== "owner") {
    redirect("/restaurant/tables?error=owner-only");
  }

  const restaurantId = membership.restaurant_id;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!restaurant) {
    redirect("/restaurant/login?error=no-restaurant");
  }

  const { data: tables, error: tablesError } = await supabase
    .from("restaurant_tables")
    .select("id, table_number, display_name, is_active")
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (tablesError) {
    throw new Error("Unable to load restaurant tables.");
  }

  const activeTables = (tables ?? []).filter(
    (table) => table.is_active
  );

  const inactiveTables = (tables ?? []).filter(
    (table) => !table.is_active
  );

  const params = await searchParams;

  const errorMessage =
    params.error === "invalid-count"
      ? "Please enter a valid number of tables."
      : params.error === "update-failed"
        ? "We could not update the table count. Please try again."
        : params.error === "owner-only"
          ? "Only the restaurant owner can manage tables."
          : null;

  const successMessage =
    params.success === "updated"
      ? "Table setup updated successfully."
      : null;

  async function updateTableCount(formData: FormData) {
    "use server";

    const requestedCount = Number(
      String(formData.get("tableCount") ?? "")
    );

    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 0 ||
      requestedCount > 500
    ) {
      redirect(
        "/restaurant/tables/manage?error=invalid-count"
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/restaurant/login");
    }

    const { data: membership } = await supabase
      .from("restaurant_members")
      .select("restaurant_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (
      !membership ||
      membership.role !== "owner"
    ) {
      redirect(
        "/restaurant/tables/manage?error=owner-only"
      );
    }

    const { error } = await supabase.rpc(
      "set_restaurant_table_count",
      {
        p_restaurant_id: membership.restaurant_id,
        p_table_count: requestedCount,
      }
    );

    if (error) {
      console.error(
        "Table count update error:",
        error
      );

      redirect(
        "/restaurant/tables/manage?error=update-failed"
      );
    }

    redirect(
      "/restaurant/tables/manage?success=updated"
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/restaurant/tables"
            className="text-sm font-semibold text-gray-500 transition hover:text-gray-900"
          >
            ← Tables & QR
          </Link>

          <p className="mt-5 text-sm font-medium text-gray-500">
            {restaurant.name}
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Manage tables
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
            Set the number of physical tables in your restaurant.
            Each new table automatically receives its own unique QR code.
          </p>
        </div>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm leading-5 text-green-700"
        >
          {successMessage}
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Current setup
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Active tables"
                value={activeTables.length}
              />

              <SummaryCard
                label="Inactive tables"
                value={inactiveTables.length}
              />

              <SummaryCard
                label="Total records"
                value={(tables ?? []).length}
              />
            </div>
          </div>

          <form
            action={updateTableCount}
            className="rounded-2xl bg-gray-50 p-4"
          >
            <label
              htmlFor="tableCount"
              className="block text-sm font-semibold text-gray-900"
            >
              Total active tables
            </label>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Enter the total number of tables your restaurant currently
              operates.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                id="tableCount"
                name="tableCount"
                type="number"
                min={0}
                max={500}
                defaultValue={activeTables.length}
                required
                className="h-12 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />

              <button
                type="submit"
                className="h-12 shrink-0 rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.99] sm:px-5"
              >
                SAVE
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            How table generation works
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            Existing tables and their QR codes are preserved when you add
            more tables.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoCard
            number="01"
            title="Add tables"
            description="Increasing the count creates only the missing table numbers."
          />

          <InfoCard
            number="02"
            title="Unique QR"
            description="Every newly created physical table receives a different QR token."
          />

          <InfoCard
            number="03"
            title="Safe reduction"
            description="Reducing the count deactivates higher-numbered tables instead of deleting history."
          />
        </div>
      </section>

      {tables && tables.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Table records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Existing table records are retained for historical data.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((table) => (
              <div
                key={table.id}
                className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                      Table
                    </p>

                    <h3 className="mt-1 truncate text-lg font-bold text-gray-900">
                      {table.display_name ||
                        `Table ${table.table_number}`}
                    </h3>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      table.is_active
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {table.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>

                <p className="mt-3 text-xs text-gray-400">
                  Table number: {table.table_number}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-xs leading-4 text-gray-500 sm:text-sm">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <span className="text-xs font-bold text-gray-400">
        {number}
      </span>

      <h3 className="mt-2 font-semibold text-gray-900">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-5 text-gray-500">
        {description}
      </p>
    </div>
  );
}