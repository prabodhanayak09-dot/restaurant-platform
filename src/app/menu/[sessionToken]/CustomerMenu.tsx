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
  categories: MenuCategory[];
};

type CartItem = MenuItem & {
  quantity: number;
};

export default function CustomerMenu({
  restaurantName,
  tableNumber,
  customerFirstName,
  categories,
}: CustomerMenuProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const formatPrice = (paise: number) =>
    `₹${(paise / 100).toFixed(2)}`;

  const addToCart = (item: MenuItem) => {
    setCart((current) => {
      const existing = current.find(
        (cartItem) => cartItem.id === item.id
      );

      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
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
            : item
        )
        .filter((item) => item.quantity > 0)
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
          : item
      )
    );
  };

  const totalItems = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const totalPrice = cart.reduce(
    (total, item) =>
      total + item.price_paise * item.quantity,
    0
  );

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
                    (cartItem) => cartItem.id === item.id
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
              ` • ${totalItems} item${totalItems === 1 ? "" : "s"}`}
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

                  <p className="mt-2 text-sm text-gray-500">
                    Add some delicious items from the menu.
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

                      <span>
                        {formatPrice(totalPrice)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="mt-5 w-full rounded-2xl bg-black px-5 py-4 font-bold text-white"
                    >
                      PLACE ORDER
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
