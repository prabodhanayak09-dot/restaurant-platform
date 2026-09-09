import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type StaffJoinPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function StaffJoinPage({
  params,
}: StaffJoinPageProps) {
  const { token } = await params;

  const supabase = await createClient();

  const { data: invitation, error } = await supabase
    .from("staff_invitations")
    .select("id, restaurant_id, token, expires_at, used_at, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (
    error ||
    !invitation ||
    invitation.used_at ||
    new Date(invitation.expires_at) <= new Date()
  ) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100 sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
              ⚠️
            </div>

            <h1 className="mt-5 text-2xl font-bold text-gray-900">
              Invitation unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              This staff invitation is invalid, expired, or has already been
              used.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", invitation.restaurant_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!restaurant) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100 sm:p-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Restaurant unavailable
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              This restaurant is currently unavailable.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="border-b border-gray-100 px-6 py-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-sm font-bold text-white">
              R
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Staff registration
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
              Join {restaurant.name}
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Enter your details to join this restaurant as a staff member.
            </p>
          </div>

          <form
            action="/api/staff/register"
            method="POST"
            className="space-y-5 p-6 sm:p-8"
          >
            <input type="hidden" name="token" value={invitation.token} />

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-gray-900"
              >
                Full name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Enter your name"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-900"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-gray-900"
              >
                Phone number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                placeholder="Enter your phone number"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black"
              />
            </div>

            <p className="rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-500">
              Your information is used to identify you as a staff member of
              this restaurant and provide access to restaurant orders.
            </p>

            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              CONTINUE
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
