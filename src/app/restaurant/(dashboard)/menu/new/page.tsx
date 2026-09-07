import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type MenuCategory = {
  id: string;
  name: string;
  is_active: boolean;
};

type NewMenuItemPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewMenuItemPage({
  searchParams,
}: NewMenuItemPageProps) {
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

  const { data: categories, error: categoriesError } = await supabase
    .from("menu_categories")
    .select("id, name, is_active")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categoriesError) {
    throw new Error("Unable to load menu categories.");
  }

  const categoryList = (categories ?? []) as MenuCategory[];

  const activeCategories = categoryList.filter(
    (category) => category.is_active
  );

  const params = await searchParams;

  const errorMessage =
    params.error === "invalid-name"
      ? "Please enter a valid dish name."
      : params.error === "invalid-price"
        ? "Please enter a valid price."
        : params.error === "invalid-preparation"
          ? "Preparation time must be greater than zero."
          : params.error === "invalid-stock"
            ? "Stock quantity must be zero or greater."
            : params.error === "create-failed"
              ? "The dish could not be created. Please try again."
              : null;

  async function createMenuItem(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    const categoryId = String(
      formData.get("categoryId") ?? ""
    ).trim();

    const priceRupees = String(
      formData.get("price") ?? ""
    ).trim();

    const imageUrl = String(
      formData.get("imageUrl") ?? ""
    ).trim();

    const preparationTime = String(
      formData.get("preparationTime") ?? ""
    ).trim();

    const stockInput = String(
      formData.get("stockQuantity") ?? ""
    ).trim();

    const isAvailable =
      formData.get("isAvailable") === "on";

    if (name.length < 1 || name.length > 200) {
      redirect(
        "/restaurant/menu/new?error=invalid-name"
      );
    }

    const parsedPrice = Number(priceRupees);

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      parsedPrice > 10000000
    ) {
      redirect(
        "/restaurant/menu/new?error=invalid-price"
      );
    }

    const pricePaise = Math.round(
      parsedPrice * 100
    );

    let preparationMinutes: number | null = null;

    if (preparationTime !== "") {
      const parsedPreparation = Number(
        preparationTime
      );

      if (
        !Number.isInteger(parsedPreparation) ||
        parsedPreparation <= 0 ||
        parsedPreparation > 1440
      ) {
        redirect(
          "/restaurant/menu/new?error=invalid-preparation"
        );
      }

      preparationMinutes = parsedPreparation;
    }

    let stockQuantity: number | null = null;

    if (stockInput !== "") {
      const parsedStock = Number(stockInput);

      if (
        !Number.isInteger(parsedStock) ||
        parsedStock < 0 ||
        parsedStock > 100000000
      ) {
        redirect(
          "/restaurant/menu/new?error=invalid-stock"
        );
      }

      stockQuantity = parsedStock;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/restaurant/login");
    }

    const { data: membership } = await supabase
      .from("restaurant_members")
      .select("restaurant_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (
      !membership ||
      membership.role !== "owner"
    ) {
      redirect(
        "/restaurant/login?error=unauthorized"
      );
    }

    const { data: category } = categoryId
      ? await supabase
          .from("menu_categories")
          .select("id")
          .eq("id", categoryId)
          .eq(
            "restaurant_id",
            membership.restaurant_id
          )
          .eq("is_active", true)
          .maybeSingle()
      : { data: null };

    if (categoryId && !category) {
      redirect(
        "/restaurant/menu/new?error=create-failed"
      );
    }

    const { data: latestItem } = await supabase
      .from("menu_items")
      .select("sort_order")
      .eq(
        "restaurant_id",
        membership.restaurant_id
      )
      .order("sort_order", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const nextSortOrder =
      typeof latestItem?.sort_order === "number"
        ? latestItem.sort_order + 1
        : 0;

    const { error } = await supabase
      .from("menu_items")
      .insert({
        restaurant_id: membership.restaurant_id,
        category_id: categoryId || null,
        name,
        description: description || null,
        price_paise: pricePaise,
        image_url: imageUrl || null,
        is_available: isAvailable,
        sort_order: nextSortOrder,
        preparation_time_minutes:
          preparationMinutes,
        stock_quantity: stockQuantity,
      });

    if (error) {
      console.error(
        "Menu item creation error:",
        error
      );

      redirect(
        "/restaurant/menu/new?error=create-failed"
      );
    }

    redirect("/restaurant/menu");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <Link
          href="/restaurant/menu"
          className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Menu
        </Link>

        <p className="mt-5 text-sm font-medium text-gray-500">
          {restaurant.name}
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Add menu item
        </h1>

        <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
          Add a dish manually. You can edit these details later.
        </p>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <form
        action={createMenuItem}
        className="space-y-5"
      >
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Basic information
          </h2>

          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Dish name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                maxLength={200}
                required
                placeholder="e.g. Chicken Biryani"
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={1000}
                placeholder="Describe the dish, ingredients or serving style."
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div>
              <label
                htmlFor="categoryId"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Category
              </label>

              <select
                id="categoryId"
                name="categoryId"
                defaultValue=""
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              >
                <option value="">
                  No category
                </option>

                {activeCategories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  )
                )}
              </select>

              {activeCategories.length === 0 && (
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  You do not have any active categories yet.
                  You can create one later and move this item
                  into it.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Pricing & availability
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="price"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Price (₹)
              </label>

              <input
                id="price"
                name="price"
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                inputMode="decimal"
                placeholder="249"
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />

              <p className="mt-2 text-xs text-gray-400">
                Stored safely in paise.
              </p>
            </div>

            <div>
              <label
                htmlFor="preparationTime"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Preparation time
              </label>

              <div className="relative">
                <input
                  id="preparationTime"
                  name="preparationTime"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  inputMode="numeric"
                  placeholder="20"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-16 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                />

                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-medium text-gray-400">
                  min
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="stockQuantity"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Stock quantity
              </label>

              <input
                id="stockQuantity"
                name="stockQuantity"
                type="number"
                min="0"
                max="100000000"
                step="1"
                inputMode="numeric"
                placeholder="Leave empty for unlimited"
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />

              <p className="mt-2 text-xs text-gray-400">
                Empty means unlimited stock.
              </p>
            </div>

            <div className="flex items-center rounded-2xl bg-gray-50 p-4">
              <label
                htmlFor="isAvailable"
                className="flex w-full cursor-pointer items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Available now
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Customers can order this item when enabled.
                  </p>
                </div>

                <input
                  id="isAvailable"
                  name="isAvailable"
                  type="checkbox"
                  defaultChecked
                  className="h-5 w-5 shrink-0 accent-black"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">
            Dish image
          </h2>

          <div className="mt-5">
            <label
              htmlFor="imageUrl"
              className="mb-2 block text-sm font-semibold text-gray-900"
            >
              Image URL
            </label>

            <input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="https://example.com/dish.jpg"
              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
            />

            <p className="mt-2 text-xs leading-5 text-gray-400">
              Direct image uploading to restaurant storage will be added
              later. For now, an image URL can be saved here.
            </p>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/restaurant/menu"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            CANCEL
          </Link>

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 active:scale-[0.99]"
          >
            CREATE MENU ITEM
          </button>
        </div>
      </form>
    </div>
  );
} 