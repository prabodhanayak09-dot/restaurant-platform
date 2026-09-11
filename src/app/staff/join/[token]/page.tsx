import { createClient } from "@/lib/supabase/server";

type StaffJoinPageProps = {
  params: Promise<{
    token: string;
  }>;
};

type StaffInvitation = {
  id: string;
  restaurant_id: string;
  token: string;
  expires_at: string;
  restaurant_name: string;
};

export default async function StaffJoinPage({
  params,
}: StaffJoinPageProps) {
  const { token } = await params;

  const supabase = await createClient();

  /*
   * The QR token is the only authority for identifying the restaurant.
   *
   * We intentionally use the SECURITY DEFINER RPC instead of reading
   * staff_invitations directly, because anonymous users must not have
   * SELECT access to that table.
   */

  const { data: invitationRows, error } = await supabase.rpc(
    "get_staff_invitation",
    {
      p_token: token,
    }
  );

  const invitation =
    (Array.isArray(invitationRows)
      ? invitationRows[0]
      : invitationRows) as StaffInvitation | null;

  if (error || !invitation) {
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
              This staff invitation is invalid, expired, or no longer
              active.
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
              Join {invitation.restaurant_name}
            </h1>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Create your staff account to access restaurant orders.
            </p>
          </div>

          <form
            action="/api/staff/register"
            method="POST"
            className="space-y-5 p-6 sm:p-8"
          >
            <input
              type="hidden"
              name="token"
              value={invitation.token}
            />

            <div>
              <label
                htmlFor="name"
                className="text-sm font-medium text-gray-800"
              >
                Full name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-100"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="text-sm font-medium text-gray-800"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="text-sm font-medium text-gray-800"
              >
                Phone number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                required
                maxLength={20}
                autoComplete="tel"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-100"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-medium text-gray-800"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-100"
                placeholder="Create a password"
              />

              <p className="mt-2 text-xs text-gray-400">
                Use at least 8 characters.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="text-sm font-medium text-gray-800"
              >
                Confirm password
              </label>

              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className="mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-100"
                placeholder="Re-enter your password"
              />
            </div>

            <p className="rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-500">
              Your information is used to create your staff account and
              provide access to this restaurant's staff system. Your
              account will be assigned to this restaurant automatically
              from the invitation QR code.
            </p>

            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 active:scale-[0.99]"
            >
              CREATE STAFF ACCOUNT
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
