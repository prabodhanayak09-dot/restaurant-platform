import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

type CategoriesPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
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
    .select(
      "id, name, description, sort_order, is_active, created_at"
    )
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (categoriesError) {
    throw new Error("Unable to load menu categories.");
  }

  const categoryList = (categories ?? []) as Category[];

  const activeCategories = categoryList.filter(
    (category) => category.is_active
  );

  const inactiveCategories = categoryList.filter(
    (category) => !category.is_active
  );

  const params = await searchParams;

  const errorMessage =
    params.error === "toggle-failed"
      ? "Unable to update the category status."
      : params.error === "delete-failed"
        ? "Unable to remove the category."
        : params.error === "owner-only"
          ? "Only the restaurant owner can manage categories."
          : null;

  const successMessage =
    params.success === "activated"
      ? "Category activated."
      : params.success === "deactivated"
        ? "Category deactivated."
        : params.success === "deleted"
          ? "Category removed."
          : null;

  async function toggleCategory(formData: FormData) {
    "use server";

    const categoryId = String(
      formData.get("categoryId") ?? ""
    ).trim();

    const nextActive =
      String(formData.get("nextActive") ?? "") === "true";

    if (!categoryId) {
      redirect(
        `/restaurant/menu/categories?error=toggle-failed`
      );
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
        "/restaurant/menu/categories?error=owner-only"
      );
    }

    const { error } = await supabase
      .from("menu_categories")
      .update({
        is_active: nextActive,
      })
      .eq("id", categoryId)
      .eq("restaurant_id", membership.restaurant_id);

    if (error) {
      console.error(
        "Category status update error:",
        error
      );

      redirect(
        "/restaurant/menu/categories?error=toggle-failed"
      );
    }

    redirect(
      `/restaurant/menu/categories?success=${
        nextActive
          ? "activated"
          : "deactivated"
      }`
    );
  }

  async function deleteCategory(formData: FormData) {
    "use server";

    const categoryId = String(
      formData.get("categoryId") ?? ""
    ).trim();

    if (!categoryId) {
      redirect(
        "/restaurant/menu/categories?error=delete-failed"
      );
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
        "/restaurant/menu/categories?error=owner-only"
      );
    }

    /*
     * The menu_items.category_id foreign key uses
     * ON DELETE SET NULL, so deleting a category does
     * not delete its dishes.
     */
    const { error } = await supabase
      .from("menu_categories")
      .delete()
      .eq("id", categoryId)
      .eq("restaurant_id", membership.restaurant_id);

    if (error) {
      console.error(
        "Category deletion error:",
        error
      );

      redirect(
        "/restaurant/menu/categories?error=delete-failed"
      );
    }

    redirect(
      "/restaurant/menu/categories?success=deleted"
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
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
            Categories
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
            Organize dishes into clear sections that customers can browse.
          </p>
        </div>

        <Link
          href="/restaurant/menu/categories/new"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          + ADD CATEGORY
        </Link>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm leading-5 text-green-700"
        >
          {successMessage}
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total categories"
          value={categoryList.length}
        />

        <StatCard
          label="Active"
          value={activeCategories.length}
        />

        <StatCard
          label="Inactive"
          value={inactiveCategories.length}
        />
      </section>

      {categoryList.length === 0 ? (
        <section className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-gray-100 sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
            ☰
          </div>

          <h2 className="mt-5 text-xl font-bold text-gray-900">
            No categories yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Create categories such as Starters, Main Course, Desserts or
            Drinks to organize your menu.
          </p>

          <Link
            href="/restaurant/menu/categories/new"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white"
          >
            CREATE FIRST CATEGORY
          </Link>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Your categories
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Customers will see active categories on the menu.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {categoryList.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                toggleCategory={toggleCategory}
                deleteCategory={deleteCategory}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  toggleCategory,
  deleteCategory,
}: {
  category: Category;
  toggleCategory: (formData: FormData) => void;
  deleteCategory: (formData: FormData) => void;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 sm:text-lg">
              {category.name}
            </h3>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                category.is_active
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {category.is_active
                ? "Active"
                : "Inactive"}
            </span>
          </div>

          {category.description && (
            <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
              {category.description}
            </p>
          )}

          <p className="mt-2 text-xs text-gray-400">
            Sort order: {category.sort_order}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Link
            href={`/restaurant/menu/categories/${category.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            EDIT
          </Link>

          <form action={toggleCategory}>
            <input
              type="hidden"
              name="categoryId"
              value={category.id}
            />

            <input
              type="hidden"
              name="nextActive"
              value={category.is_active ? "false" : "true"}
            />

            <button
              type="submit"
              className={`inline-flex h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
                category.is_active
                  ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  : "bg-black text-white hover:bg-gray-800"
              }`}
            >
              {category.is_active
                ? "DISABLE"
                : "ACTIVATE"}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3">
        <form action={deleteCategory}>
          <input
            type="hidden"
            name="categoryId"
            value={category.id}
          />

          <button
            type="submit"
            className="text-xs font-semibold text-red-600 transition hover:text-red-700"
          >
            REMOVE CATEGORY
          </button>
        </form>
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