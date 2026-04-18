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
import { UsersPage } from "@/components/settings/UsersPage";
import { ProfilePage } from "@/components/settings/ProfilePage";
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
                      <Route path="/orders" element={<ProtectedRoute requiredArea="orders"><OrdersPage /></ProtectedRoute>} />
                      <Route path="/orders/new" element={<ProtectedRoute requiredArea="orders"><OrderForm /></ProtectedRoute>} />
                      <Route path="/orders/:orderId/edit" element={<ProtectedRoute requiredArea="orders"><OrderForm /></ProtectedRoute>} />
                      <Route path="/standing-orders" element={<ProtectedRoute requiredArea="orders"><StandingOrdersPage /></ProtectedRoute>} />
                      <Route path="/standing-orders/new" element={<ProtectedRoute requiredArea="orders"><StandingOrderForm /></ProtectedRoute>} />
                      <Route path="/standing-orders/:standingOrderId/edit" element={<ProtectedRoute requiredArea="orders"><StandingOrderForm /></ProtectedRoute>} />
                      <Route path="/customers" element={<ProtectedRoute requiredArea="customers"><CustomersPage /></ProtectedRoute>} />
                      <Route path="/products" element={<Navigate to="/products/varieties" replace />} />
                      <Route path="/products/varieties" element={<ProtectedRoute requiredArea="products"><VarietiesPage /></ProtectedRoute>} />
                      <Route path="/products/product-lines" element={<ProtectedRoute requiredArea="products"><ProductLinesPage /></ProtectedRoute>} />
                      <Route path="/products/colors" element={<ProtectedRoute requiredArea="products"><ColorsPage /></ProtectedRoute>} />
                      <Route path="/products/product-types" element={<ProtectedRoute requiredArea="products"><ProductTypesPage /></ProtectedRoute>} />
                      <Route path="/pricing" element={<Navigate to="/pricing/sales-items" replace />} />
                      <Route path="/pricing/sales-items" element={<ProtectedRoute requiredArea="pricing"><SalesItemsPage /></ProtectedRoute>} />
                      <Route path="/pricing/price-lists" element={<ProtectedRoute requiredArea="pricing"><PriceListsPage /></ProtectedRoute>} />
                      <Route path="/pricing/customer-prices" element={<ProtectedRoute requiredArea="pricing"><CustomerPricesPage /></ProtectedRoute>} />
                      <Route path="/inventory" element={<Navigate to="/inventory/counts" replace />} />
                      <Route path="/inventory/counts" element={<ProtectedRoute requiredArea="inventory_counts"><CountsPage /></ProtectedRoute>} />
                      <Route path="/inventory/estimates" element={<ProtectedRoute requiredArea="inventory_counts"><EstimatesPage /></ProtectedRoute>} />
                      <Route path="/inventory/availability" element={<ProtectedRoute requiredArea="inventory_availability"><AvailabilityPage /></ProtectedRoute>} />
                      <Route path="/inventory/harvest-status" element={<ProtectedRoute requiredArea="inventory_harvest"><HarvestStatusPage /></ProtectedRoute>} />
                      <Route path="/inventory/comparison" element={<ProtectedRoute requiredArea="inventory_availability"><ComparisonPage /></ProtectedRoute>} />
                      <Route path="/settings/profile" element={<ProfilePage />} />
                      <Route path="/settings/users" element={<ProtectedRoute requiredArea="users"><UsersPage /></ProtectedRoute>} />
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
