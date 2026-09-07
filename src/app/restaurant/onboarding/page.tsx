import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RestaurantOnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/restaurant/login");
  }

  const { data: existingMembership } = await supabase
    .from("restaurant_members")
    .select("id, restaurant_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (existingMembership?.restaurant_id) {
    redirect("/restaurant");
  }

  const params = await searchParams;
  const error = params.error;

  async function createRestaurant(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const address = String(formData.get("address") ?? "").trim();

    if (name.length < 2 || name.length > 120) {
      redirect("/restaurant/onboarding?error=invalid-name");
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
      .select("id, restaurant_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (membership?.restaurant_id) {
      redirect("/restaurant");
    }

    const { data, error: rpcError } = await supabase.rpc(
      "create_restaurant_for_owner",
      {
        p_name: name,
        p_phone: phone,
        p_email: email,
        p_address: address,
      }
    );

    if (rpcError || !data || data.length === 0) {
      redirect("/restaurant/onboarding?error=create-failed");
    }

    redirect("/restaurant");
  }

  const errorMessage =
    error === "invalid-name"
      ? "Please enter a restaurant name between 2 and 120 characters."
      : error === "create-failed"
        ? "We could not create your restaurant. Please try again."
        : null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8">
          <div className="mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-xl text-white">
              🍽️
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Restaurant setup
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Create your restaurant
            </h1>

            <p className="mt-3 max-w-lg text-sm leading-6 text-gray-500">
              Add your restaurant details to get started. You can configure
              tables, QR codes, menu, staff and other settings after setup.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <form action={createRestaurant} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Restaurant name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                placeholder="e.g. The Green Plate"
                maxLength={120}
                autoComplete="organization"
                required
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Restaurant phone
                </label>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  autoComplete="tel"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Restaurant email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="restaurant@example.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Restaurant address
              </label>

              <textarea
                id="address"
                name="address"
                rows={4}
                placeholder="Enter the restaurant address"
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">
                Next step
              </p>

              <p className="mt-1 text-sm leading-5 text-gray-500">
                After your restaurant is created, you can set the number of
                tables and automatically generate the corresponding QR codes.
              </p>
            </div>

            <button
              type="submit"
              className="h-12 w-full rounded-xl bg-black px-5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 active:scale-[0.99]"
            >
              CREATE RESTAURANT
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-gray-400">
            Your restaurant will be associated with your authenticated owner
            account.
          </p>
        </div>
      </div>
    </main>
  );
}