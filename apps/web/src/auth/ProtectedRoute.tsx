import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[#94a3b8]">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // User has a session but no local profile (not yet set up or deactivated)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#f4f1ec" }}>
        <div className="text-center space-y-4 p-8 bg-white rounded-lg shadow max-w-sm">
          <h2 className="text-lg font-bold" style={{ color: "#1e3a5f" }}>Access Denied</h2>
          <p className="text-sm" style={{ color: "#334155" }}>Your account is not active or has not been set up. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
