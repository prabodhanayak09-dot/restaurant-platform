import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RestaurantDashboard() {
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

  const [
    { count: activeTables },
    { count: menuItems },
    { count: staffMembers },
  ] = await Promise.all([
    supabase
      .from("restaurant_tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),

    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("is_available", true),

    supabase
      .from("restaurant_members")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true),
  ]);

  const tableIdsResult = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true);

  const tableIds =
    tableIdsResult.data?.map((table) => table.id) ?? [];

  let activeQrCodes = 0;

  if (tableIds.length > 0) {
    const { count } = await supabase
      .from("table_qr_codes")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .in("table_id", tableIds);

    activeQrCodes = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium text-gray-500">
          Overview
        </p>

        <div className="mt-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage your restaurant from one place.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard
          label="Active tables"
          value={activeTables ?? 0}
          icon="🪑"
        />

        <DashboardCard
          label="Active QR codes"
          value={activeQrCodes}
          icon="▣"
        />

        <DashboardCard
          label="Menu items"
          value={menuItems ?? 0}
          icon="🍽️"
        />

        <DashboardCard
          label="Staff members"
          value={staffMembers ?? 0}
          icon="👥"
        />
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Quick actions
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Get to the most important restaurant tools quickly.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            href="/restaurant/orders"
            icon="📦"
            title="Orders"
            description="Monitor and manage incoming orders."
            primary
          />

          <QuickAction
            href="/restaurant/tables"
            icon="🪑"
            title="Tables & QR"
            description="Manage tables and generate QR codes."
          />

          <QuickAction
            href="/restaurant/menu"
            icon="🍽️"
            title="Menu"
            description="Manage categories, dishes, prices and availability."
          />

          <QuickAction
            href="/restaurant/staff"
            icon="👥"
            title="Staff"
            description="Manage restaurant staff and access."
          />

          <QuickAction
            href="/restaurant/payments"
            icon="₹"
            title="Payments"
            description="View payments and transaction status."
          />

          <QuickAction
            href="/restaurant/analytics"
            icon="📊"
            title="Analytics"
            description="View restaurant performance and trends."
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Restaurant setup
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Configure the important parts of your restaurant.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-600">
            {membership.role}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SetupCard
            number="01"
            title="Tables"
            description="Create the exact number of physical tables and QR codes."
            href="/restaurant/tables"
          />

          <SetupCard
            number="02"
            title="Menu"
            description="Create categories and publish your restaurant menu."
            href="/restaurant/menu"
          />

          <SetupCard
            number="03"
            title="Staff"
            description="Add staff members and control their access."
            href="/restaurant/staff"
          />
        </div>
      </section>
    </div>
  );
}

function DashboardCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>

        <span className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {value}
        </span>
      </div>

      <p className="mt-3 text-xs font-medium text-gray-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
  primary = false,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl p-5 shadow-sm ring-1 transition ${
        primary
          ? "bg-black text-white ring-black hover:bg-gray-800"
          : "bg-white text-gray-900 ring-gray-100 hover:bg-gray-50"
      }`}
    >
      <p className="text-2xl" aria-hidden="true">
        {icon}
      </p>

      <h3 className="mt-4 text-lg font-bold">
        {title}
      </h3>

      <p
        className={`mt-1 text-sm leading-5 ${
          primary ? "text-gray-300" : "text-gray-500"
        }`}
      >
        {description}
      </p>
    </Link>
  );
}

function SetupCard({
  number,
  title,
  description,
  href,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
    >
      <span className="text-xs font-bold text-gray-400">
        {number}
      </span>

      <h3 className="mt-2 font-semibold text-gray-900">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-5 text-gray-500">
        {description}
      </p>

      <span className="mt-3 inline-block text-sm font-semibold text-gray-900">
        Configure →
      </span>
    </Link>
  );
}