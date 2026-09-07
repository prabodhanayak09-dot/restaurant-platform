"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type RestaurantNavProps = {
  restaurantName: string;
  userEmail: string;
  role: string;
};

const navigation = [
  {
    name: "Dashboard",
    href: "/restaurant",
    icon: "⌂",
  },
  {
    name: "Orders",
    href: "/restaurant/orders",
    icon: "▣",
  },
  {
    name: "Tables & QR",
    href: "/restaurant/tables",
    icon: "▤",
  },
  {
    name: "Menu",
    href: "/restaurant/menu",
    icon: "◈",
  },
  {
    name: "Staff",
    href: "/restaurant/staff",
    icon: "♙",
  },
  {
    name: "Customers",
    href: "/restaurant/customers",
    icon: "♙",
  },
  {
    name: "Payments",
    href: "/restaurant/payments",
    icon: "₹",
  },
  {
    name: "Analytics",
    href: "/restaurant/analytics",
    icon: "▥",
  },
  {
    name: "Settings",
    href: "/restaurant/settings",
    icon: "⚙",
  },
];

export default function RestaurantNav({
  restaurantName,
  userEmail,
  role,
}: RestaurantNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
      return;
    }

    window.location.href = "/restaurant/login";
  };

  const isActive = (href: string) => {
    if (href === "/restaurant") {
      return pathname === href;
    }

    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop / mobile top header */}
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-gray-200 bg-white lg:left-64">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-lg text-gray-700 lg:hidden"
            >
              ☰
            </button>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {restaurantName}
              </p>

              <p className="text-xs text-gray-500">
                Restaurant Admin
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="max-w-56 truncate text-sm font-medium text-gray-900">
                {userEmail}
              </p>

              <p className="text-xs capitalize text-gray-500">
                {role}
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
              {userEmail.charAt(0).toUpperCase() || "A"}
            </div>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-16 items-center border-b border-gray-200 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-sm font-bold text-white">
              R
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">
                Restaurant
              </p>

              <p className="text-xs text-gray-500">
                Admin Panel
              </p>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100vh-4rem)] flex-col px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm">
                  {item.icon}
                </span>

                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-gray-50 p-4">
            <p className="truncate text-sm font-semibold text-gray-900">
              {restaurantName}
            </p>

            <p className="mt-1 text-xs capitalize text-gray-500">
              {role} account
            </p>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>↪</span>
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  {restaurantName}
                </p>

                <p className="text-xs text-gray-500">
                  Restaurant Admin
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-xl text-gray-700"
              >
                ×
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium transition ${
                      isActive(item.href)
                        ? "bg-black text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg">
                      {item.icon}
                    </span>

                    <span>{item.name}</span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className="border-t border-gray-200 p-4">
              <p className="truncate text-sm font-semibold text-gray-900">
                {userEmail}
              </p>

              <p className="mt-1 text-xs capitalize text-gray-500">
                {role}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}