"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import EmployeeDocuments from "@/src/modules/documents/EmployeeDocuments";

export default function SettingsPage() {
  // --- Profile State ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState({ personalEmail: "", alternatePhone: "", identityNumber: "", gender: "", city: "", province: "", dateOfBirth: "" });
  const [employment, setEmployment] = useState({ department: "", jobTitle: "", startDate: "" });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // --- Password State ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // --- Avatar State ---
  const [isUploading, setIsUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [avatarTimestamp, setAvatarTimestamp] = useState(0);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Preferences State ---
  const emailNotifs = false;
  const smsNotifs = false;
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [prefMessage, setPrefMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  // Fetch initial profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/settings/profile");
        const data = await res.json();
        if (!res.ok || !data.user) throw new Error("Could not load your profile");
        if (data.user) {
          setFirstName(data.user.first_name || "");
          setLastName(data.user.last_name || "");
          setPhone(data.user.phone || "");
          setEmail(data.user.email || "");
          setDetails({ personalEmail: data.user.personal_email || "", alternatePhone: data.user.alternate_phone || "", identityNumber: data.user.identity_number || "", gender: data.user.gender || "", city: data.user.city || "", province: data.user.province || "", dateOfBirth: data.user.date_of_birth || "" });
          setEmployment({ department: data.user.department || "", jobTitle: data.user.job_title || "", startDate: data.user.start_date || "" });
          setProfileLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load profile", error);
        setProfileMessage({ type: "error", text: "Could not load your profile. Refresh the page to try again." });
      }
    }
    loadProfile();
  }, []);

  // --- Handlers ---
  async function handleProfileUpdate(e: FormEvent) {
    e.preventDefault();
    setProfileMessage(null);
    setIsProfileSubmitting(true);

    try {
      const res = await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, ...details })
      });

      const data = await res.json();

      if (res.ok) {
        setProfileMessage({ type: "success", text: "Profile updated successfully!" });
      } else {
        setProfileMessage({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch (error) {
      setProfileMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Password updated successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update password." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setAvatarMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/settings/avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setAvatarMessage({ type: "success", text: "Profile picture uploaded successfully!" });
        setAvatarTimestamp(Date.now()); 
        setImageError(false); 
      } else {
        setAvatarMessage({ type: "error", text: "Failed to upload picture." });
      }
    } catch (error) {
      setAvatarMessage({ type: "error", text: "Network error while uploading." });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; 
    }
  }

  async function handleTestEmail() {
    setIsSendingTest(true);
    setPrefMessage(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email || "jayjacobs@zibukeafrica.co.za",
          subject: "Test Notification from Zibuke Central",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0f172a;">Zibuke Central Notifications</h2>
              <p style="color: #475569; font-size: 16px;">Hello ${firstName || 'there'},</p>
              <p style="color: #475569; font-size: 16px;">Your Resend email integration is working perfectly! You are now ready to receive global alerts and daily digests.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated test message from your enterprise workspace.</p>
            </div>
          `
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setPrefMessage({ type: "success", text: "Test email sent successfully! Check your inbox." });
      } else {
        setPrefMessage({ type: "error", text: payload.detail || payload.error || "Failed to send test email. Verify your API key." });
      }
    } catch (err) {
      setPrefMessage({ type: "error", text: "Network error. Could not reach email server." });
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] p-6 text-[#0f172a] sm:p-12">
      <div className="mx-auto max-w-3xl">
        
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0d9488]">
            Preferences
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0f172a]">
            Account Settings
          </h1>
          <p className="mt-2 text-slate-500">
            Manage your personal profile, security, and notification preferences.
          </p>
        </header>

        <div className="space-y-8">
          
          {/* SECTION 1: Profile Picture */}
          <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="mb-5 border-b border-slate-100 pb-3 text-lg font-bold text-[#0f172a]">
              Profile Picture
            </h2>

            {avatarMessage && (
              <div className={`mb-6 rounded-md p-4 text-sm ${avatarMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {avatarMessage.text}
              </div>
            )}

            <div className="flex items-center gap-6">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0d9488]/10 text-3xl font-bold text-[#0d9488] ring-4 ring-slate-50">
                {!imageError ? (
                  <img 
                    src={`/api/settings/avatar?t=${avatarTimestamp}`} 
                    alt="Profile" 
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  "U"
                )}
              </div>
              
              <div>
                <p className="mb-3 text-sm text-slate-500">
                  Upload a professional headshot. Max file size is 5MB.
                </p>
                
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Choose File"}
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 2: Personal Information */}
          <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="mb-5 border-b border-slate-100 pb-3 text-lg font-bold text-[#0f172a]">
              Personal Information
            </h2>

            {profileMessage && (
              <div className={`mb-6 rounded-md p-4 text-sm ${profileMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-5 max-w-xl">
              <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-1">
                <p><strong>Department:</strong> {employment.department || "Not provided"}</p>
                <p><strong>Job title:</strong> {employment.jobTitle || "Not provided"}</p>
                <p className="break-all"><strong>Account email:</strong> {email || "Not provided"}</p>
                <p><strong>Start date:</strong> {employment.startDate || "Not provided"}</p>
                <p className="text-xs text-slate-500">Contact an administrator to change your employment or sign-in details.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#0f172a]">First Name</span>
                  <input 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" 
                    required 
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#0f172a]">Last Name</span>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" 
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-[#0f172a]">Phone Number (WhatsApp)</span>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27 00 000 0000"
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" 
                />
                <p className="mt-1 text-xs text-slate-500">Include your country code. This activates your WhatsApp shortcut in the directory.</p>
              </label>

              {([
                ["personalEmail", "Personal email", "email"],
                ["alternatePhone", "Alternate phone", "tel"],
                ["dateOfBirth", "Date of birth", "date"],
                ["identityNumber", "ID number", "text"],
                ["gender", "Gender", "text"],
                ["city", "Town / city", "text"],
                ["province", "Province", "text"],
              ] as const).map(([field, label, type]) => (
                <label key={field} className="block">
                  <span className="text-sm font-medium text-[#0f172a]">{label}</span>
                  <input type={type} value={details[field]} maxLength={254}
                    onChange={(e) => setDetails((previous) => ({ ...previous, [field]: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" />
                </label>
              ))}

              <button 
                type="submit" 
                disabled={isProfileSubmitting || !profileLoaded}
                className="mt-2 rounded-md bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f766e] disabled:bg-slate-300"
              >
                {isProfileSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>

          <a className="block my-4 text-emerald-700 underline" href="/dashboard/training">My training, assessments and reporting requirements</a>
          <EmployeeDocuments />

          {/* SECTION 3: Change Password */}
          <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="mb-5 border-b border-slate-100 pb-3 text-lg font-bold text-[#0f172a]">
              Change Password
            </h2>

            {message && (
              <div className={`mb-6 rounded-md p-4 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-5 max-w-xl">
              <label className="block">
                <span className="text-sm font-medium text-[#0f172a]">Current Password</span>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" 
                  required 
                />
              </label>
              
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#0f172a]">New Password</span>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" 
                    required 
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#0f172a]">Confirm Password</span>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    className="mt-1 block w-full rounded-md border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20" 
                    required 
                  />
                </label>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="mt-2 rounded-md bg-[#0d9488] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f766e] disabled:bg-slate-300"
              >
                {isSubmitting ? "Updating..." : "Update Security"}
              </button>
            </form>
          </section>

          {/* SECTION 4: Preferences */}
          <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-5 border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0f172a]">
                Global Preferences
              </h2>
            </div>

            {prefMessage && (
              <div className={`mb-6 rounded-md p-4 text-sm ${prefMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {prefMessage.text}
              </div>
            )}

            <div className="space-y-6">
              {/* Email Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Email Notifications</p>
                  <p className="text-sm text-slate-500">Email alerts are not configured. Your notifications are available in the app.</p>
                </div>
                <button 
                  disabled aria-label="Email alerts unavailable"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailNotifs ? 'bg-[#0d9488]' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emailNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* SMS Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">SMS Alerts</p>
                  <p className="text-sm text-slate-500">SMS alerts are not configured.</p>
                </div>
                <button 
                  disabled aria-label="SMS alerts unavailable"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smsNotifs ? 'bg-[#0d9488]' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smsNotifs ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="mt-8 flex gap-4 border-t border-slate-100 pt-6">
              <button 
                onClick={handleTestEmail}
                disabled={isSendingTest}
                className="rounded-md bg-white border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isSendingTest ? "Sending..." : "Send Test Email"}
              </button>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
