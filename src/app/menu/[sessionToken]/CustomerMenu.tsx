"use client";

import Image from "next/image";
import { useState } from "react";

type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_paise: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  preparation_time_minutes: number | null;
  stock_quantity: number | null;
};

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  items: MenuItem[];
};

type CustomerMenuProps = {
  restaurantName: string;
  tableNumber: number;
  customerFirstName: string;
  sessionToken: string;
  categories: MenuCategory[];
};

type CartItem = MenuItem & {
  quantity: number;
};

type PaymentMethod = "upi" | "card" | "cash";

export default function CustomerMenu({
  restaurantName,
  tableNumber,
  customerFirstName,
  sessionToken,
  categories,
}: CustomerMenuProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  const formatPrice = (paise: number) =>
    `₹${(paise / 100).toFixed(2)}`;

  const addToCart = (item: MenuItem) => {
    setCart((current) => {
      const existing = current.find(
        (cartItem) => cartItem.id === item.id,
      );

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem,
        );
      }

      return [...current, { ...item, quantity: 1 }];
    });
  };

  const decreaseQuantity = (itemId: string) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === itemId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const increaseQuantity = (itemId: string) => {
    setCart((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item,
      ),
    );
  };

  const totalItems = cart.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const totalPrice = cart.reduce(
    (total, item) =>
      total + item.price_paise * item.quantity,
    0,
  );

  const openCheckout = () => {
    if (cart.length === 0) {
      return;
    }

    setError("");
    setPaymentMethod(null);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const placeOrder = async () => {
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setPlacingOrder(true);
    setError("");

    try {
      const response = await fetch("/api/customer/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionToken,
          paymentMethod,
          items: cart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        orderId?: string;
        paymentId?: string;
        orderStatus?: string;
        paymentStatus?: string;
        paymentMethod?: PaymentMethod;
        totalPaise?: number;
        message?: string;
      };

      if (!response.ok || !result.ok || !result.orderId) {
        throw new Error(
          result.message ?? "Unable to place your order.",
        );
      }

      setCart([]);
      setCheckoutOpen(false);

      if (paymentMethod === "cash") {
        window.location.href =
          `/order/${result.orderId}?created=1`;
        return;
      }

      window.location.href =
        `/order/${result.orderId}/payment`;
    } catch (orderError) {
      setError(
        orderError instanceof Error
          ? orderError.message
          : "Unable to place your order.",
      );
      setPlacingOrder(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-28 sm:px-6">
        <header className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Table {tableNumber}
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
                {restaurantName}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Welcome, {customerFirstName}. Choose your
                items below.
              </p>
            </div>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-xl text-white">
              🍽️
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id}>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {category.name}
                </h2>

                {category.description && (
                  <p className="mt-1 text-sm text-gray-500">
                    {category.description}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {category.items.map((item) => {
                  const soldOut =
                    item.stock_quantity !== null &&
                    item.stock_quantity <= 0;

                  const cartItem = cart.find(
                    (cartEntry) => cartEntry.id === item.id,
                  );

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
                    >
                      <div className="flex gap-4 p-4">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={96}
                            height={96}
                            unoptimized
                            className="h-24 w-24 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                            🍴
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-gray-900">
                              {item.name}
                            </h3>

                            <p className="shrink-0 font-semibold text-gray-900">
                              {formatPrice(item.price_paise)}
                            </p>
                          </div>

                          {item.description && (
                            <p className="mt-1 text-sm leading-5 text-gray-500">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-gray-400">
                              {item.preparation_time_minutes
                                ? `${item.preparation_time_minutes} min`
                                : "Preparation time varies"}
                            </div>

                            {soldOut ? (
                              <button
                                type="button"
                                disabled
                                className="rounded-xl bg-gray-300 px-4 py-2 text-sm font-semibold text-white"
                              >
                                SOLD OUT
                              </button>
                            ) : cartItem ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    decreaseQuantity(item.id)
                                  }
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-900"
                                >
                                  −
                                </button>

                                <span className="w-6 text-center font-semibold">
                                  {cartItem.quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    increaseQuantity(item.id)
                                  }
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-black font-bold text-white"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(item)}
                                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                              >
                                + ADD
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {categories.length === 0 && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
                🍽️
              </div>

              <p className="mt-5 font-medium text-gray-900">
                Menu unavailable
              </p>

              <p className="mt-2 text-sm text-gray-500">
                This restaurant has no available menu items
                right now.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="w-full rounded-2xl bg-black px-5 py-4 text-sm font-bold text-white"
          >
            🛒 VIEW CART
            {totalItems > 0 &&
              ` • ${totalItems} item${
                totalItems === 1 ? "" : "s"
              } • ${formatPrice(totalPrice)}`}
          </button>
        </div>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">
                  Your Cart
                </h2>

                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="rounded-full bg-gray-100 px-4 py-2"
                >
                  ✕
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-5xl">🛒</div>

                  <p className="mt-4 font-semibold text-gray-900">
                    Your cart is empty
                  </p>

                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="mt-6 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  >
                    BACK TO MENU
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-6 space-y-3">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 p-4"
                      >
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900">
                            {item.name}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            {formatPrice(item.price_paise)} each
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              decreaseQuantity(item.id)
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 font-bold"
                          >
                            −
                          </button>

                          <span className="w-5 text-center font-semibold">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              increaseQuantity(item.id)
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-black font-bold text-white"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t pt-5">
                    <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                      <span>Total</span>
                      <span>{formatPrice(totalPrice)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={openCheckout}
                      className="mt-5 w-full rounded-2xl bg-black px-5 py-4 font-bold text-white"
                    >
                      CONTINUE TO CHECKOUT
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <div className="absolute bottom-0 left-0 right-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Checkout
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-gray-900">
                    Choose payment method
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  className="rounded-full bg-gray-100 px-4 py-2"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <PaymentOption
                  selected={paymentMethod === "upi"}
                  onClick={() => {
                    setError("");
                    setPaymentMethod("upi");
                  }}
                  icon="📱"
                  title="UPI"
                  description="Pay online using your UPI app."
                />

                <PaymentOption
                  selected={paymentMethod === "card"}
                  onClick={() => {
                    setError("");
                    setPaymentMethod("card");
                  }}
                  icon="💳"
                  title="Card"
                  description="Pay online using debit or credit card."
                />

                <PaymentOption
                  selected={paymentMethod === "cash"}
                  onClick={() => {
                    setError("");
                    setPaymentMethod("cash");
                  }}
                  icon="💵"
                  title="Cash"
                  description="Pay the restaurant staff after your meal."
                />
              </div>

              {paymentMethod === "cash" && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Cash payment
                  </p>

                  <p className="mt-1 text-sm leading-5 text-gray-600">
                    Place your order now. A staff member will
                    confirm the order, your food will be prepared
                    and served, and you can pay the staff in cash
                    after eating.
                  </p>
                </div>
              )}

              {(paymentMethod === "upi" ||
                paymentMethod === "card") && (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Online payment
                  </p>

                  <p className="mt-1 text-sm leading-5 text-gray-600">
                    Your order will be created securely and you
                    will continue to the online payment step.
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">
                    {error}
                  </p>
                </div>
              )}

              <div className="mt-6 border-t pt-5">
                <div className="flex items-center justify-between text-lg font-bold text-gray-900">
                  <span>Order total</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>

                <button
                  type="button"
                  onClick={placeOrder}
                  disabled={!paymentMethod || placingOrder}
                  className="mt-5 w-full rounded-2xl bg-black px-5 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {placingOrder
                    ? "PLACING ORDER..."
                    : paymentMethod === "cash"
                      ? "CONFIRM CASH ORDER"
                      : "CONTINUE TO PAYMENT"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PaymentOption({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-black bg-gray-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xl">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900">
          {title}
        </span>

        <span className="mt-1 block text-sm text-gray-500">
          {description}
        </span>
      </span>

      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? "border-black bg-black"
            : "border-gray-300"
        }`}
      >
        {selected && (
          <span className="h-2 w-2 rounded-full bg-white" />
        )}
      </span>
    </button>
  );
}
