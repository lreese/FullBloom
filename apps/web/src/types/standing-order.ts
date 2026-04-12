// ── Standing Order Types ────────────────────────────────────

export interface StandingOrderListItem {
  id: string;
  customer_id: string;
  customer_name: string;
  status: "active" | "paused" | "cancelled";
  frequency_weeks: number;
  days_of_week: number[];
  cadence_description: string;
  lines_count: number;
  total_stems: number;
  salesperson_email: string | null;
  updated_at: string;
}

export interface StandingOrderLine {
  id: string;
  line_number: number;
  sales_item_id: string;
  sales_item_name: string;
  stems: number;
  price_per_stem: string;
  item_fee_pct: string | null;
  item_fee_dollar: string | null;
  color_variety: string | null;
  notes: string | null;
}

export interface StandingOrderDetail {
  id: string;
  customer_id: string;
  customer_name: string;
  status: "active" | "paused" | "cancelled";
  frequency_weeks: number;
  days_of_week: number[];
  days_of_week_names: string[];
  reference_date: string;
  cadence_description: string;
  ship_via: string | null;
  salesperson_email: string | null;
  box_charge: string | null;
  holiday_charge_pct: string | null;
  special_charge: string | null;
  freight_charge: string | null;
  freight_charge_included: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: StandingOrderLine[];
}

// ── Request Types ───────────────────────────────────────────

export interface StandingOrderLineRequest {
  id?: string | null;
  sales_item_id: string;
  stems: number;
  price_per_stem: number;
  item_fee_pct?: number | null;
  item_fee_dollar?: number | null;
  color_variety?: string | null;
  notes?: string | null;
}

export interface StandingOrderCreateRequest {
  customer_id: string;
  frequency_weeks: number;
  days_of_week: number[];
  reference_date: string;
  ship_via?: string | null;
  salesperson_email?: string | null;
  box_charge?: number | null;
  holiday_charge_pct?: number | null;
  special_charge?: number | null;
  freight_charge?: number | null;
  freight_charge_included?: boolean;
  notes?: string | null;
  lines: StandingOrderLineRequest[];
}

export interface StandingOrderUpdateRequest {
  frequency_weeks?: number;
  days_of_week?: number[];
  reference_date?: string;
  ship_via?: string | null;
  salesperson_email?: string | null;
  box_charge?: number | null;
  holiday_charge_pct?: number | null;
  special_charge?: number | null;
  freight_charge?: number | null;
  freight_charge_included?: boolean;
  notes?: string | null;
  reason: string;
  apply_to_future_orders?: boolean;
  lines?: StandingOrderLineRequest[];
}

export interface StatusChangeRequest {
  reason?: string | null;
}

// ── Generation Types ────────────────────────────────────────

export interface GeneratePreviewMatch {
  standing_order_id: string;
  customer_name: string;
  cadence_description: string;
  generate_date: string;
  lines_count: number;
  total_stems: number;
  already_generated: boolean;
}

export interface GeneratePreviewResponse {
  date_from: string;
  date_to: string;
  matches: GeneratePreviewMatch[];
}

export interface GenerateResponse {
  orders_created: number;
  orders_skipped: number;
  order_ids: string[];
}

// ── Audit Log ───────────────────────────────────────────────

export interface StandingOrderAuditLogEntry {
  id: string;
  action: string;
  reason: string | null;
  changes: Array<{ field: string; old_value: unknown; new_value: unknown }>;
  entered_by: string | null;
  created_at: string;
}
