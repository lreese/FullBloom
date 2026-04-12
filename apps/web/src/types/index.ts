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
  customer_number: number;
  name: string;
  salesperson: string | null;
  contact_name: string | null;
  default_ship_via: string | null;
  phone: string | null;
  location: string | null;
  payment_terms: string | null;
  email: string | null;
  notes: string | null;
  price_list_id: string | null;
  price_list_name: string | null;
  is_active: boolean;
  stores?: Store[];
}

export interface CustomerCreateRequest {
  customer_number: number;
  name: string;
  salesperson?: string | null;
  price_list_id?: string | null;
  contact_name?: string | null;
  default_ship_via?: string | null;
  phone?: string | null;
  location?: string | null;
  payment_terms?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface CustomerUpdateRequest {
  name?: string;
  salesperson?: string | null;
  price_list_id?: string | null;
  contact_name?: string | null;
  default_ship_via?: string | null;
  phone?: string | null;
  location?: string | null;
  payment_terms?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface DropdownOptions {
  salesperson: string[];
  default_ship_via: string[];
  payment_terms: string[];
}

// ── Products ─────────────────────────────────────────────────

export interface SalesItem {
  id: string;
  name: string;
  variety_id: string | null;
  variety_name: string | null;
  stems_per_order: number;
  retail_price: string;
  is_active: boolean;
  customer_prices_count: number;
}

export interface SalesItemCreateRequest {
  name: string;
  stems_per_order: number;
  retail_price: string;
}

export interface Variety {
  id: string;
  name: string;
  product_line_id: string;
  product_line_name: string;
  product_type_name: string;
  color_id: string | null;
  color_name: string | null;
  hex_color: string | null;
  flowering_type: string | null;
  can_replace: boolean;
  show: boolean;
  is_active: boolean;
  weekly_sales_category: string | null;
  item_group_id: number | null;
  item_group_description: string | null;
  sales_items_count?: number;
  sales_items?: SalesItem[];
}

export interface VarietyCreateRequest {
  name: string;
  product_line_id: string;
  color_id?: string | null;
  flowering_type?: string | null;
  can_replace?: boolean;
  show?: boolean;
  weekly_sales_category?: string | null;
  item_group_id?: number | null;
  item_group_description?: string | null;
}

export interface VarietyUpdateRequest {
  name?: string;
  product_line_id?: string;
  color_id?: string | null;
  flowering_type?: string | null;
  can_replace?: boolean;
  show?: boolean;
  weekly_sales_category?: string | null;
  item_group_id?: number | null;
  item_group_description?: string | null;
}

export interface BulkUpdateRequest {
  ids: string[];
  field: string;
  value: string | boolean;
}

export interface VarietyDropdownOptions {
  product_lines: { id: string; name: string; product_type: string }[];
  colors: { id: string; name: string; hex_color: string | null }[];
  flowering_types: string[];
  weekly_sales_categories: string[];
}

export interface ProductType {
  id: string;
  name: string;
  is_active: boolean;
  product_line_count: number;
}

export interface ProductTypeCreateRequest {
  name: string;
}

export interface ProductLine {
  id: string;
  name: string;
  product_type_id: string;
  product_type_name: string;
  is_active: boolean;
  variety_count: number;
}

export interface ProductLineCreateRequest {
  name: string;
  product_type_id: string;
}

export interface Color {
  id: string;
  name: string;
  hex_color: string | null;
  is_active: boolean;
  variety_count: number;
}

export interface ColorCreateRequest {
  name: string;
  hex_color?: string | null;
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

export interface PriceList {
  id: string;
  name: string;
  is_active: boolean;
  customer_count: number;
}

export interface PriceListItem {
  price_list_id: string;
  sales_item_id: string;
  price: string;
}

export interface PriceListMatrixRow {
  sales_item_id: string;
  sales_item_name: string;
  variety_name: string;
  stems_per_order: number;
  retail_price: string;
  prices: Record<string, string>;
}

export interface PriceListMatrixData {
  price_lists: PriceList[];
  items: PriceListMatrixRow[];
}

export interface CustomerPricingItem {
  sales_item_id: string;
  sales_item_name: string;
  variety_name: string;
  stems_per_order: number;
  retail_price: string;
  price_list_price: string;
  customer_override: string | null;
  effective_price: string;
  source: "override" | "price_list" | "retail";
  anomaly: boolean;
}

export interface ItemPricingCustomer {
  customer_id: string;
  customer_name: string;
  price_list_name: string;
  price_list_price: string;
  customer_override: string | null;
  effective_price: string;
  source: "override" | "price_list" | "retail";
  anomaly: boolean;
}

export interface PricingSummary {
  total_items: number;
  override_count: number;
  override_percentage: number;
}

export interface CustomerPricingData {
  customer: {
    id: string;
    name: string;
    price_list_id: string | null;
    price_list_name: string;
  };
  items: CustomerPricingItem[];
  summary: PricingSummary;
}

export interface ItemPricingData {
  sales_item: {
    id: string;
    name: string;
    retail_price: string;
  };
  customers: ItemPricingCustomer[];
}

export interface CustomerPriceCreateRequest {
  sales_item_id: string;
  price: string;
}

export interface BulkCustomerPriceRequest {
  action: "set_price" | "remove_overrides" | "reset_to_list";
  sales_item_ids: string[];
  price?: string;
}

export interface BulkPriceListItemRequest {
  price_list_id: string;
  sales_item_ids: string[];
  price: string;
}

export interface ImpactPreview {
  customers_on_list: number;
  customers_with_overrides: number;
  customers_affected: number;
  current_price: string;
  new_price: string;
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
  customer: { id: string; customer_number: number; name: string };
  order_date: string;
  ship_via: string | null;
  price_list: string;
  freight_charge_included: boolean;
  box_charge: string | null;
  holiday_charge_pct: string | null;
  special_charge: string | null;
  freight_charge: string | null;
  order_notes: string | null;
  po_number: string | null;
  salesperson_email: string | null;
  order_label: string | null;
  created_at: string;
  updated_at: string;
  lines: OrderLineResponse[];
}

// ── Order Update ────────────────────────────────────────────

export interface OrderLineUpdateRequest {
  id: string | null;
  sales_item_id: string;
  assorted: boolean;
  color_variety: string | null;
  stems: number;
  price_per_stem: number;
  item_fee_pct: number | null;
  item_fee_dollar: number | null;
  notes: string | null;
  box_quantity: number | null;
  bunches_per_box: number | null;
  stems_per_bunch: number | null;
  box_reference: string | null;
  is_special: boolean;
  sleeve: string | null;
  upc: string | null;
}

export interface OrderUpdateRequest {
  order_date?: string;
  ship_via?: string;
  order_label?: string;
  freight_charge_included?: boolean;
  box_charge?: number | null;
  holiday_charge_pct?: number | null;
  special_charge?: number | null;
  freight_charge?: number | null;
  order_notes?: string;
  po_number?: string;
  salesperson_email?: string;
  lines?: OrderLineUpdateRequest[];
}

// ── Order List ──────────────────────────────────────────────

export interface OrderListItem {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  order_date: string;
  ship_via: string | null;
  lines_count: number;
  total_stems: number;
  salesperson_email: string | null;
  standing_order_id: string | null;
  po_number: string | null;
  created_at: string;
}

export interface OrderListResponse {
  items: OrderListItem[];
  total: number;
  offset: number;
  limit: number;
}

export interface OrderAuditLogEntry {
  id: string;
  action: string;
  changes: Array<{field: string; old_value: unknown; new_value: unknown; line_id?: string}>;
  entered_by: string | null;
  created_at: string;
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
