import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function TableEntryPage({
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

  const supabase = createServerClient();

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
        <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white">
            🍽️
          </div>

          <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
            Table {table.table_number}
          </p>

          <h1 className="mt-2 text-3xl font-bold text-gray-900">
            {table.restaurant_name}
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Welcome. Please enter your details to start your order.
          </p>

          <a
            href={`/customer?restaurant=${table.restaurant_id}&table=${table.table_id}`}
            className="mt-8 block w-full rounded-xl bg-black px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            CONTINUE
          </a>
        </div>
      </div>
    </main>
  );
}