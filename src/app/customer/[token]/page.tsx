import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CustomerDetailsPage({
  params,
}: PageProps) {
  const { token } = await params;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token
    );

  if (!isUuid) {
    notFound();
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resolve_table_qr", {
    p_qr_token: token,
  });

  if (error || !data || data.length === 0) {
    notFound();
  }

  const table = data[0];

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white">
              🍽️
            </div>

            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
              TABLE {table.table_number}
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {table.restaurant_name}
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Welcome! Let&apos;s get your order started.
            </p>
          </div>

          <form
            action="/"
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="firstName"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                First name
              </label>

              <input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="Enter your first name"
                maxLength={50}
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Phone number
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                maxLength={20}
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
              />

              <p className="mt-2 text-xs leading-5 text-gray-500">
                Your phone number is used for your order and order-related
                services.
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs leading-5 text-gray-500">
                You are ordering at Table {table.table_number}. Your table is
                securely linked to this QR code.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-black px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.99]"
            >
              CONTINUE →
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            No account or password required.
          </p>
        </div>
      </div>
    </main>
  );
}