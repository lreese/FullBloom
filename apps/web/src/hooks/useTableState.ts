import { useMemo, useState, useCallback } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  filterable: boolean;
  sortable?: boolean;  // defaults to true if omitted
  defaultVisible?: boolean;
}

interface ColumnPrefs {
  order: string[];
  visible: string[];
}

export interface UseTableStateOptions<T> {
  data: T[];
  columns: ColumnDef[];
  searchableFields: string[];
  storageKey?: string;
  defaultSort?: { key: string; direction: "asc" | "desc" } | null;
}

export interface UseTableStateReturn<T> {
  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Column filters
  columnFilters: Record<string, string[]>;
  setColumnFilter: (key: string, values: string[]) => void;
  distinctValues: Record<string, string[]>;

  // Sort
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  handleSort: (key: string) => void;

  // Column prefs (only if storageKey provided)
  columnPrefs: ColumnPrefs | null;
  toggleColumn: (key: string) => void;
  reorderColumns: (fromIdx: number, toIdx: number) => void;

  // Computed
  filteredData: T[];
  activeColumns: ColumnDef[];
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
}

function loadColumnPrefs(
  storageKey: string,
  columns: ColumnDef[]
): ColumnPrefs {
  const defaultOrder = columns.map((c) => c.key);
  const defaultVisible = columns
    .filter((c) => c.defaultVisible !== false)
    .map((c) => c.key);

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Handle legacy format (plain string array = visible only)
      if (Array.isArray(parsed)) {
        return { order: defaultOrder, visible: parsed };
      }
      // Ensure all columns are represented in order (handles new columns added later)
      const order = parsed.order ?? defaultOrder;
      const allKeys = new Set(defaultOrder);
      const missing = defaultOrder.filter((k) => !order.includes(k));
      return {
        order: [...order.filter((k: string) => allKeys.has(k)), ...missing],
        visible: parsed.visible ?? defaultVisible,
      };
    }
  } catch {
    /* ignore */
  }
  return { order: defaultOrder, visible: defaultVisible };
}

function saveColumnPrefs(storageKey: string, prefs: ColumnPrefs) {
  localStorage.setItem(storageKey, JSON.stringify(prefs));
}

export function useTableState<T extends Record<string, unknown>>(
  options: UseTableStateOptions<T>
): UseTableStateReturn<T> {
  const { data, columns, searchableFields, storageKey, defaultSort = null } = options;

  const columnMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c])),
    [columns]
  );

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Column filters
  const [columnFilters, setColumnFiltersState] = useState<
    Record<string, string[]>
  >({});

  const setColumnFilter = useCallback((key: string, values: string[]) => {
    setColumnFiltersState((prev) => ({ ...prev, [key]: values }));
  }, []);

  // Sort
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(defaultSort);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  // Column prefs (localStorage-backed, only if storageKey provided)
  const [columnPrefs, setColumnPrefs] = useState<ColumnPrefs | null>(() =>
    storageKey ? loadColumnPrefs(storageKey, columns) : null
  );

  const toggleColumn = useCallback(
    (key: string) => {
      if (!storageKey) return;
      setColumnPrefs((prev) => {
        if (!prev) return prev;
        const visible = prev.visible.includes(key)
          ? prev.visible.filter((k) => k !== key)
          : [...prev.visible, key];
        const next = { ...prev, visible };
        saveColumnPrefs(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const reorderColumns = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (!storageKey) return;
      let targetIdx = toIdx;
      if (fromIdx < targetIdx) targetIdx--;
      if (fromIdx === targetIdx) return;
      setColumnPrefs((prev) => {
        if (!prev) return prev;
        const order = [...prev.order];
        const [removed] = order.splice(fromIdx, 1);
        order.splice(targetIdx, 0, removed);
        const next = { ...prev, order };
        saveColumnPrefs(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  // Distinct values for filterable columns
  const distinctValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const col of columns) {
      if (!col.filterable) continue;
      const values = new Set<string>();
      for (const item of data) {
        const val = item[col.key];
        if (val != null && val !== "") values.add(String(val));
      }
      result[col.key] = Array.from(values).sort();
    }
    return result;
  }, [data, columns]);

  // Filtered + sorted data
  const filteredData = useMemo(() => {
    let result = data;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) =>
        searchableFields.some((field) => {
          const val = item[field];
          return val != null && String(val).toLowerCase().includes(term);
        })
      );
    }

    // Column filters
    for (const [key, selected] of Object.entries(columnFilters)) {
      if (selected.length === 0) continue;
      result = result.filter((item) => {
        const val = item[key];
        return val != null && selected.includes(String(val));
      });
    }

    // Sort
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "boolean")
          return sortConfig.direction === "asc"
            ? (aVal ? 1 : -1) - ((bVal as boolean) ? 1 : -1)
            : ((bVal as boolean) ? 1 : -1) - (aVal ? 1 : -1);
        if (typeof aVal === "number")
          return sortConfig.direction === "asc"
            ? aVal - (bVal as number)
            : (bVal as number) - aVal;
        return sortConfig.direction === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return result;
  }, [data, searchTerm, searchableFields, columnFilters, sortConfig]);

  // Active columns: if column prefs exist, use ordered visible; otherwise all columns
  const activeColumns = useMemo(() => {
    if (columnPrefs) {
      return columnPrefs.order
        .filter((key) => columnPrefs.visible.includes(key))
        .map((key) => columnMap[key])
        .filter(Boolean);
    }
    return columns;
  }, [columnPrefs, columns, columnMap]);

  const hasActiveFilters =
    searchTerm.length > 0 ||
    Object.values(columnFilters).some((v) => v.length > 0);

  const clearAllFilters = useCallback(() => {
    setSearchTerm("");
    setColumnFiltersState({});
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    columnFilters,
    setColumnFilter,
    distinctValues,
    sortConfig,
    handleSort,
    columnPrefs,
    toggleColumn,
    reorderColumns,
    filteredData,
    activeColumns,
    hasActiveFilters,
    clearAllFilters,
  };
}
