import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CustomerMenu from "./CustomerMenu";

type PageProps = {
  params: Promise<{
    sessionToken: string;
  }>;
};

type CustomerMenuRow = {
  category_id: string;
  category_name: string;
  category_description: string | null;
  category_sort_order: number;
  item_id: string;
  item_category_id: string;
  item_name: string;
  item_description: string | null;
  item_price_paise: number;
  item_image_url: string | null;
  item_is_available: boolean;
  item_sort_order: number;
  item_preparation_time_minutes: number | null;
  item_stock_quantity: number | null;
};

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

export default async function MenuPage({ params }: PageProps) {
  const { sessionToken } = await params;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sessionToken
    );

  if (!isUuid) {
    notFound();
  }

  const supabase = await createClient();

  // Resolve customer session
  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.rpc("resolve_customer_session", {
    p_session_token: sessionToken,
  });

  if (
    sessionError ||
    !sessionData ||
    sessionData.length === 0
  ) {
    notFound();
  }

  const session = sessionData[0];

  // Load menu through secure customer RPC
  const {
    data: menuData,
    error: menuError,
  } = await supabase.rpc("get_customer_menu", {
    p_session_token: sessionToken,
  });

  if (menuError) {
    console.error("Customer menu RPC error:", menuError);
    throw new Error("Unable to load restaurant menu.");
  }

  const rows = (menuData ?? []) as CustomerMenuRow[];

  // Convert RPC rows into categories
  const categoryMap = new Map<string, MenuCategory>();

  for (const row of rows) {
    if (!categoryMap.has(row.category_id)) {
      categoryMap.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        description: row.category_description,
        sort_order: row.category_sort_order,
        items: [],
      });
    }

    categoryMap.get(row.category_id)?.items.push({
      id: row.item_id,
      category_id: row.item_category_id,
      name: row.item_name,
      description: row.item_description,
      price_paise: Number(row.item_price_paise),
      image_url: row.item_image_url,
      is_available: row.item_is_available,
      sort_order: row.item_sort_order,
      preparation_time_minutes:
        row.item_preparation_time_minutes,
      stock_quantity: row.item_stock_quantity,
    });
  }

  const categoriesWithItems = Array.from(
    categoryMap.values()
  )
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }

      return a.name.localeCompare(b.name);
    })
    .map((category) => ({
      ...category,
      items: category.items.sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    }));

  return (
    <CustomerMenu
      restaurantName={session.restaurant_name}
      tableNumber={session.table_number}
      customerFirstName={session.customer_first_name}
      categories={categoriesWithItems}
    />
  );
}
