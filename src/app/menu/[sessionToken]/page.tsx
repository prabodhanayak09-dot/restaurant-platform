import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    sessionToken: string;
  }>;
};

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_paise: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  preparation_time_minutes: number | null;
  stock_quantity: number | null;
};

export default async function MenuPage({ params }: PageProps) {
  const { sessionToken } = await params;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sessionToken
    );

  if (!isUuid) {
    notFound();
  }

  const supabase = await createClient();

  const { data: sessionData, error: sessionError } =
    await supabase.rpc("resolve_customer_session", {
      p_session_token: sessionToken,
    });

  if (sessionError || !sessionData || sessionData.length === 0) {
    notFound();
  }

  const session = sessionData[0];

  const {
    data: categories,
    error: categoriesError,
  } = await supabase
    .from("menu_categories")
    .select("id, name, description, sort_order")
    .eq("restaurant_id", session.restaurant_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categoriesError) {
    throw new Error("Unable to load menu categories.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(
      `
        id,
        category_id,
        name,
        description,
        price_paise,
        image_url,
        is_available,
        sort_order,
        preparation_time_minutes,
        stock_quantity
      `
    )
    .eq("restaurant_id", session.restaurant_id)
    .eq("is_available", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (itemsError) {
    throw new Error("Unable to load menu items.");
  }

  const safeCategories = (categories ?? []) as MenuCategory[];
  const safeItems = (items ?? []) as MenuItem[];

  const categoriesWithItems = safeCategories
    .map((category) => ({
      ...category,
      items: safeItems.filter(
        (item) => item.category_id === category.id
      ),
    }))
    .filter((category) => category.items.length > 0);

  const uncategorizedItems = safeItems.filter(
    (item) =>
      !item.category_id ||
      !safeCategories.some(
        (category) => category.id === item.category_id
      )
  );

  const formatPrice = (paise: number) =>
    `₹${(paise / 100).toFixed(2)}`;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-28 sm:px-6">
        <header className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Table {session.table_number}
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                {session.restaurant_name}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Welcome, {session.customer_first_name}. Choose your items below.
              </p>
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-xl text-white">
              🍽️
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {categoriesWithItems.map((category) => (
            <section key={category.id}>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {category.name}
                </h2>

                {category.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {category.items.map((item) => {
                  const soldOut =
                    item.stock_quantity !== null &&
                    item.stock_quantity <= 0;

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                    >
                      <div className="flex gap-4 p-4">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={96}
                            height={96}
                            className="h-24 w-24 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                            🍴
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-gray-900">
                              {item.name}
                            </h3>

                            <p className="shrink-0 font-semibold text-gray-900">
                              {formatPrice(item.price_paise)}
                            </p>
                          </div>

                          {item.description && (
                            <p className="mt-1 text-sm leading-5 text-gray-500">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-400">
                              {item.preparation_time_minutes
                                ? `${item.preparation_time_minutes} min`
                                : "Preparation time varies"}
                            </div>

                            <button
                              type="button"
                              disabled={soldOut}
                              className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              {soldOut ? "SOLD OUT" : "+ ADD"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {uncategorizedItems.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  More items
                </h2>
              </div>

              <div className="space-y-3">
                {uncategorizedItems.map((item) => {
                  const soldOut =
                    item.stock_quantity !== null &&
                    item.stock_quantity <= 0;

                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {item.name}
                          </h3>

                          {item.description && (
                            <p className="mt-1 text-sm text-gray-500">
                              {item.description}
                            </p>
                          )}

                          <p className="mt-2 text-sm font-semibold text-gray-900">
                            {formatPrice(item.price_paise)}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={soldOut}
                          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          {soldOut ? "SOLD OUT" : "+ ADD"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {categoriesWithItems.length === 0 &&
            uncategorizedItems.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="font-medium text-gray-900">
                  Menu unavailable
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  This restaurant has no available menu items right now.
                </p>
              </div>
            )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            className="w-full rounded-2xl bg-black px-5 py-4 text-sm font-bold text-white"
          >
            🛒 VIEW CART
          </button>
        </div>
      </div>
    </main>
  );
}