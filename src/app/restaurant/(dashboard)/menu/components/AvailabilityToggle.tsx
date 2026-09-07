"use client";

import { useTransition } from "react";
import { toggleMenuItemAvailability } from "../actions";

type AvailabilityToggleProps = {
  itemId: string;
  isAvailable: boolean;
};

export default function AvailabilityToggle({
  itemId,
  isAvailable,
}: AvailabilityToggleProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleMenuItemAvailability(itemId, !isAvailable);
      } catch (error) {
        console.error("Failed to update availability:", error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={
        isAvailable
          ? "Mark dish as unavailable"
          : "Mark dish as available"
      }
      aria-pressed={isAvailable}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        isAvailable ? "bg-emerald-500" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          isAvailable ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
