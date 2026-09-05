"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function createCustomerSession(
  token: string,
  formData: FormData
) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  if (firstName.length < 1 || firstName.length > 50) {
    throw new Error("Please enter a valid first name.");
  }

  if (phone.length < 7 || phone.length > 15) {
    throw new Error("Please enter a valid phone number.");
  }

  const supabase = await createClient();

  const { data: qrData, error: qrError } = await supabase.rpc(
    "resolve_table_qr",
    {
      p_qr_token: token,
    }
  );

  if (qrError || !qrData || qrData.length === 0) {
    throw new Error("This QR code is invalid or inactive.");
  }

  const table = qrData[0];

  const { data: existingCustomer, error: customerLookupError } =
    await supabase
      .from("customers")
      .select("id")
      .eq("restaurant_id", table.restaurant_id)
      .eq("phone", phone)
      .maybeSingle();

  if (customerLookupError) {
    throw new Error("Unable to find customer.");
  }

  let customerId = existingCustomer?.id;

  if (!customerId) {
    const { data: newCustomer, error: createCustomerError } =
      await supabase
        .from("customers")
        .insert({
          restaurant_id: table.restaurant_id,
          first_name: firstName,
          phone,
        })
        .select("id")
        .single();

    if (createCustomerError || !newCustomer) {
      throw new Error("Unable to create customer.");
    }

    customerId = newCustomer.id;
  }

  const now = new Date();

  const expiresAt = new Date(
    now.getTime() + 2 * 60 * 60 * 1000
  ).toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("customer_sessions")
    .insert({
      restaurant_id: table.restaurant_id,
      table_id: table.table_id,
      customer_id: customerId,
      expires_at: expiresAt,
      last_activity_at: now.toISOString(),
    })
    .select("session_token")
    .single();

  if (sessionError || !session) {
    throw new Error("Unable to create customer session.");
  }

  redirect(`/menu/${session.session_token}`);
}