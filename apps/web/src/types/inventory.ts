// ── Inventory Management Types ──────────────────────────────
// Matches API contract: specs/005-inventory-management/contracts/api-v1.md

// ── Daily Counts ────────────────────────────────────────────

export interface DailyCountVariety {
  variety_id: string;
  variety_name: string;
  count_value: number | null;
  is_done: boolean;
  entered_by: string | null;
  updated_at: string | null;
}

export interface DailyCountProductLine {
  product_line_id: string;
  product_line_name: string;
  varieties: DailyCountVariety[];
}

export interface DailyCountResponse {
  count_date: string;
  product_type_id: string;
  product_type_name: string;
  sheet_complete: boolean;
  completed_by: string | null;
  completed_at: string | null;
  product_lines: DailyCountProductLine[];
}

export interface CountEntry {
  variety_id: string;
  count_value: number | null;
  is_done: boolean;
}

export interface CountSaveRequest {
  product_type_id: string;
  count_date: string;
  entered_by: string;
  counts: CountEntry[];
}

export interface CountSaveResponse {
  saved_count: number;
}

export interface RecentCount {
  count_date: string;
  count_value: number | null;
}

// ── Customer Counts ─────────────────────────────────────────

export interface TemplateColumn {
  customer_id: string;
  customer_name: string;
  bunch_size: number;
  sleeve_type: string;
}

export interface CustomerCountVariety {
  variety_id: string;
  variety_name: string;
  is_done: boolean;
  counts: Record<string, number | null>;
}

export interface CustomerCountTotals {
  [key: string]: number;
}

export interface CustomerCountGrandTotals extends CustomerCountTotals {
  total_customer_bunched: number;
  total_remaining: number;
  total_all_bunched: number;
}

export interface CustomerCountProductLine {
  product_line_id: string;
  product_line_name: string;
  varieties: CustomerCountVariety[];
  totals: CustomerCountTotals;
}

export interface CustomerCountResponse {
  count_date: string;
  product_type_id: string;
  product_type_name: string;
  sheet_complete: boolean;
  template_columns: TemplateColumn[];
  product_lines: CustomerCountProductLine[];
  grand_totals: CustomerCountGrandTotals;
}

export interface CustomerCountEntry {
  variety_id: string;
  customer_id: string;
  bunch_size: number;
  sleeve_type: string;
  bunch_count: number | null;
  is_done: boolean;
}

export interface CustomerCountSaveRequest {
  product_type_id: string;
  count_date: string;
  entered_by: string;
  counts: CustomerCountEntry[];
}

// ── Estimates ───────────────────────────────────────────────

export interface EstimateVariety {
  variety_id: string;
  variety_name: string;
  estimates: Record<string, number | null>;
  is_done: boolean;
}

export interface EstimateProductLine {
  product_line_id: string;
  product_line_name: string;
  varieties: EstimateVariety[];
}

export interface EstimateResponse {
  week_start: string;
  product_type_id: string;
  product_type_name: string;
  sheet_complete: boolean;
  pull_days: string[];
  last_week_actuals: Record<string, Record<string, number>>;
  product_lines: EstimateProductLine[];
}

export interface EstimateEntry {
  variety_id: string;
  pull_day: string;
  estimate_value: number | null;
  is_done: boolean;
}

export interface EstimateSaveRequest {
  product_type_id: string;
  week_start: string;
  entered_by: string;
  estimates: EstimateEntry[];
}

// ── Comparison ──────────────────────────────────────────────

export interface ComparisonDay {
  estimate: number | null;
  actual: number | null;
  variance: number | null;
}

export interface ComparisonVariety {
  variety_name: string;
  days: Record<string, ComparisonDay>;
}

export interface ComparisonProductLine {
  product_line_name: string;
  varieties: ComparisonVariety[];
}

export interface ComparisonSummary {
  total_estimated: number;
  total_actual: number;
  variance_pct: number | null;
}

export interface ComparisonResponse {
  week_start: string;
  pull_days: string[];
  product_lines: ComparisonProductLine[];
  summary: ComparisonSummary;
}

// ── Availability ────────────────────────────────────────────

export interface AvailabilityVariety {
  variety_name: string;
  color_hex: string | null;
  remaining_count: number | null;
  estimate: number | null;
}

export interface AvailabilityProductLine {
  product_line_name: string;
  varieties: AvailabilityVariety[];
}

export interface AvailabilityProductType {
  product_type_id: string;
  product_type_name: string;
  data_source: "actual_counts" | "estimates_only";
  counts_completed_at: string | null;
  counts_completed_by: string | null;
  product_lines: AvailabilityProductLine[];
}

export interface AvailabilityResponse {
  date: string;
  product_types: AvailabilityProductType[];
}

// ── Sheet Completion ────────────────────────────────────────

export type SheetType = "daily_count" | "customer_count" | "estimate";

export interface SheetCompleteRequest {
  product_type_id: string;
  sheet_type: SheetType;
  sheet_date: string;
  completed_by: string;
}

export interface SheetCompleteResponse {
  is_complete: boolean;
  completed_by: string;
  completed_at: string;
}

export interface SheetUncompleteResponse {
  is_complete: boolean;
}

// ── Harvest Status ──────────────────────────────────────────

export interface HarvestStatusEntry {
  variety_id: string;
  variety_name: string;
  product_line_name: string;
  in_harvest: boolean;
  stems_per_bunch: number;
}

export interface HarvestStatusUpdate {
  variety_id: string;
  in_harvest: boolean;
}

export interface HarvestStatusUpdateRequest {
  updates: HarvestStatusUpdate[];
}

export interface HarvestStatusUpdateResponse {
  updated_count: number;
}

// ── Count Sheet Templates ───────────────────────────────────

export interface CountSheetTemplateResponse {
  product_type_id: string;
  columns: TemplateColumn[];
}

export interface TemplateColumnInput {
  customer_id: string;
  bunch_size: number;
  sleeve_type: string;
}

export interface CountSheetTemplateSaveRequest {
  columns: TemplateColumnInput[];
}

// ── Pull Day Schedule ───────────────────────────────────────

export interface PullDayScheduleResponse {
  week_start: string;
  pull_days: number[];
  pull_dates: string[];
  is_default: boolean;
}

export interface PullDayScheduleSaveRequest {
  week_start: string | null;
  pull_days: number[];
}

// ── Count Audit ─────────────────────────────────────────────

export interface CountAuditEntry {
  id: string;
  variety_id: string;
  variety_name: string;
  action: "set" | "add" | "remove";
  amount: number;
  resulting_total: number;
  entered_by: string;
  created_at: string;
}
