import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/restaurant/login?error=unauthorized", request.url),
    );
  }

  const formData = await request.formData();

  const orderId = String(formData.get("order_id") ?? "").trim();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(orderId)) {
    return NextResponse.redirect(
      new URL("/staff?error=invalid_request", request.url),
    );
  }

  const { data, error } = await supabase.rpc(
    "staff_confirm_cash_payment",
    {
      p_order_id: orderId,
    },
  );

  if (error) {
    console.error("Cash payment confirmation error:", error);

    return NextResponse.redirect(
      new URL(
        `/staff?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  if (!data) {
    return NextResponse.redirect(
      new URL("/staff?error=cash_payment_failed", request.url),
    );
  }

  return NextResponse.redirect(
    new URL("/staff?cash_paid=1", request.url),
  );
}
