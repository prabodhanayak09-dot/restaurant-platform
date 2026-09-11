import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

const statusSteps = [
  {
    key: "pending_acceptance",
    label: "Order received",
  },
  {
    key: "preparing",
    label: "Preparing",
  },
  {
    key: "ready",
    label: "Ready",
  },
  {
    key: "served",
    label: "Served",
  },
];

const statusRank: Record<string, number> = {
  pending_acceptance: 0,
  preparing: 1,
  ready: 2,
  served: 3,
};

export default async function OrderStatusPage({
  params,
}: PageProps) {
  const { orderId } = await params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(orderId)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, table_id, status, total_paise, created_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("method, status")
    .eq("order_id", orderId)
    .maybeSingle();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", order.restaurant_id)
    .maybeSingle();

  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("table_number, display_name")
    .eq("id", order.table_id)
    .maybeSingle();

  const currentRank =
    statusRank[order.status] ?? 0;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            {restaurant?.name ?? "Restaurant"}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            Order status
          </h1>

          <div className="mt-3 flex flex-wrap gap-2 text-sm text-gray-500">
            <span>
              Table{" "}
              {table?.display_name ??
                table?.table_number ??
                "—"}
            </span>

            <span>•</span>

            <span>
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
          </div>

          <div className="mt-8 space-y-4">
            {statusSteps.map((step, index) => {
              const completed =
                currentRank >= index;

              const current =
                order.status === step.key;

              return (
                <div
                  key={step.key}
                  className="flex items-center gap-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      completed
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {completed ? "✓" : index + 1}
                  </div>

                  <div>
                    <p
                      className={`font-semibold ${
                        current
                          ? "text-gray-900"
                          : completed
                            ? "text-gray-700"
                            : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>

                    {current && (
                      <p className="mt-1 text-xs text-gray-500">
                        Current status
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Payment
              </span>

              <span className="text-sm font-bold capitalize text-gray-900">
                {payment?.method ?? "—"} ·{" "}
                {payment?.status ?? "—"}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Total
              </span>

              <span className="text-lg font-bold text-gray-900">
                ₹{(order.total_paise / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
