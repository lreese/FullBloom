import type { SheetType } from "@/types/inventory";

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

/**
 * Fetches print-optimized HTML from the backend and opens it in a new browser tab,
 * then triggers the browser print dialog.
 */
export async function openPrintSheet(params: {
  productTypeId: string;
  sheetType: SheetType;
  date: string;
}): Promise<void> {
  const { productTypeId, sheetType, date } = params;

  const url =
    `${BASE_URL}/api/v1/print/count-sheet` +
    `?product_type_id=${encodeURIComponent(productTypeId)}` +
    `&sheet_type=${encodeURIComponent(sheetType)}` +
    `&date=${encodeURIComponent(date)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Print request failed with status ${res.status}`);
  }

  const html = await res.text();

  const blob = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank");
  if (!printWindow) {
    URL.revokeObjectURL(blobUrl);
    throw new Error("Could not open print window — check your popup blocker");
  }

  // Wait for content to render before triggering print, then clean up blob URL
  printWindow.addEventListener("load", () => {
    printWindow.print();
    URL.revokeObjectURL(blobUrl);
  });
}
