"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createCustomerSession(
  token: string,
  formData: FormData
) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "");

  if (firstName.length < 1 || firstName.length > 50) {
    throw new Error("Please enter a valid first name.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_customer_session", {
    p_qr_token: token,
    p_first_name: firstName,
    p_phone: phone,
  });

  if (error) {
    console.error("Customer session RPC error:", error);
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("Unable to create customer session.");
  }

  const session = data[0];

  redirect(`/menu/${session.session_token}`);
}