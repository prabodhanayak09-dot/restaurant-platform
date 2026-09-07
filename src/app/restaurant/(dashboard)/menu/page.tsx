import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AvailabilityToggle from "./components/AvailabilityToggle";

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
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

export default async function RestaurantMenuPage() {
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

  if (membershipError || !membership) {
    redirect("/restaurant/onboarding");
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

  const { data: categories, error: categoriesError } = await supabase
    .from("menu_categories")
    .select(
      "id, name, description, sort_order, is_active"
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categoriesError) {
    throw new Error("Unable to load menu categories.");
  }

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price_paise, image_url, is_available, sort_order, preparation_time_minutes, stock_quantity"
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (itemsError) {
    throw new Error("Unable to load menu items.");
  }

  const categoryList = (categories ?? []) as MenuCategory[];
  const itemList = (items ?? []) as MenuItem[];

  const activeCategories = categoryList.filter(
    (category) => category.is_active
  );

  const availableItems = itemList.filter(
    (item) => item.is_available
  );

  const unavailableItems = itemList.filter(
    (item) => !item.is_available
  );

  const uncategorizedItems = itemList.filter(
    (item) =>
      !item.category_id ||
      !categoryList.some(
        (category) => category.id === item.category_id
      )
  );

  const itemsByCategory = new Map<string, MenuItem[]>();

  for (const category of categoryList) {
    itemsByCategory.set(category.id, []);
  }

  for (const item of itemList) {
    if (
      item.category_id &&
      itemsByCategory.has(item.category_id)
    ) {
      itemsByCategory.get(item.category_id)?.push(item);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {restaurant.name}
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Menu
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
              Manage categories, dishes, prices, stock and availability.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link
              href="/restaurant/menu/scan"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              SCAN MENU
            </Link>

            <Link
              href="/restaurant/menu/new"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              + ADD ITEM
            </Link>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Categories"
          value={activeCategories.length}
        />

        <StatCard
          label="Menu items"
          value={itemList.length}
        />

        <StatCard
          label="Available"
          value={availableItems.length}
        />

        <StatCard
          label="Unavailable"
          value={unavailableItems.length}
        />
      </section>

      {categoryList.length === 0 && itemList.length === 0 ? (
        <section className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-gray-100 sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
            🍽️
          </div>

          <h2 className="mt-5 text-xl font-bold text-gray-900">
            Your menu is empty
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Add dishes manually or scan an existing restaurant menu and
            review the extracted information before publishing it.
          </p>

          <div className="mx-auto mt-6 grid max-w-md gap-3 sm:grid-cols-2">
            <Link
              href="/restaurant/menu/new"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white"
            >
              ADD MANUALLY
            </Link>

            <Link
              href="/restaurant/menu/scan"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800"
            >
              SCAN MENU
            </Link>
          </div>
        </section>
      ) : (
        <>
          {activeCategories.map((category) => {
            const categoryItems =
              itemsByCategory.get(category.id) ?? [];

            return (
              <section key={category.id} className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                      {category.name}
                    </h2>

                    {category.description && (
                      <p className="mt-1 text-sm leading-5 text-gray-500">
                        {category.description}
                      </p>
                    )}
                  </div>

                  <span className="text-xs font-medium text-gray-400">
                    {categoryItems.length}{" "}
                    {categoryItems.length === 1
                      ? "item"
                      : "items"}
                  </span>
                </div>

                {categoryItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5">
                    <p className="text-sm text-gray-500">
                      No dishes in this category yet.
                    </p>

                    <Link
                      href="/restaurant/menu/new"
                      className="mt-3 inline-flex text-sm font-semibold text-gray-900"
                    >
                      Add a dish →
                    </Link>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {categoryItems.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {uncategorizedItems.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                  Uncategorized
                </h2>

                <p className="mt-1 text-sm leading-5 text-gray-500">
                  These dishes do not currently belong to an active menu
                  category.
                </p>
              </div>

              <div className="grid gap-3">
                {uncategorizedItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                  />
                ))}
              </div>
            </section>
          )}

          {categoryList.some(
            (category) => !category.is_active
          ) && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-bold text-gray-900">
                Inactive categories
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                {categoryList
                  .filter((category) => !category.is_active)
                  .map((category) => (
                    <span
                      key={category.id}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500"
                    >
                      {category.name}
                    </span>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function MenuItemCard({
  item,
}: {
  item: MenuItem;
}) {
  const price = (item.price_paise / 100).toFixed(2);

  const stockText =
    item.stock_quantity === null
      ? "Unlimited stock"
      : item.stock_quantity === 0
        ? "Out of stock"
        : `${item.stock_quantity} in stock`;

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-24 sm:w-24">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
              🍽️
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {item.name}
              </h3>

              {item.description && (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">
                  {item.description}
                </p>
              )}
            </div>

            <p className="shrink-0 text-base font-bold text-gray-900 sm:text-lg">
              ₹{price}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                item.is_available
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {item.is_available
                ? "Available"
                : "Unavailable"}
            </span>

            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              {stockText}
            </span>

            {item.preparation_time_minutes && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                {item.preparation_time_minutes} min
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AvailabilityToggle
            itemId={item.id}
            isAvailable={item.is_available}
          />

          <div>
            <p className="text-sm font-semibold text-gray-900">
              {item.is_available
                ? "Available for customers"
                : "Hidden from customers"}
            </p>

            <p className="text-xs text-gray-500">
              Toggle when this dish can be ordered.
            </p>
          </div>
        </div>

        <Link
          href={`/restaurant/menu/${item.id}/edit`}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
        >
          EDIT
        </Link>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <p className="text-xs font-medium leading-4 text-gray-500 sm:text-sm">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
