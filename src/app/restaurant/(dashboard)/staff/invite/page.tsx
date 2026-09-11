import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { createClient } from "@/lib/supabase/server";

type Invitation = {
  id: string;
  restaurant_id: string;
  token: string;
  expires_at: string;
  restaurant_name: string;
};

export default async function StaffInvitePage() {
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

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    redirect("/restaurant/login?error=no-restaurant");
  }

  const { data: invitationRows, error: invitationError } =
    await supabase.rpc("get_or_create_staff_invitation", {
      p_restaurant_id: restaurantId,
    });

  const invitation =
    (Array.isArray(invitationRows)
      ? invitationRows[0]
      : invitationRows) as Invitation | null;

  if (invitationError || !invitation) {
    console.error("Staff invitation error:", invitationError);

    return (
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/restaurant/staff"
          className="text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Staff
        </Link>

        <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-600">
            !
          </div>

          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Unable to create invitation
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            We could not create a staff invitation. Please try again.
          </p>

          <Link
            href="/restaurant/staff"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Back to Staff
          </Link>
        </section>
      </div>
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? "https://restaurant-platform-flame.vercel.app"
      : "http://localhost:3000");

  const registrationUrl = `${siteUrl}/staff/join/${invitation.token}`;

  let qrDataUrl: string;

  try {
    qrDataUrl = await QRCode.toDataURL(registrationUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 800,
    });
  } catch (qrError) {
    console.error("QR code generation error:", qrError);

    return (
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/restaurant/staff"
          className="text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Staff
        </Link>

        <section className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
          <h1 className="text-xl font-bold text-gray-900">
            Unable to generate QR code
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            The invitation was created, but the QR code could not be
            generated.
          </p>

          <Link
            href="/restaurant/staff"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Back to Staff
          </Link>
        </section>
      </div>
    );
  }

  const expiresAt = new Date(invitation.expires_at);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <Link
          href="/restaurant/staff"
          className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Staff
        </Link>

        <p className="mt-5 text-sm font-medium text-gray-500">
          {restaurant.name}
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Add Staff
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Share this QR code with staff members you want to add.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                Restaurant
              </p>

              <p className="mt-1 font-semibold text-gray-900">
                {restaurant.name}
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              Invitation Active
            </span>
          </div>
        </div>

        <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-[420px] rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <img
              src={qrDataUrl}
              alt="Staff registration QR code"
              className="block aspect-square w-full"
            />
          </div>

          <h2 className="mt-7 text-2xl font-bold text-gray-900">
            Scan to join staff
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            The same QR code can be used by multiple staff members.
            It remains valid for 24 hours and rotates automatically after
            it expires.
          </p>

          <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Registration URL
            </p>

            <p className="mt-2 break-all font-mono text-xs leading-5 text-gray-700">
              {registrationUrl}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href={qrDataUrl}
              download="staff-registration-qr.png"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              DOWNLOAD QR
            </a>

            <Link
              href="/restaurant/staff"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              BACK TO STAFF
            </Link>
          </div>

          <p className="mt-5 text-xs leading-5 text-gray-400">
            Expires: {expiresAt.toLocaleString()}
          </p>
        </div>
      </section>
    </div>
  );
}
