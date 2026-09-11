import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
  searchParams: Promise<{
    created?: string;
  }>;
};

type Order = {
  id: string;
  restaurant_id: string;
  table_id: string;
  customer_id: string;
  status: string;
  total_paise: number;
  estimated_preparation_minutes: number | null;
  created_at: string;
};

type Payment = {
  method: string;
  status: string;
  amount_paise: number;
};

export default async function OrderPage({
  params,
  searchParams,
}: PageProps) {
  const { orderId } = await params;
  const { created } = await searchParams;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(orderId)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, table_id, customer_id, status, total_paise, estimated_preparation_minutes, created_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    notFound();
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("method, status, amount_paise")
    .eq("order_id", orderId)
    .maybeSingle();

  const typedOrder = order as Order;
  const typedPayment = payment as Payment | null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", typedOrder.restaurant_id)
    .maybeSingle();

  const { data: table } = await supabase
    .from("restaurant_tables")
    .select("table_number, display_name")
    .eq("id", typedOrder.table_id)
    .maybeSingle();

  const isCash = typedPayment?.method === "cash";

  const paymentLabel = isCash
    ? "Cash"
    : typedPayment?.method === "upi"
      ? "UPI"
      : typedPayment?.method === "card"
        ? "Card"
        : "Payment";

  const paymentStatusLabel =
    typedPayment?.status === "paid"
      ? "Paid"
      : isCash
        ? "Pay after your meal"
        : "Payment pending";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white">
              ✓
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Order placed
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Thank you!
            </h1>

            <p className="mt-2 text-sm leading-5 text-gray-500">
              Your order has been sent to the restaurant.
            </p>
          </div>

          <div className="mt-8 rounded-2xl bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">
                Order
              </span>

              <span className="font-bold text-gray-900">
                #{typedOrder.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">
                Restaurant
              </span>

              <span className="text-right text-sm font-semibold text-gray-900">
                {restaurant?.name ?? "Restaurant"}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">
                Table
              </span>

              <span className="text-sm font-semibold text-gray-900">
                {table?.display_name ??
                  table?.table_number ??
                  "—"}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">
                Total
              </span>

              <span className="text-lg font-bold text-gray-900">
                ₹{(typedOrder.total_paise / 100).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Payment
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="font-semibold capitalize text-gray-900">
                {paymentLabel}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  typedPayment?.status === "paid"
                    ? "bg-green-100 text-green-700"
                    : isCash
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {paymentStatusLabel}
              </span>
            </div>

            {isCash && (
              <p className="mt-3 text-sm leading-5 text-gray-600">
                Please pay the restaurant staff in cash after
                your meal. The staff will confirm your payment
                and your receipt will be sent to WhatsApp.
              </p>
            )}
          </div>

          {isCash && (
            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                  🍽️
                </span>

                <div>
                  <p className="font-semibold text-gray-900">
                    {created === "1"
                      ? "Cash order confirmed"
                      : "Cash payment pending"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Your food can be prepared before payment.
                    Pay after eating.
                  </p>
                </div>
              </div>
            </div>
          )}

          {typedOrder.estimated_preparation_minutes && (
            <div className="mt-5 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Estimated preparation
              </p>

              <p className="mt-2 text-xl font-bold text-gray-900">
                {typedOrder.estimated_preparation_minutes} minutes
              </p>
            </div>
          )}

          <Link
            href={`/order/${typedOrder.id}/status`}
            className="mt-6 block w-full rounded-2xl bg-black px-5 py-4 text-center text-sm font-bold text-white transition hover:bg-gray-800"
          >
            VIEW ORDER STATUS
          </Link>
        </div>
      </div>
    </main>
  );
}
