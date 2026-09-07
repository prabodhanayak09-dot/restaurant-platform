/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type TablePageProps = {
  params: Promise<{
    tableId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function TableManagementPage({
  params,
  searchParams,
}: TablePageProps) {
  const { tableId } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/restaurant/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    redirect("/restaurant/onboarding");
  }

  if (membership.role !== "owner") {
    redirect("/restaurant/tables?error=owner-only");
  }

  const restaurantId = membership.restaurant_id;

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    redirect("/restaurant/login?error=no-restaurant");
  }

  const { data: table, error: tableError } = await supabase
    .from("restaurant_tables")
    .select(
      "id, restaurant_id, table_number, display_name, is_active, created_at"
    )
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (tableError || !table) {
    notFound();
  }

  const { data: qrCodes, error: qrError } = await supabase
    .from("table_qr_codes")
    .select(
      "id, table_id, qr_token, is_active, created_at, revoked_at"
    )
    .eq("table_id", table.id)
    .order("created_at", { ascending: false });

  if (qrError) {
    throw new Error("Unable to load table QR codes.");
  }

  const activeQr = (qrCodes ?? []).find((qr) => qr.is_active) ?? null;
  const previousQrCount = (qrCodes ?? []).filter(
    (qr) => !qr.is_active
  ).length;

  const errorMessage =
    query.error === "regenerate-failed"
      ? "Unable to regenerate the QR code."
      : query.error === "revoke-failed"
        ? "Unable to revoke the QR code."
        : query.error === "toggle-failed"
          ? "Unable to update the table status."
          : query.error === "invalid"
            ? "The requested operation could not be completed."
            : null;

  const successMessage =
    query.success === "regenerated"
      ? "A new QR code has been generated. The previous QR code is no longer active."
      : query.success === "revoked"
        ? "The QR code has been revoked."
        : query.success === "activated"
          ? "The table has been activated."
          : query.success === "deactivated"
            ? "The table has been deactivated."
            : null;

  async function regenerateQR() {
    "use server";

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

    if (!membership || membership.role !== "owner") {
      redirect("/restaurant/login?error=unauthorized");
    }

    const { data: newQrToken, error } = await supabase.rpc(
      "regenerate_table_qr",
      {
        p_restaurant_id: membership.restaurant_id,
        p_table_id: tableId,
      }
    );

    if (error || !newQrToken) {
      console.error("QR regeneration error:", error);

      redirect(
        `/restaurant/tables/${tableId}?error=regenerate-failed`
      );
    }

    redirect(
      `/restaurant/tables/${tableId}?success=regenerated`
    );
  }

  async function revokeQR() {
    "use server";

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

    if (!membership || membership.role !== "owner") {
      redirect("/restaurant/login?error=unauthorized");
    }

    const { error } = await supabase.rpc("revoke_table_qr", {
      p_restaurant_id: membership.restaurant_id,
      p_table_id: tableId,
    });

    if (error) {
      console.error("QR revoke error:", error);

      redirect(
        `/restaurant/tables/${tableId}?error=revoke-failed`
      );
    }

    redirect(
      `/restaurant/tables/${tableId}?success=revoked`
    );
  }

  async function toggleTableStatus() {
    "use server";

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

    if (!membership || membership.role !== "owner") {
      redirect("/restaurant/login?error=unauthorized");
    }

    const { data: currentTable, error: currentTableError } =
      await supabase
        .from("restaurant_tables")
        .select("is_active")
        .eq("id", tableId)
        .eq("restaurant_id", membership.restaurant_id)
        .maybeSingle();

    if (currentTableError || !currentTable) {
      redirect(
        `/restaurant/tables/${tableId}?error=invalid`
      );
    }

    const nextActiveState = !currentTable.is_active;

    const { error: updateError } = await supabase
      .from("restaurant_tables")
      .update({
        is_active: nextActiveState,
      })
      .eq("id", tableId)
      .eq("restaurant_id", membership.restaurant_id);

    if (updateError) {
      console.error(
        "Table status update error:",
        updateError
      );

      redirect(
        `/restaurant/tables/${tableId}?error=toggle-failed`
      );
    }

    redirect(
      `/restaurant/tables/${tableId}?success=${
        nextActiveState ? "activated" : "deactivated"
      }`
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <Link
          href="/restaurant/tables"
          className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Tables & QR
        </Link>

        <p className="mt-5 text-sm font-medium text-gray-500">
          {restaurant.name}
        </p>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {table.display_name ||
                `Table ${table.table_number}`}
            </h1>

            <p className="mt-1 text-sm leading-5 text-gray-500">
              Manage this physical table and its QR code.
            </p>
          </div>

          <span
            className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
              table.is_active
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {table.is_active ? "ACTIVE" : "INACTIVE"}
          </span>
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
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard
            label="Table number"
            value={String(table.table_number)}
          />

          <InfoCard
            label="QR status"
            value={
              activeQr
                ? "Active"
                : "No active QR"
            }
          />

          <InfoCard
            label="Previous QR codes"
            value={String(previousQrCount)}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-gray-900">
            QR code
          </h2>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            This QR belongs exclusively to this table in this restaurant.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          {activeQr ? (
            <>
              <div className="rounded-2xl bg-gray-50 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  Active QR token
                </p>

                <p className="mt-2 break-all font-mono text-xs leading-5 text-gray-700">
                  {activeQr.qr_token}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Link
                  href={`/restaurant/tables/${table.id}/qr`}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  VIEW QR
                </Link>

                <form action={regenerateQR}>
                  <button
                    type="submit"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                  >
                    REGENERATE
                  </button>
                </form>

                <form action={revokeQR}>
                  <button
                    type="submit"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    REVOKE
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-5">
              <h3 className="font-semibold text-gray-900">
                No active QR code
              </h3>

              <p className="mt-1 text-sm leading-5 text-gray-500">
                Generate a new QR code to allow customers to access this
                table's ordering page.
              </p>

              <form action={regenerateQR} className="mt-4">
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 sm:w-auto"
                >
                  GENERATE NEW QR
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900">
          Table status
        </h2>

        <p className="mt-1 text-sm leading-5 text-gray-500">
          Deactivating a table keeps its historical records while preventing
          it from being treated as an active table.
        </p>

        <form action={toggleTableStatus} className="mt-5">
          <button
            type="submit"
            className={`inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition sm:w-auto ${
              table.is_active
                ? "border border-red-200 bg-white text-red-700 hover:bg-red-50"
                : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            {table.is_active
              ? "DEACTIVATE TABLE"
              : "ACTIVATE TABLE"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
        <h2 className="text-sm font-bold text-amber-900">
          QR security
        </h2>

        <p className="mt-1 text-sm leading-5 text-amber-800">
          Every QR token is unique. Regenerating this table's QR revokes its
          previous active QR and creates a completely new token.
        </p>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}