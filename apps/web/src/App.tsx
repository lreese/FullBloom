import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OrderForm } from "@/components/order/OrderForm";
import "@/index.css";

function App() {
  return (
    <ErrorBoundary>
      <AppShell>
        <OrderForm />
      </AppShell>
    </ErrorBoundary>
  );
}

export default App;
