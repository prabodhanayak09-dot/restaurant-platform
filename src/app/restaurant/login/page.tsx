import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RestaurantLoginPage({
  searchParams,
}: LoginPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If already logged in, send the user to the correct interface.
  if (user) {
    const { data: membership } = await supabase
      .from("restaurant_members")
      .select("restaurant_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membership?.restaurant_id && membership.role === "owner") {
      redirect("/restaurant");
    }

    if (membership?.restaurant_id && membership.role === "staff") {
      redirect("/staff");
    }

    if (!membership) {
      redirect("/restaurant/onboarding");
    }
  }

  const params = await searchParams;
  const error = params.error;

  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();

    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      redirect("/restaurant/login?error=missing");
    }

    const supabase = await createClient();

    // Sign in with Supabase Auth
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !data.user) {
      redirect("/restaurant/login?error=invalid");
    }

    // Find the user's restaurant membership and role.
    const { data: membership, error: membershipError } =
      await supabase
        .from("restaurant_members")
        .select("restaurant_id, role, is_active")
        .eq("user_id", data.user.id)
        .eq("is_active", true)
        .maybeSingle();

    if (membershipError) {
      await supabase.auth.signOut();
      redirect("/restaurant/login?error=system");
    }

    if (!membership) {
      redirect("/restaurant/onboarding");
    }

    // STAFF → Staff interface
    if (membership.role === "staff") {
      redirect("/staff");
    }

    // Anything other than owner is not allowed here.
    if (membership.role !== "owner") {
      await supabase.auth.signOut();
      redirect("/restaurant/login?error=unauthorized");
    }

    // OWNER → Check restaurant
    const { data: restaurant, error: restaurantError } =
      await supabase
        .from("restaurants")
        .select("id, is_active")
        .eq("id", membership.restaurant_id)
        .maybeSingle();

    if (restaurantError || !restaurant) {
      await supabase.auth.signOut();
      redirect("/restaurant/login?error=no-restaurant");
    }

    if (!restaurant.is_active) {
      await supabase.auth.signOut();
      redirect("/restaurant/login?error=inactive");
    }

    // OWNER → Restaurant admin interface
    redirect("/restaurant");
  }

  const errorMessage =
    error === "invalid"
      ? "Invalid email or password."
      : error === "unauthorized"
        ? "This account is not authorized."
        : error === "inactive"
          ? "This restaurant is currently inactive."
          : error === "no-restaurant"
            ? "No restaurant was found for this account."
            : error === "missing"
              ? "Please enter your email and password."
              : error === "system"
                ? "Something went wrong. Please try again."
                : null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8">

          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white">
              🍽️
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Restaurant Platform
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
              Restaurant Login
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-5 text-gray-500">
              Sign in to manage your restaurant, menu, tables, QR codes,
              orders and staff.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form action={login} className="space-y-5">

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="owner@example.com"
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 active:scale-[0.99]"
            >
              SIGN IN
            </button>

          </form>

          <p className="mt-6 text-center text-xs leading-5 text-gray-400">
            Restaurant owners and authorized staff can sign in here.
          </p>

        </div>
      </div>
    </main>
  );
}
