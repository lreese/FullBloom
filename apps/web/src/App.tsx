import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { LoginPage } from "@/auth/LoginPage";
import { OrderForm } from "@/components/order/OrderForm";
import { OrdersPage } from "@/pages/OrdersPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { VarietiesPage } from "@/pages/VarietiesPage";
import { ProductLinesPage } from "@/pages/ProductLinesPage";
import { ColorsPage } from "@/pages/ColorsPage";
import { ProductTypesPage } from "@/pages/ProductTypesPage";
import { SalesItemsPage } from "@/pages/SalesItemsPage";
import { PriceListsPage } from "@/pages/PriceListsPage";
import { CustomerPricesPage } from "@/pages/CustomerPricesPage";
import { CountsPage } from "@/pages/inventory/CountsPage";
import { EstimatesPage } from "@/pages/inventory/EstimatesPage";
import { AvailabilityPage } from "@/pages/inventory/AvailabilityPage";
import { HarvestStatusPage } from "@/pages/inventory/HarvestStatusPage";
import { ComparisonPage } from "@/pages/inventory/ComparisonPage";
import { StandingOrdersPage } from "@/pages/StandingOrdersPage";
import { StandingOrderForm } from "@/components/standing-orders/StandingOrderForm";
import "@/index.css";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Routes>
                      <Route path="/orders" element={<OrdersPage />} />
                      <Route path="/orders/new" element={<OrderForm />} />
                      <Route path="/orders/:orderId/edit" element={<OrderForm />} />
                      <Route path="/standing-orders" element={<StandingOrdersPage />} />
                      <Route path="/standing-orders/new" element={<StandingOrderForm />} />
                      <Route path="/standing-orders/:standingOrderId/edit" element={<StandingOrderForm />} />
                      <Route path="/customers" element={<CustomersPage />} />
                      <Route path="/products" element={<Navigate to="/products/varieties" replace />} />
                      <Route path="/products/varieties" element={<VarietiesPage />} />
                      <Route path="/products/product-lines" element={<ProductLinesPage />} />
                      <Route path="/products/colors" element={<ColorsPage />} />
                      <Route path="/products/product-types" element={<ProductTypesPage />} />
                      <Route path="/pricing" element={<Navigate to="/pricing/sales-items" replace />} />
                      <Route path="/pricing/sales-items" element={<SalesItemsPage />} />
                      <Route path="/pricing/price-lists" element={<PriceListsPage />} />
                      <Route path="/pricing/customer-prices" element={<CustomerPricesPage />} />
                      <Route path="/inventory" element={<Navigate to="/inventory/counts" replace />} />
                      <Route path="/inventory/counts" element={<CountsPage />} />
                      <Route path="/inventory/estimates" element={<EstimatesPage />} />
                      <Route path="/inventory/availability" element={<AvailabilityPage />} />
                      <Route path="/inventory/harvest-status" element={<HarvestStatusPage />} />
                      <Route path="/inventory/comparison" element={<ComparisonPage />} />
                      <Route path="/settings/profile" element={<div>Profile</div>} />
                      <Route path="/settings/users" element={<div>Users</div>} />
                      <Route path="*" element={<Navigate to="/orders" replace />} />
                    </Routes>
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
