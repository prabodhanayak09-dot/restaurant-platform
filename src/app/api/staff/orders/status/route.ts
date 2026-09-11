import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const allowedStatuses = new Set([
  "preparing",
  "ready",
  "served",
]);

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
  const newStatus = String(formData.get("new_status") ?? "").trim();

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(orderId) || !allowedStatuses.has(newStatus)) {
    return NextResponse.redirect(
      new URL("/staff?error=invalid_request", request.url),
    );
  }

  const { data, error } = await supabase.rpc(
    "staff_update_order_status",
    {
      p_order_id: orderId,
      p_new_status: newStatus,
    },
  );

  if (error) {
    console.error("Staff order status error:", error);

    return NextResponse.redirect(
      new URL(
        `/staff?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  if (!data) {
    return NextResponse.redirect(
      new URL("/staff?error=order_update_failed", request.url),
    );
  }

  return NextResponse.redirect(
    new URL("/staff?updated=1", request.url),
  );
}
