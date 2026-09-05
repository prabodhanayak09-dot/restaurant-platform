"use client";

import { useState } from "react";

export default function CustomerWelcomePage() {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");

  const handleContinue = () => {
    if (!firstName.trim()) {
      alert("Please enter your first name.");
      return;
    }

    if (!phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    alert(`Welcome, ${firstName.trim()}!`);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl text-white">
              🍽️
            </div>

            <p className="mb-2 text-sm font-medium text-gray-500">
              TABLE 12
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              ABC Restaurant
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Welcome! Let&apos;s get your order started.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label
                htmlFor="firstName"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                First name
              </label>

              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Enter your first name"
                maxLength={50}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Phone number
              </label>

              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 XXXXX XXXXX"
                maxLength={20}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200"
              />

              <p className="mt-2 text-xs leading-5 text-gray-500">
                Your phone number is used to identify your orders and provide
                order-related services.
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs leading-5 text-gray-500">
                Your name is used to identify your order and help the restaurant
                provide a better experience.
              </p>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-xl bg-black px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.99]"
            >
              CONTINUE →
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            No account or password required.
          </p>
        </div>
      </div>
    </main>
  );
}