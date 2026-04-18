import { Navigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({
  children,
  requiredArea,
}: {
  children: React.ReactNode;
  requiredArea?: string;
}) {
  const { session, user, loading, signOut, canAccess } = useAuth();

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
        <div className="text-center space-y-6 p-8 bg-white rounded-lg shadow max-w-sm">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-heading">Access Denied</h2>
            <p className="text-sm text-text-body">
              Your account is not active or has not been set up. Please contact your administrator for access.
            </p>
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            Sign Out & Return to Login
          </Button>
        </div>
      </div>
    );
  }

  if (requiredArea && !canAccess(requiredArea, "read")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-heading mb-4">
          Access Denied
        </h2>
        <p className="text-text-body mb-8 max-w-md mx-auto">
          You don't have permission to view this area. If you believe this is an error, please contact your administrator.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
