// ── API envelope ──────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

// ── Customers ────────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  customer_id: number;
  name: string;
  price_type: string;
  is_active: boolean;
  stores?: Store[];
}

// ── Products ─────────────────────────────────────────────────

export interface SalesItem {
  id: string;
  name: string;
  stems_per_order: number;
  retail_price: string;
}

export interface Variety {
  id: string;
  type: string;
  product_line: string;
  name: string;
  color: string | null;
  hex_color: string | null;
  flowering_type: string | null;
  show: boolean;
  sales_items: SalesItem[];
}

// ── Pricing ──────────────────────────────────────────────────

export interface CustomerPricing {
  sales_item_id: string;
  sales_item_name: string;
  stems_per_order: number;
  customer_price: string;
  retail_price: string;
  is_custom: boolean;
}

// ── Orders ───────────────────────────────────────────────────

export interface OrderLineCreateRequest {
  sales_item_id: string;
  stems: number;
  price_per_stem: number;
  assorted?: boolean;
  color_variety?: string | null;
  item_fee_pct?: number | null;
  item_fee_dollar?: number | null;
  notes?: string | null;
  box_quantity?: number | null;
  bunches_per_box?: number | null;
  stems_per_bunch?: number | null;
  box_reference?: string | null;
  is_special?: boolean;
  sleeve?: string | null;
  upc?: string | null;
}

export interface OrderCreateRequest {
  customer_id: string;
  order_date: string;
  ship_via?: string | null;
  order_label?: string | null;
  freight_charge_included?: boolean;
  box_charge?: number | null;
  holiday_charge_pct?: number | null;
  special_charge?: number | null;
  freight_charge?: number | null;
  order_notes?: string | null;
  po_number?: string | null;
  salesperson_email?: string | null;
  force_duplicate: boolean;
  lines: OrderLineCreateRequest[];
}

export interface OrderCreateResponse {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  lines_count: number;
  created_at: string;
}

export interface OrderLineResponse {
  id: string;
  line_number: number;
  sales_item: { id: string; name: string };
  assorted: boolean;
  color_variety: string | null;
  stems: number;
  list_price_per_stem: string;
  price_per_stem: string;
  item_fee_pct: string | null;
  item_fee_dollar: string | null;
  effective_price_per_stem: string;
  notes: string | null;
  box_quantity: number | null;
  bunches_per_box: number | null;
  stems_per_bunch: number | null;
  box_reference: string | null;
  is_special: boolean;
  sleeve: string | null;
  upc: string | null;
}

export interface OrderDetailResponse {
  id: string;
  order_number: string;
  customer: { id: string; customer_id: number; name: string };
  order_date: string;
  ship_via: string | null;
  price_type: string;
  store_name: string | null;
  freight_charge_included: boolean;
  box_charge: string | null;
  holiday_charge_pct: string | null;
  special_charge: string | null;
  freight_charge: string | null;
  order_notes: string | null;
  po_number: string | null;
  salesperson_email: string | null;
  created_at: string;
  lines: OrderLineResponse[];
}

// ── Import ───────────────────────────────────────────────────

export interface ImportVarietiesResult {
  types_created: number;
  types_updated: number;
  lines_created: number;
  lines_updated: number;
  varieties_created: number;
  varieties_updated: number;
}

export interface ImportPricingResult {
  customers_created: number;
  customers_updated: number;
  prices_created: number;
  prices_updated: number;
  sales_items_created: number;
  sales_items_updated: number;
}

export interface ImportColorsResult {
  varieties_updated: number;
  varieties_not_found: number;
}
