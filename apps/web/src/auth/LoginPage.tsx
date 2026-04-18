import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // If already authenticated, redirect to app
  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (err) setError(err.message);
  }

  async function handleGoogleLogin() {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: window.location.origin,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (err) setError(err.message);
  }

  async function handlePasswordReset() {
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSubmitting(false);
    if (err) setError(err.message);
    else setResetSent(true);
  }

  if (showReset) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#f4f1ec" }}>
        <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>Reset Password</h1>
            <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Enter your email to receive a reset link</p>
          </div>
          {resetSent ? (
            <div className="text-center space-y-4">
              <p className="text-sm" style={{ color: "#334155" }}>Check your email for the reset link.</p>
              <Button variant="outline" className="w-full" onClick={() => { setShowReset(false); setResetSent(false); }}>Back to Login</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="w-full" disabled={submitting} onClick={handlePasswordReset}>{submitting ? "Sending..." : "Send Reset Link"}</Button>
              <Button variant="outline" className="w-full" onClick={() => setShowReset(false)}>Back to Login</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "#f4f1ec" }}>
      <div className="w-full max-w-sm space-y-6 p-8 bg-white rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: "#1e3a5f" }}>FullBloom</h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" disabled={submitting} onClick={handleLogin}>{submitting ? "Signing in..." : "Sign In"}</Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" style={{ borderColor: "#e0ddd8" }} /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2" style={{ color: "#94a3b8" }}>or</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>Sign in with Google</Button>

        <div className="text-center">
          <button type="button" className="text-sm hover:underline" style={{ color: "#c27890" }} onClick={() => setShowReset(true)}>Forgot Password?</button>
        </div>
      </div>
    </div>
  );
}
