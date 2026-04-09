import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OrderForm } from "@/components/order/OrderForm";
import { CustomersPage } from "@/pages/CustomersPage";
import { VarietiesPage } from "@/pages/VarietiesPage";
import { ProductLinesPage } from "@/pages/ProductLinesPage";
import { ColorsPage } from "@/pages/ColorsPage";
import "@/index.css";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/orders" element={<OrderForm />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/products" element={<Navigate to="/products/varieties" replace />} />
            <Route path="/products/varieties" element={<VarietiesPage />} />
            <Route path="/products/product-lines" element={<ProductLinesPage />} />
            <Route path="/products/colors" element={<ColorsPage />} />
            <Route path="*" element={<Navigate to="/orders" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
