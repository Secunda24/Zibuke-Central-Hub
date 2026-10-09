"use client";

import { FormEvent, useState } from "react";

type AuthApiResponse = {
  success?: boolean;
  redirect?: string;
  error?: string;
  requiresOtp?: boolean;
};

const LOGIN_ERROR = "We could not verify those details";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otp, setOtp] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsSuccess(false);

    try {
      const response = await fetch(requiresOtp ? "/api/auth/verify" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requiresOtp ? { otp } : { email, password }),
      });
      
      const data = (await response.json()) as AuthApiResponse;

      if (!response.ok || data.error) {
        setMessage(data.error || LOGIN_ERROR);
        return;
      }

      if (data.requiresOtp) {
        setRequiresOtp(true); setOtp(""); setIsSuccess(true);
        setMessage("Check your account email for a eight-digit code. It expires in 10 minutes.");
        return;
      }
      setIsSuccess(true);
      setMessage("Access verified. Welcome back to Zibuke Central.");
      
      // INSTANTLY ROUTE TO DASHBOARD UPON SUCCESS
      window.location.href = data.redirect || "/dashboard";
      
    } catch {
      setMessage(LOGIN_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zibuke-bg p-6">
      {/* The green offset shadow effect */}
      <div className="relative w-full max-w-md">
        <div className="absolute top-3 left-3 w-full h-full bg-zibuke-accent rounded-xl"></div>
        
        {/* The main login card */}
        <div className="relative bg-zibuke-card border border-slate-800 p-8 rounded-xl shadow-2xl w-full">
          
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center border border-slate-800">
               <span className="text-zibuke-accent font-serif text-2xl font-bold">Z</span>
            </div>
          </div>

          <h2 className="text-center font-serif text-2xl text-zibuke-text font-bold mb-1">Zibuke Central</h2>
          <p className="text-center text-xs text-zibuke-muted tracking-widest mb-8 uppercase">Enterprise Access</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requiresOtp && <>
            <div>
              <label className="text-xs font-bold text-zibuke-muted mb-2 block uppercase tracking-wider">Corporate Email</label>
              <input 
                type="email" 
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="name@zibuke.com"
                className="w-full bg-black/50 border border-slate-700 rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-zibuke-accent focus:ring-1 focus:ring-zibuke-accent transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zibuke-muted mb-2 mt-4 block uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full bg-black/50 border border-slate-700 rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-zibuke-accent focus:ring-1 focus:ring-zibuke-accent transition-colors"
              />
            </div>

            </>}
            {requiresOtp && <div>
              <label htmlFor="login-otp" className="mb-2 block text-xs font-bold uppercase text-zibuke-muted">Email verification code</label>
              <input id="login-otp" value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0,8))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required autoFocus className="w-full rounded-md border border-slate-700 bg-black/50 px-4 py-3 text-center text-xl tracking-widest text-white" />
              <button type="button" disabled={isSubmitting} onClick={async () => {
                setIsSubmitting(true); setMessage(null);
                try {
                  const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Could not resend code");
                  if (data.redirect) { window.location.href = data.redirect; return; }
                  setOtp(""); setIsSuccess(true); setMessage("A new code was sent. Only the latest code will work.");
                } catch (error) { setIsSuccess(false); setMessage(error instanceof Error ? error.message : "Could not resend code"); }
                finally { setIsSubmitting(false); }
              }} className="mt-3 text-sm text-zibuke-accent underline disabled:opacity-50">Resend code</button>
              <button type="button" disabled={isSubmitting} onClick={() => { setRequiresOtp(false); setOtp(""); setPassword(""); setMessage(null); }} className="ml-4 text-sm text-zibuke-muted underline">Back to sign in</button>
            </div>}
            {message ? (
              <div
                className={`mt-4 rounded-md border px-4 py-3 text-sm font-medium ${
                  isSuccess
                    ? "border-zibuke-accent/30 bg-zibuke-accent/10 text-zibuke-accent"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
                role="status"
              >
                {message}
              </div>
            ) : null}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-zibuke-accent text-black font-bold py-3 rounded-md hover:bg-[#00c966] transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Verifying..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
