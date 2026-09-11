import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

function redirectWithError(code: string): never {
  redirect(`/staff/join?error=${encodeURIComponent(code)}`);
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const token = String(formData.get("token") ?? "").trim();

  const name = String(formData.get("name") ?? "").trim();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const phone = String(formData.get("phone") ?? "").trim();

  const password = String(formData.get("password") ?? "");

  const confirmPassword = String(
    formData.get("confirm_password") ?? ""
  );

  if (!token || !isValidUuid(token)) {
    redirectWithError("invalid-invitation");
  }

  if (name.length < 2 || name.length > 100) {
    redirectWithError("invalid-name");
  }

  if (!isValidEmail(email) || email.length > 254) {
    redirectWithError("invalid-email");
  }

  if (!isValidPhone(phone) || phone.length > 20) {
    redirectWithError("invalid-phone");
  }

  if (password.length < 8 || password.length > 72) {
    redirectWithError("weak-password");
  }

  if (password !== confirmPassword) {
    redirectWithError("password-mismatch");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error("Missing Supabase server credentials.");
    redirectWithError("system");
  }

  const admin = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data: invitationRows,
    error: invitationError,
  } = await admin.rpc("get_staff_invitation", {
    p_token: token,
  });

  if (invitationError) {
    console.error(
      "Staff invitation validation error:",
      invitationError
    );

    redirectWithError("invalid-invitation");
  }

  const invitation = Array.isArray(invitationRows)
    ? invitationRows[0]
    : invitationRows;

  if (
    !invitation ||
    !invitation.restaurant_id ||
    !invitation.token
  ) {
    redirectWithError("invalid-invitation");
  }

  const {
    data: restaurant,
    error: restaurantError,
  } = await admin
    .from("restaurants")
    .select("id, name, is_active")
    .eq("id", invitation.restaurant_id)
    .maybeSingle();

  if (
    restaurantError ||
    !restaurant ||
    !restaurant.is_active
  ) {
    console.error(
      "Staff restaurant lookup error:",
      restaurantError
    );

    redirectWithError("restaurant-unavailable");
  }

  const {
    data: createdUserData,
    error: createUserError,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      phone,
      account_type: "staff",
    },
  });

  if (createUserError) {
    console.error(
      "Staff auth account creation error:",
      createUserError
    );

    const message =
      createUserError.message?.toLowerCase() ?? "";

    if (
      message.includes("already") ||
      message.includes("exists")
    ) {
      redirectWithError("account-exists");
    }

    redirectWithError("account-create-failed");
  }

  const authUser = createdUserData.user;

  if (!authUser) {
    console.error(
      "Supabase returned no user after staff account creation."
    );

    redirectWithError("account-create-failed");
  }

  const { error: membershipError } = await admin
    .from("restaurant_members")
    .insert({
      restaurant_id: invitation.restaurant_id,
      user_id: authUser.id,
      role: "staff",
      is_active: true,
    });

  if (membershipError) {
    console.error(
      "Staff membership creation error:",
      membershipError
    );

    const { error: cleanupError } =
      await admin.auth.admin.deleteUser(authUser.id);

    if (cleanupError) {
      console.error(
        "Staff Auth cleanup error:",
        cleanupError
      );
    }

    if (
      membershipError.code === "23505" ||
      membershipError.message
        ?.toLowerCase()
        .includes("duplicate")
    ) {
      redirectWithError("already-staff");
    }

    redirectWithError("membership-create-failed");
  }

  // The invitation is intentionally NOT consumed.
  // The same QR remains valid for multiple staff registrations
  // until its 24-hour expiration.

  redirect(
    `/restaurant/login?registered=1&restaurant=${encodeURIComponent(
      restaurant.name
    )}`
  );
}
