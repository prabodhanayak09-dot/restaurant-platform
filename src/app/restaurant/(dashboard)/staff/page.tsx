import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StaffPage() {
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

  if (
    membershipError ||
    !membership ||
    membership.role !== "owner"
  ) {
    redirect("/restaurant/login?error=unauthorized");
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

  const { data: staffMembers, error: staffError } = await supabase
    .from("restaurant_members")
    .select("id, user_id, role, is_active, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("role", "staff")
    .order("created_at", { ascending: false });

  if (staffError) {
    console.error("Staff loading error:", staffError);
  }

  const staff = staffMembers ?? [];

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {restaurant.name}
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Staff
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage restaurant staff and access.
            </p>
          </div>

          <Link
            href="/restaurant/staff/invite"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            + Add Staff
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total staff"
          value={staff.length}
        />

        <SummaryCard
          label="Active staff"
          value={staff.filter((member) => member.is_active).length}
        />

        <SummaryCard
          label="Inactive staff"
          value={staff.filter((member) => !member.is_active).length}
        />
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Staff members
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Staff members connected to this restaurant.
            </p>
          </div>
        </div>

        {staff.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
              👥
            </div>

            <h3 className="mt-4 text-lg font-bold text-gray-900">
              No staff members yet
            </h3>

            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">
              Add your first staff member by generating a staff invitation
              QR code.
            </p>

            <Link
              href="/restaurant/staff/invite"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Add Staff
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {staff.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    Staff member
                  </p>

                  <p className="mt-1 truncate text-xs text-gray-500">
                    ID: {member.user_id}
                  </p>
                </div>

                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    member.is_active
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {member.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
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
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <p className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {value}
      </p>

      <p className="mt-2 text-xs font-medium text-gray-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}
