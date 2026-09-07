import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import PrintQRButton from "./PrintQRButton";

type QRPageProps = {
  params: Promise<{
    tableId: string;
  }>;
};

export default async function TableQRPage({
  params,
}: QRPageProps) {
  const { tableId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/restaurant/login");
  }

  const { data: membership, error: membershipError } =
    await supabase
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
    .select("id, name, slug")
    .eq("id", restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!restaurant) {
    redirect("/restaurant/login?error=no-restaurant");
  }

  const { data: table } = await supabase
    .from("restaurant_tables")
    .select(
      "id, restaurant_id, table_number, display_name, is_active"
    )
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!table) {
    notFound();
  }

  const { data: qr } = await supabase
    .from("table_qr_codes")
    .select(
      "id, table_id, qr_token, is_active, created_at, revoked_at"
    )
    .eq("table_id", table.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!qr) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href="/restaurant/tables"
          className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Tables & QR
        </Link>

        <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
            QR
          </div>

          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            No active QR code
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            This table does not currently have an active QR code.
          </p>

          <Link
            href={`/restaurant/tables/${table.id}`}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white"
          >
            Manage table
          </Link>
        </section>
      </div>
    );
  }

  /*
   * Development:
   * Use the Mac's LAN address so phones on the same Wi-Fi
   * can scan and open the customer page.
   *
   * Production:
   * SeNEXT_PUBLIC_SITE_URL to the real public domain.
   */
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://192.168.31.166:3000";

  const customerUrl = `${siteUrl}/t/${qr.qr_token}`;

  const qrDataUrl = await QRCode.toDataURL(customerUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 800,
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="print:hidden">
        <Link
          href="/restaurant/tables"
          className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Tables & QR
        </Link>

        <p className="mt-5 text-sm font-medium text-gray-500">
          {restaurant.name}
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {table.display_name ||
            `Table ${table.table_number}`}
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500">
          Scan this QR code to open the customer ordering page for this
          table.
        </p>
      </header>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 print:shadow-none print:ring-0">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6 print:hidden">
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
              QR Active
            </span>
          </div>
        </div>

        <div className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto w-full max-w-[min(78vw,420px)] rounded-3xl border border-gray-100 bg-white p-4 shadow-sm print:max-w-[420px] print:border-0 print:shadow-none sm:p-6">
            <Image
              src={qrDataUrl}
              alt={`QR code for ${
                table.display_name ||
                `Table ${table.table_number}`
              }`}
              width={800}
              height={800}
              unoptimized
              className="block aspect-square w-full"
            />
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Table
            </p>

            <h2 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              {table.display_name ||
                `Table ${table.table_number}`}
            </h2>

            <p className="mt-2 text-sm text-gray-500 print:hidden">
              Customers scan this code to access the restaurant menu.
            </p>
          </div>

          <div className="mt-8 rounded-2xl bg-gray-50 p-4 print:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
              Customer URL
            </p>

            <p className="mt-2 break-all font-mono text-xs leading-5 text-gray-700">
              {customerUrl}
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 print:hidden">
            <a
              href={qrDataUrl}
              download={`table-${table.table_number}-qr.png`}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              DOWNLOAD QR
            </a>

            <PrintQRButton />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6 print:hidden">
        <h2 className="text-lg font-bold text-gray-900">
          QR code details
        </h2>

        <div className="mt-4 space-y-3">
          <DetailRow
            label="Table ID"
            value={table.id}
          />

          <DetailRow
            label="QR token"
            value={qr.qr_token}
            mono
          />

          <DetailRow
            label="Customer URL"
            value={customerUrl}
            mono
          />

          <DetailRow
            label="Created"
            value={new Date(qr.created_at).toLocaleString()}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5 print:hidden">
        <h2 className="text-sm font-bold text-amber-900">
          QR security
        </h2>

        <p className="mt-1 text-sm leading-5 text-amber-800">
          This QR belongs only to{" "}
          <strong>
            {restaurant.name} —{" "}
            {table.display_name ||
              `Table ${table.table_number}`}
          </strong>
          . Regenerating the QR will revoke this token and create a new
          unique QR code.
        </p>
      </section>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-400">
        {label}
      </p>

      <p
        className={`mt-1 break-all text-sm text-gray-800 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
