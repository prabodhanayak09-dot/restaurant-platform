import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PaymentMethod = "upi" | "card" | "cash";

type CartItem = {
  id: string;
  quantity: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionToken?: string;
      paymentMethod?: PaymentMethod;
      items?: CartItem[];
    };

    const sessionToken = body.sessionToken?.trim();
    const paymentMethod = body.paymentMethod;
    const items = body.items;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!sessionToken || !uuidRegex.test(sessionToken)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid customer session.",
        },
        { status: 400 },
      );
    }

    if (
      paymentMethod !== "upi" &&
      paymentMethod !== "card" &&
      paymentMethod !== "cash"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Please select a valid payment method.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Your cart is empty.",
        },
        { status: 400 },
      );
    }

    if (items.length > 50) {
      return NextResponse.json(
        {
          ok: false,
          message: "Too many different items in the order.",
        },
        { status: 400 },
      );
    }

    const normalizedItems: CartItem[] = [];

    for (const item of items) {
      if (
        !item ||
        typeof item.id !== "string" ||
        !uuidRegex.test(item.id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "Invalid cart item.",
          },
          { status: 400 },
        );
      }

      normalizedItems.push({
        id: item.id,
        quantity: item.quantity,
      });
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error("Missing Supabase server configuration.");

      return NextResponse.json(
        {
          ok: false,
          message: "Server configuration error.",
        },
        { status: 500 },
      );
    }

    const admin = createClient(
      supabaseUrl,
      supabaseSecretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data, error } = await admin.rpc(
      "create_customer_order",
      {
        p_session_token: sessionToken,
        p_payment_method: paymentMethod,
        p_items: normalizedItems,
      },
    );

    if (error) {
      console.error(
        "create_customer_order RPC error:",
        error,
      );

      return NextResponse.json(
        {
          ok: false,
          message: error.message,
        },
        { status: 400 },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          message: "The order could not be created.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: row.order_id,
      paymentId: row.payment_id,
      orderStatus: row.order_status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      totalPaise: Number(row.total_paise),
    });
  } catch (error) {
    console.error(
      "Customer order API error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Unable to create your order.",
      },
      { status: 500 },
    );
  }
}
