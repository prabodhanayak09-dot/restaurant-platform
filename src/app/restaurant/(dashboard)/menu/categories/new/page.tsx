import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type NewCategoryPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewCategoryPage({
  searchParams,
}: NewCategoryPageProps) {
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

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("id", membership.restaurant_id)
    .eq("is_active", true)
    .maybeSingle();

  if (restaurantError || !restaurant) {
    redirect("/restaurant/login?error=no-restaurant");
  }

  const params = await searchParams;

  const errorMessage =
    params.error === "invalid-name"
      ? "Category name must contain between 1 and 100 characters."
      : params.error === "invalid-description"
        ? "Description is too long."
        : params.error === "create-failed"
          ? "The category could not be created. Please try again."
          : null;

  async function createCategory(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();

    const description = String(
      formData.get("description") ?? ""
    ).trim();

    if (name.length < 1 || name.length > 100) {
      redirect(
        "/restaurant/menu/categories/new?error=invalid-name"
      );
    }

    if (description.length > 500) {
      redirect(
        "/restaurant/menu/categories/new?error=invalid-description"
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
      redirect("/restaurant/login?error=unauthorized");
    }

    const { data: latestCategory } = await supabase
      .from("menu_categories")
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
      typeof latestCategory?.sort_order === "number"
        ? latestCategory.sort_order + 1
        : 0;

    const { error } = await supabase
      .from("menu_categories")
      .insert({
        restaurant_id: membership.restaurant_id,
        name,
        description: description || null,
        sort_order: nextSortOrder,
        is_active: true,
      });

    if (error) {
      console.error(
        "Menu category creation error:",
        error
      );

      redirect(
        "/restaurant/menu/categories/new?error=create-failed"
      );
    }

    redirect("/restaurant/menu/categories");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <Link
          href="/restaurant/menu/categories"
          className="inline-flex items-center text-sm font-semibold text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Categories
        </Link>

        <p className="mt-5 text-sm font-medium text-gray-500">
          {restaurant.name}
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Add category
        </h1>

        <p className="mt-1 text-sm leading-5 text-gray-500">
          Create a section for dishes such as Starters, Main Course,
          Desserts or Drinks.
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
        action={createCategory}
        className="space-y-5"
      >
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Category details
            </h2>

            <p className="mt-1 text-sm leading-5 text-gray-500">
              Keep category names short and easy for customers to scan.
            </p>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Category name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                maxLength={100}
                required
                placeholder="e.g. Main Course"
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
                maxLength={500}
                placeholder="Optional short description for this category."
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />

              <p className="mt-2 text-xs text-gray-400">
                Optional. Maximum 500 characters.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">
            After creating the category
          </p>

          <p className="mt-1 text-sm leading-5 text-gray-500">
            You can add dishes to this category, edit its name, change its
            description or temporarily disable it.
          </p>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href="/restaurant/menu/categories"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            CANCEL
          </Link>

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 active:scale-[0.99]"
          >
            CREATE CATEGORY
          </button>
        </div>
      </form>
    </div>
  );
}