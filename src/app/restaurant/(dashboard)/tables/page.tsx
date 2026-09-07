import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type TableRow = {
  id: string;
  table_number: number;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
};

type QRRow = {
  id: string;
  table_id: string;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
};

export default async function TablesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  const restaurantId = membership.restaurant_id;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  const { data: tables, error: tablesError } = await supabase
    .from("restaurant_tables")
    .select(
      "id, table_number, display_name, is_active, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .order("table_number", { ascending: true });

  if (tablesError) {
    throw new Error("Unable to load restaurant tables.");
  }

  const tableList = (tables ?? []) as TableRow[];
  const tableIds = tableList.map((table) => table.id);

  let qrList: QRRow[] = [];

  if (tableIds.length > 0) {
    const { data: qrs, error: qrError } = await supabase
      .from("table_qr_codes")
      .select(
        "id, table_id, qr_token, is_active, created_at, revoked_at"
      )
      .in("table_id", tableIds)
      .order("created_at", { ascending: false });

    if (qrError) {
      throw new Error("Unable to load table QR codes.");
    }

    qrList = (qrs ?? []) as QRRow[];
  }

  const qrByTable = new Map<string, QRRow>();

  for (const qr of qrList) {
    if (!qrByTable.has(qr.table_id) && qr.is_active) {
      qrByTable.set(qr.table_id, qr);
    }
  }

  const activeTables = tableList.filter((table) => table.is_active);
  const inactiveTables = tableList.filter((table) => !table.is_active);
  const activeQrCodes = activeTables.filter((table) =>
    qrByTable.has(table.id)
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {restaurant?.name ?? "Restaurant"}
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Tables & QR
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
            Manage physical tables and the unique QR code assigned to each
            table.
          </p>
        </div>

        <Link
          href="/restaurant/tables/manage"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          + Add tables
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Active tables"
          value={activeTables.length}
        />

        <StatCard
          label="Active QR codes"
          value={activeQrCodes}
        />

        <StatCard
          label="Inactive tables"
          value={inactiveTables.length}
        />

        <StatCard
          label="Total records"
          value={tableList.length}
        />
      </section>

      {tableList.length === 0 ? (
        <section className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100 sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
            🪑
          </div>

          <h2 className="mt-5 text-xl font-bold text-gray-900">
            No tables yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-gray-500">
            Add the number of physical tables in your restaurant and the
            platform will generate one unique QR code for every active table.
          </p>

          <Link
            href="/restaurant/tables/manage"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white"
          >
            Add your tables
          </Link>
        </section>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Your tables
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Each active table should have one active QR code.
              </p>
            </div>

            <Link
              href="/restaurant/tables/manage"
              className="hidden text-sm font-semibold text-gray-900 sm:block"
            >
              Manage →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tableList.map((table) => {
              const qr = qrByTable.get(table.id);

              return (
                <article
                  key={table.id}
                  className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                        Table
                      </p>

                      <h3 className="mt-1 truncate text-xl font-bold text-gray-900">
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
                      {table.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-5 rounded-xl bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-400">
                      QR status
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {!table.is_active
                        ? "Table inactive"
                        : qr
                          ? "QR active"
                          : "QR unavailable"}
                    </p>

                    {qr && (
                      <p className="mt-1 truncate font-mono text-[11px] text-gray-400">
                        {qr.qr_token}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/restaurant/tables/${table.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      View
                    </Link>

                    <Link
                      href={
                        qr
                          ? `/restaurant/tables/${table.id}/qr`
                          : `/restaurant/tables/${table.id}`
                      }
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                      {qr ? "View QR" : "Manage"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <p className="text-xs font-medium leading-4 text-gray-500 sm:text-sm">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}