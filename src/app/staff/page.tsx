import { createClient } from "@/lib/supabase/server";

type Order = {
  id: string;
  restaurant_id: string;
  table_id: string;
  customer_id: string;
  status: string;
  total_paise: number;
  estimated_preparation_minutes: number | null;
  created_at: string;
  updated_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  unit_price_paise: number;
  quantity: number;
  total_price_paise: number;
};

type Payment = {
  order_id: string;
  method: "upi" | "card" | "cash";
  status: "pending" | "paid" | "failed" | "refunded";
  amount_paise: number;
  paid_at: string | null;
};

type Table = {
  id: string;
  table_number: number;
  display_name: string | null;
};

type Customer = {
  id: string;
  first_name: string;
  phone: string;
};

const activeStatuses = [
  "pending_acceptance",
  "preparing",
  "ready",
  "served",
];

function formatMoney(paise: number) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function formatDateTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "pending_acceptance":
      return "Pending acceptance";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "served":
      return "Served";
    default:
      return status.replaceAll("_", " ");
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "pending_acceptance":
      return "bg-amber-100 text-amber-800";
    case "preparing":
      return "bg-blue-100 text-blue-800";
    case "ready":
      return "bg-emerald-100 text-emerald-800";
    case "served":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "upi":
      return "UPI";
    case "card":
      return "Card";
    case "cash":
      return "Cash";
    default:
      return method;
  }
}

export default async function StaffDashboard() {
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

  if (!membership || membership.role !== "staff") {
    return null;
  }

  const restaurantId = membership.restaurant_id;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, table_id, customer_id, status, total_paise, estimated_preparation_minutes, created_at, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false });

  const safeOrders = (orders ?? []) as Order[];

  const orderIds = safeOrders.map((order) => order.id);
  const tableIds = safeOrders.map((order) => order.table_id);
  const customerIds = safeOrders.map((order) => order.customer_id);

  const [{ data: orderItems }, { data: payments }, { data: tables }, { data: customers }] =
    await Promise.all([
      orderIds.length > 0
        ? supabase
            .from("order_items")
            .select(
              "id, order_id, item_name, unit_price_paise, quantity, total_price_paise",
            )
            .in("order_id", orderIds)
        : Promise.resolve({ data: [] }),
      orderIds.length > 0
        ? supabase
            .from("payments")
            .select(
              "order_id, method, status, amount_paise, paid_at",
            )
            .in("order_id", orderIds)
        : Promise.resolve({ data: [] }),
      tableIds.length > 0
        ? supabase
            .from("restaurant_tables")
            .select("id, table_number, display_name")
            .in("id", tableIds)
        : Promise.resolve({ data: [] }),
      customerIds.length > 0
        ? supabase
            .from("customers")
            .select("id, first_name, phone")
            .in("id", customerIds)
        : Promise.resolve({ data: [] }),
    ]);

  const safeItems = (orderItems ?? []) as OrderItem[];
  const safePayments = (payments ?? []) as Payment[];
  const safeTables = (tables ?? []) as Table[];
  const safeCustomers = (customers ?? []) as Customer[];

  const itemsByOrder = new Map<string, OrderItem[]>();
  const paymentByOrder = new Map<string, Payment>();
  const tableById = new Map<string, Table>();
  const customerById = new Map<string, Customer>();

  for (const item of safeItems) {
    const current = itemsByOrder.get(item.order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.order_id, current);
  }

  for (const payment of safePayments) {
    paymentByOrder.set(payment.order_id, payment);
  }

  for (const table of safeTables) {
    tableById.set(table.id, table);
  }

  for (const customer of safeCustomers) {
    customerById.set(customer.id, customer);
  }

  const pendingOrders = safeOrders.filter(
    (order) => order.status === "pending_acceptance",
  );
  const preparingOrders = safeOrders.filter(
    (order) => order.status === "preparing",
  );
  const readyOrders = safeOrders.filter(
    (order) => order.status === "ready",
  );
  const servedOrders = safeOrders.filter(
    (order) => order.status === "served",
  );

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium text-gray-500">
          {restaurant?.name ?? "Restaurant"}
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Orders
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage today's customer orders from acceptance through service.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="Pending acceptance"
          value={pendingOrders.length}
        />
        <SummaryCard
          label="Preparing"
          value={preparingOrders.length}
        />
        <SummaryCard
          label="Ready"
          value={readyOrders.length}
        />
        <SummaryCard
          label="Served"
          value={servedOrders.length}
        />
      </section>

      {ordersError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Orders could not be loaded.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Active orders
            </h2>
            <p className="text-sm text-gray-500">
              Newest orders appear first.
            </p>
          </div>

          <p className="text-sm font-medium text-gray-500">
            {safeOrders.length} active{" "}
            {safeOrders.length === 1 ? "order" : "orders"}
          </p>
        </div>

        {safeOrders.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
              ✓
            </div>
            <h3 className="mt-4 font-bold text-gray-900">
              No active orders
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              New customer orders will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {safeOrders.map((order) => {
              const payment = paymentByOrder.get(order.id);
              const table = tableById.get(order.table_id);
              const customer = customerById.get(order.customer_id);
              const items = itemsByOrder.get(order.id) ?? [];

              const isCash = payment?.method === "cash";
              const isCashPending =
                isCash && payment?.status === "pending";

              const showConfirmCashOrder =
                isCashPending &&
                order.status === "pending_acceptance";

              const showAcceptOrder =
                !isCash &&
                payment?.status === "paid" &&
                order.status === "pending_acceptance";

              const showPreparingComplete =
                order.status === "preparing";

              const showServed =
                order.status === "ready";

              const showCashPayment =
                isCashPending &&
                order.status === "served";

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100"
                >
                  <div className="border-b border-gray-100 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                            #{order.id
                              .slice(0, 8)
                              .toUpperCase()}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(
                              order.status,
                            )}`}
                          >
                            {statusLabel(order.status)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
                          <span className="font-semibold text-gray-900">
                            Table{" "}
                            {table?.display_name ??
                              table?.table_number ??
                              "—"}
                          </span>

                          <span>
                            {customer?.first_name ??
                              "Customer"}
                          </span>

                          <span>
                            {formatDateTime(order.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <p className="text-xs font-medium text-gray-500">
                          Total
                        </p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">
                          {formatMoney(order.total_paise)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_300px]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Ordered items
                      </p>

                      <div className="mt-3 space-y-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {item.quantity} ×{" "}
                                {item.item_name}
                              </p>
                            </div>

                            <p className="shrink-0 text-sm font-semibold text-gray-700">
                              {formatMoney(
                                item.total_price_paise,
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Payment
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            payment?.status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : isCash
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {payment
                            ? paymentStatusLabel(
                                payment.status,
                              )
                            : "Unavailable"}
                        </span>
                      </div>

                      <p className="mt-3 text-lg font-bold text-gray-900">
                        {payment
                          ? paymentMethodLabel(
                              payment.method,
                            )
                          : "Payment"}
                      </p>

                      {isCash && payment?.status === "pending" && (
                        <p className="mt-1 text-xs leading-5 text-gray-500">
                          Customer pays staff after the meal.
                        </p>
                      )}

                      {payment?.status === "paid" &&
                        payment.paid_at && (
                          <p className="mt-1 text-xs text-gray-500">
                            Paid{" "}
                            {formatDateTime(
                              payment.paid_at,
                            )}
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="border-t border-gray-100 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap gap-5">
                        <div>
                          <p className="text-xs font-medium text-gray-400">
                            Preparation time
                          </p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {order.estimated_preparation_minutes
                              ? `${order.estimated_preparation_minutes} min`
                              : "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-gray-400">
                            Order placed
                          </p>
                          <p className="mt-1 text-sm font-bold text-gray-900">
                            {formatDateTime(
                              order.created_at,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        {showConfirmCashOrder && (
                          <form
                            action="/api/staff/orders/status"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="order_id"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="new_status"
                              value="preparing"
                            />

                            <button
                              type="submit"
                              className="w-full rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:w-auto"
                            >
                              CONFIRM ORDER
                            </button>
                          </form>
                        )}

                        {showAcceptOrder && (
                          <form
                            action="/api/staff/orders/status"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="order_id"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="new_status"
                              value="preparing"
                            />

                            <button
                              type="submit"
                              className="w-full rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:w-auto"
                            >
                              ACCEPT ORDER
                            </button>
                          </form>
                        )}

                        {showPreparingComplete && (
                          <form
                            action="/api/staff/orders/status"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="order_id"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="new_status"
                              value="ready"
                            />

                            <button
                              type="submit"
                              className="w-full rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:w-auto"
                            >
                              MARK READY
                            </button>
                          </form>
                        )}

                        {showServed && (
                          <form
                            action="/api/staff/orders/status"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="order_id"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="new_status"
                              value="served"
                            />

                            <button
                              type="submit"
                              className="w-full rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:w-auto"
                            >
                              MARK SERVED
                            </button>
                          </form>
                        )}

                        {showCashPayment && (
                          <form
                            action="/api/staff/orders/cash-payment"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="order_id"
                              value={order.id}
                            />

                            <button
                              type="submit"
                              className="w-full rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-gray-800 sm:w-auto"
                            >
                              CONFIRM CASH PAYMENT
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
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
      <p className="text-xs font-medium text-gray-500 sm:text-sm">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
