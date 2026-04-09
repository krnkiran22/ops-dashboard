"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchStaffAssignments,
  fetchMyLeadAssignments,
  confirmAssignment,
  rejectAssignment,
  confirmLeadAssignment,
  rejectLeadAssignment,
  fetchTaskChecklist,
  type StaffProfile,
  type StaffAssignment as ApiAssignment,
  type TaskChecklist,
  type ChecklistItem,
} from "@/lib/api/staff";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "next-themes";
import { LocationPreview } from "@/components/LocationPreview";
import { SalesView } from "@/components/SalesView";

// ---------------------------------------------------------------------------
// Top-level page state machine
// ---------------------------------------------------------------------------

type PageState =
  | { kind: "loading" }
  | { kind: "signup"; formData?: SignUpFormData }
  | { kind: "login"; formData?: LoginFormData }
  | { kind: "clerk_auth"; formData: SignUpFormData }
  | { kind: "portal"; role: "operator" | "sales"; profile: StaffProfile }
  | { kind: "error"; message: string };

interface SignUpFormData {
  fullName: string;
  phone: string;
  email: string;
  role: "operator" | "sales";
}

interface LoginFormData {
  email: string;
  role: "operator" | "sales";
}

const DUMMY_SESSION_KEY = "ops-dashboard-dummy-session-v1";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function splitClerkName(fullName: string): {
  firstName?: string;
  lastName?: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
  };
}

function formatClerkField(field: string): string {
  switch (field) {
    case "first_name": return "first name";
    case "last_name": return "last name";
    case "phone_number": return "phone number";
    case "email_address": return "email address";
    default: return field.replace(/_/g, " ");
  }
}

function buildClerkSignUpMessage(signUpAttempt: {
  status: string | null;
  missingFields?: string[];
  unverifiedFields?: string[];
}): string {
  const missing = (signUpAttempt.missingFields ?? []).map(formatClerkField);
  const unverified = (signUpAttempt.unverifiedFields ?? []).map(formatClerkField);
  const details = [...missing, ...unverified];
  if (details.length > 0) {
    return `Finish required fields: ${details.join(", ")}.`;
  }
  if (signUpAttempt.status === "missing_requirements") {
    return "Clerk still needs more signup details.";
  }
  return "Verification did not complete.";
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputClass =
  "w-full h-10 border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 placeholder:text-muted-foreground";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DUMMY_SESSION_KEY);
      if (!raw) {
        setState({ kind: "signup" });
        return;
      }
      const parsed = JSON.parse(raw) as {
        role?: "operator" | "sales";
        profile?: StaffProfile;
      };
      if (!parsed.role || !parsed.profile) {
        setState({ kind: "signup" });
        return;
      }
      setState({ kind: "portal", role: parsed.role, profile: parsed.profile });
    } catch {
      setState({ kind: "signup" });
    }
  }, []);

  const persistSession = useCallback((role: "operator" | "sales", profile: StaffProfile) => {
    window.localStorage.setItem(
      DUMMY_SESSION_KEY,
      JSON.stringify({
        role,
        profile,
      })
    );
    setState({ kind: "portal", role, profile });
  }, []);

  const handleDummySignUp = useCallback(
    (formData: SignUpFormData) => {
      setState({ kind: "clerk_auth", formData });
    },
    []
  );

  const handleDummyVerified = useCallback(
    (formData: SignUpFormData) => {
      const role = formData.role;
      const profile: StaffProfile = {
        id: `dummy-${Date.now()}`,
        display_name: formData.fullName,
        phone: formData.phone,
        role: role === "sales" ? "ops_sales" : "ops_operator",
        status: "active",
      };
      persistSession(role, profile);
    },
    [persistSession]
  );

  const handleDummyLogin = useCallback(
    (formData: LoginFormData) => {
      const role = formData.role;
      const username = formData.email.split("@")[0] || "ops-user";
      const profile: StaffProfile = {
        id: `dummy-login-${Date.now()}`,
        display_name: username,
        phone: "+910000000000",
        role: role === "sales" ? "ops_sales" : "ops_operator",
        status: "active",
      };
      persistSession(role, profile);
    },
    [persistSession]
  );

  return (
    <>
      {state.kind === "loading" && (
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 animate-fade-in">
            <span className="text-lg font-bold tracking-tight text-foreground font-display">
              build
            </span>
            <Spinner className="size-5" />
          </div>
        </div>
      )}

      {state.kind === "signup" && (
        <SignUpPage
          initialData={state.formData}
          onStartVerification={(formData) =>
            handleDummySignUp(formData)
          }
          onGoToLogin={(formData) => setState({ kind: "login", formData })}
        />
      )}

      {state.kind === "login" && (
        <DummyLoginPage
          initialData={state.formData}
          onLogin={handleDummyLogin}
          onGoToSignup={() => setState({ kind: "signup" })}
        />
      )}

      {state.kind === "clerk_auth" && (
        <ClerkAuthPage
          formData={state.formData}
          onVerified={handleDummyVerified}
          onBack={() => setState({ kind: "signup", formData: state.formData })}
        />
      )}

      {state.kind === "portal" && state.role === "operator" && (
        <OperatorView profile={state.profile} />
      )}

      {state.kind === "portal" && state.role === "sales" && (
        <SalesView profile={state.profile} />
      )}

      {state.kind === "error" && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 bg-background">
          <span className="text-lg font-bold tracking-tight text-foreground font-display">
            build
          </span>
          <div className="border border-border bg-card p-6 text-center max-w-sm w-full">
            <p className="text-sm text-destructive">{state.message}</p>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setState({ kind: "signup" })}
          >
            Try again
          </button>
        </div>
      )}
    </>
  );
}

// ===========================================================================
// Sign Up
// ===========================================================================

function SignUpPage({
  initialData,
  onStartVerification,
  onGoToLogin,
}: {
  initialData?: SignUpFormData;
  onStartVerification: (data: SignUpFormData) => void;
  onGoToLogin: (data: LoginFormData) => void;
}) {
  const [form, setForm] = useState<SignUpFormData>(
    initialData ?? { fullName: "", phone: "", email: "", role: "operator" }
  );
  const [error, setError] = useState("");

  function update<K extends keyof SignUpFormData>(
    field: K,
    value: SignUpFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim()) { setError("Full name is required."); return; }
    const cleanPhone = form.phone.replace(/\s/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setError("Enter a valid WhatsApp number with country code.");
      return;
    }
    const normalizedEmail = normalizeEmail(form.email);
    if (!normalizedEmail) { setError("Email is required."); return; }
    if (!isValidEmail(normalizedEmail)) { setError("Enter a valid email."); return; }
    onStartVerification({
      ...form,
      fullName: form.fullName.trim(),
      phone: cleanPhone.startsWith("+") ? cleanPhone : `+91${cleanPhone}`,
      email: normalizedEmail,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-xs space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-1">
          <span className="text-lg font-bold tracking-tight text-foreground font-display">
            build
          </span>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
            Staff Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border status-error px-3 py-2.5 text-xs">{error}</div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Full Name
            </label>
            <input
              className={inputClass}
              placeholder="Your full name"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              WhatsApp Number
            </label>
            <input
              type="tel"
              className={inputClass}
              placeholder="WhatsApp number (e.g. 9876543210)"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              autoComplete="tel"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">We&apos;ll add +91 automatically</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Email
            </label>
            <input
              type="email"
              className={inputClass}
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Role
            </label>
            <div className="grid grid-cols-2 gap-0">
              <button
                type="button"
                onClick={() => update("role", "operator")}
                className={`h-10 text-xs font-semibold border transition-colors ${
                  form.role === "operator"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-input hover:text-foreground"
                }`}
              >
                Operator
              </button>
              <button
                type="button"
                onClick={() => update("role", "sales")}
                className={`h-10 text-xs font-semibold border border-l-0 transition-colors ${
                  form.role === "sales"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-input hover:text-foreground"
                }`}
              >
                Sales
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {form.role === "operator"
                ? "Field deployment and site operations"
                : "Factory referrals and lead generation"}
            </p>
          </div>

          <button
            type="submit"
            className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold transition-colors active:opacity-90"
          >
            Continue
          </button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              className="underline text-foreground"
              onClick={() =>
                onGoToLogin({
                  email: normalizeEmail(form.email),
                  role: form.role,
                })
              }
            >
              Sign in
            </button>
          </p>

        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Clerk Auth
// ===========================================================================

function ClerkAuthPage({
  formData,
  onVerified,
  onBack,
}: {
  formData: SignUpFormData;
  onVerified: (formData: SignUpFormData) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"phone" | "email">("phone");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [isSendingPhoneCode, setIsSendingPhoneCode] = useState(false);
  const [isVerifyingPhoneCode, setIsVerifyingPhoneCode] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isVerifyingEmailCode, setIsVerifyingEmailCode] = useState(false);
  const [phoneRequested, setPhoneRequested] = useState(false);
  const [emailRequested, setEmailRequested] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");

  async function handleSendPhoneCode() {
    setPhoneError("");
    setIsSendingPhoneCode(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPhoneRequested(true);
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : "Could not send OTP.");
    } finally {
      setIsSendingPhoneCode(false);
    }
  }

  async function handleVerifyPhoneCode() {
    if (!phoneCode.trim()) { setPhoneError("Enter the OTP."); return; }
    if (!phoneRequested) { setPhoneError("Request an OTP first."); return; }
    setPhoneError("");
    setIsVerifyingPhoneCode(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setEmailRequested(true);
      setStep("email");
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : "Could not verify OTP.");
    } finally {
      setIsVerifyingPhoneCode(false);
    }
  }

  async function handleSendEmailCode() {
    setEmailError("");
    setIsSendingEmailCode(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setEmailRequested(true);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Could not send email code.");
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  async function handleVerifyEmailCode() {
    if (!emailCode.trim()) { setEmailError("Enter the code."); return; }
    if (!emailRequested) { setEmailError("Request a code first."); return; }
    setEmailError("");
    setIsVerifyingEmailCode(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      onVerified(formData);
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Could not verify code.");
    } finally {
      setIsVerifyingEmailCode(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-xs space-y-5 animate-fade-in">
        <div className="text-center space-y-1">
          <span className="text-lg font-bold tracking-tight text-foreground font-display">
            build
          </span>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
            Verify Identity
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {step === "phone" ? "Step 1 of 2 \u2014 Verify Phone" : "Step 2 of 2 \u2014 Verify Email"}
          </p>
        </div>

        {/* Contact summary */}
        <div className="border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Phone</span>
            <span className="text-sm font-medium tabular-nums">{formData.phone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Email</span>
            <span className="text-sm font-medium">{normalizeEmail(formData.email)}</span>
          </div>
        </div>

        <div className="border border-border bg-card p-4 space-y-4">
          <div id="clerk-captcha" data-cl-theme="auto" data-cl-size="flexible" className="min-h-0" />

          {step === "phone" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                  Phone OTP
                </label>
                <input
                  className={inputClass}
                  placeholder="6-digit code"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              {phoneError && <div className="border status-error px-3 py-2 text-xs">{phoneError}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 h-9 border border-border text-xs font-semibold transition-colors active:opacity-90 disabled:opacity-50"
                  onClick={() => void handleSendPhoneCode()}
                  disabled={isSendingPhoneCode || isVerifyingPhoneCode}
                >
                  {isSendingPhoneCode ? "Sending..." : phoneRequested ? "Resend" : "Send OTP"}
                </button>
                <button
                  type="button"
                  className="flex-1 h-9 bg-primary text-primary-foreground text-xs font-semibold transition-colors active:opacity-90 disabled:opacity-50"
                  onClick={() => void handleVerifyPhoneCode()}
                  disabled={!phoneRequested || isSendingPhoneCode || isVerifyingPhoneCode}
                >
                  {isVerifyingPhoneCode ? "Verifying..." : "Verify"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                  Email Code
                </label>
                <input
                  className={inputClass}
                  placeholder="6-digit code"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              {emailError && <div className="border status-error px-3 py-2 text-xs">{emailError}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 h-9 border border-border text-xs font-semibold transition-colors active:opacity-90 disabled:opacity-50"
                  onClick={() => void handleSendEmailCode()}
                  disabled={isSendingEmailCode || isVerifyingEmailCode}
                >
                  {isSendingEmailCode ? "Sending..." : emailRequested ? "Resend" : "Send Code"}
                </button>
                <button
                  type="button"
                  className="flex-1 h-9 bg-primary text-primary-foreground text-xs font-semibold transition-colors active:opacity-90 disabled:opacity-50"
                  onClick={() => void handleVerifyEmailCode()}
                  disabled={!emailRequested || isSendingEmailCode || isVerifyingEmailCode}
                >
                  {isVerifyingEmailCode ? "Verifying..." : "Verify"}
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          className="w-full text-center text-[11px] text-muted-foreground underline"
          onClick={onBack}
        >
          Back to sign up
        </button>
      </div>
    </div>
  );
}

function DummyLoginPage({
  initialData,
  onLogin,
  onGoToSignup,
}: {
  initialData?: LoginFormData;
  onLogin: (data: LoginFormData) => void;
  onGoToSignup: () => void;
}) {
  const [form, setForm] = useState<LoginFormData>(
    initialData ?? { email: "", role: "operator" }
  );
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const normalizedEmail = normalizeEmail(form.email);
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email.");
      return;
    }
    onLogin({ ...form, email: normalizedEmail });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-xs space-y-6 animate-fade-in">
        <div className="text-center space-y-1">
          <span className="text-lg font-bold tracking-tight text-foreground font-display">
            build
          </span>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
            Staff Login (Dummy)
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border status-error px-3 py-2.5 text-xs">{error}</div>
          )}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Email
            </label>
            <input
              type="email"
              className={inputClass}
              placeholder="you@build.ai"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Role
            </label>
            <div className="grid grid-cols-2 gap-0">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, role: "operator" }))}
                className={`h-10 text-xs font-semibold border transition-colors ${
                  form.role === "operator"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-input hover:text-foreground"
                }`}
              >
                Operator
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, role: "sales" }))}
                className={`h-10 text-xs font-semibold border border-l-0 transition-colors ${
                  form.role === "sales"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-input hover:text-foreground"
                }`}
              >
                Sales
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold transition-colors active:opacity-90"
          >
            Sign In (Dummy)
          </button>
        </form>
        <div className="text-center">
          <button
            type="button"
            className="text-[11px] text-muted-foreground underline"
            onClick={onGoToSignup}
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}

function DummyUserButton() {
  return (
    <button
      type="button"
      className="h-6 w-6 rounded-full border border-border text-[10px] font-semibold text-muted-foreground"
      title="Dummy auth"
      aria-label="Dummy user"
    >
      D
    </button>
  );
}


// ===========================================================================
// Shared: Minimal top bar
// ===========================================================================

function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between h-10 px-5 max-w-lg mx-auto">
        <span className="text-xs font-bold tracking-tight text-foreground font-display">build</span>
        <div className="flex items-center gap-5 text-[10px] tabular-nums text-muted-foreground">
          {children}
        </div>
        <DummyUserButton />
      </div>
    </div>
  );
}

// ===========================================================================
// Operator View — role-aware tabs with dynamic checklists
// ===========================================================================

type AssignmentStatus = "no_assignment" | "scheduled" | "confirmed" | "rejected";
type AssignmentType = "verifier" | "shipper" | "deployer";

const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, { label: string; taskLabel: string; confirmLabel: string }> = {
  verifier: { label: "Verifier", taskLabel: "Site Visit", confirmLabel: "I'm On It" },
  shipper: { label: "Shipper", taskLabel: "Shipping Task", confirmLabel: "Dispatched" },
  deployer: { label: "Deployer", taskLabel: "Deployment", confirmLabel: "Confirm Deploy" },
};

/** Parsed from API `metadata.assigned_operators` (mock + live). */
interface AssignedOperatorRow {
  name: string;
  role: string;
  phone?: string;
}

/** Parsed from API `metadata.delivery_services` (mock + live). */
interface DeliveryServiceRow {
  name: string;
  serviceType?: string;
  trackingId?: string;
  eta?: string;
}

interface DisplayAssignment {
  id: string;
  date: string;
  dateLabel: string;
  site: string;
  address: string;
  time: string;
  workers?: number;
  devices?: number;
  industry?: string;
  shifts?: number;
  contactName?: string;
  contactPhone?: string;
  googleMapsUrl?: string;
  protocols?: string;
  status: AssignmentStatus;
  assignmentType: AssignmentType;
  lat?: number;
  lng?: number;
  assignedOperators?: AssignedOperatorRow[];
  deliveryServices?: DeliveryServiceRow[];
}

function parseAssignedOperatorsFromMeta(m: Record<string, unknown>): AssignedOperatorRow[] | undefined {
  const raw = m.assigned_operators;
  if (!Array.isArray(raw)) return undefined;
  const out: AssignedOperatorRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = o.name;
    if (typeof name !== "string" || !name.trim()) continue;
    out.push({
      name: name.trim(),
      role: typeof o.role === "string" ? o.role : "Operator",
      phone: typeof o.phone === "string" ? o.phone : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

function parseDeliveryServicesFromMeta(m: Record<string, unknown>): DeliveryServiceRow[] | undefined {
  const raw = m.delivery_services;
  if (!Array.isArray(raw)) return undefined;
  const out: DeliveryServiceRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = o.name;
    if (typeof name !== "string" || !name.trim()) continue;
    out.push({
      name: name.trim(),
      serviceType:
        (typeof o.service_type === "string" ? o.service_type : undefined) ??
        (typeof o.serviceType === "string" ? o.serviceType : undefined),
      trackingId:
        (typeof o.tracking_id === "string" ? o.tracking_id : undefined) ??
        (typeof o.trackingId === "string" ? o.trackingId : undefined),
      eta:
        (typeof o.estimated_delivery === "string" ? o.estimated_delivery : undefined) ??
        (typeof o.eta === "string" ? o.eta : undefined),
    });
  }
  return out.length > 0 ? out : undefined;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
}

function mapApiAssignment(a: ApiAssignment): DisplayAssignment {
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  return {
    id: a.id,
    date: a.assignment_date,
    dateLabel: formatDateLabel(a.assignment_date),
    site: a.site_name || "Assigned Site",
    address: a.site_address || "",
    time: (meta.time as string) || "",
    workers: meta.worker_count as number | undefined,
    status: a.status === "confirmed" ? "confirmed" : a.status === "rejected" ? "rejected" : "scheduled",
    assignmentType: "verifier",
    lat: meta.lat as number | undefined,
    lng: meta.lng as number | undefined,
    assignedOperators: parseAssignedOperatorsFromMeta(meta),
    deliveryServices: parseDeliveryServicesFromMeta(meta),
  };
}

function OperatorView({ profile }: { profile: StaffProfile }) {
  const { resolvedTheme } = useTheme();
  const [assignments, setAssignments] = useState<DisplayAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DisplayAssignment | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assignmentSource, setAssignmentSource] = useState<"lead" | "staff">("lead");
  const [activeTab, setActiveTab] = useState<AssignmentType>("verifier");
  const [checklist, setChecklist] = useState<TaskChecklist | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const loadAssignments = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const leadAssignRes = await fetchMyLeadAssignments();
      const leadAssigns = leadAssignRes?.items ?? [];
      if (leadAssigns.length > 0) {
        setAssignmentSource("lead");
        setAssignments(leadAssigns.map((a) => {
          const m = (a.metadata ?? {}) as Record<string, unknown>;
          return {
            id: a.id,
            date: a.scheduled_date ?? "",
            dateLabel: a.scheduled_date ? formatDateLabel(a.scheduled_date) : "TBD",
            site: (m.factory_name as string) ?? "Assigned Site",
            address: (m.address as string) ?? "",
            time: a.scheduled_time ?? "",
            workers: m.worker_count as number | undefined,
            devices: m.device_count as number | undefined,
            industry: m.industry as string | undefined,
            shifts: m.shifts as number | undefined,
            contactName: m.contact_name as string | undefined,
            contactPhone: m.contact_phone as string | undefined,
            googleMapsUrl: m.google_maps_url as string | undefined,
            protocols: m.protocols as string | undefined,
            status: (a.status === "confirmed" ? "confirmed" : a.status === "rejected" ? "rejected" : "scheduled") as AssignmentStatus,
            assignmentType: a.assignment_type,
            lat: m.lat as number | undefined,
            lng: m.lng as number | undefined,
            assignedOperators: parseAssignedOperatorsFromMeta(m),
            deliveryServices: parseDeliveryServicesFromMeta(m),
          };
        }));
      } else {
        setAssignmentSource("staff");
        const raw = await fetchStaffAssignments(profile.id);
        const list = Array.isArray(raw)
          ? raw
          : (raw as unknown as { items: ApiAssignment[] }).items ?? [];
        setAssignments(list.map(mapApiAssignment));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assignments.");
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => { void loadAssignments(); }, [loadAssignments]);

  // Load checklist when tab changes
  useEffect(() => {
    fetchTaskChecklist(activeTab)
      .then(setChecklist)
      .catch(() => setChecklist(null));
    setCheckedItems(new Set());
  }, [activeTab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAssignments({ silent: true });
    setRefreshing(false);
  }, [loadAssignments]);

  const handleConfirm = useCallback(async (id: string) => {
    setActionLoading(id);
    setActionError(null);
    try {
      if (assignmentSource === "lead") {
        await confirmLeadAssignment(id);
      } else {
        await confirmAssignment(id);
      }
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: "confirmed" as const } : a));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not confirm. Try again.");
    } finally { setActionLoading(null); }
  }, [assignmentSource]);

  const handleReject = useCallback(async (id: string) => {
    setActionLoading(id);
    setActionError(null);
    try {
      if (assignmentSource === "lead") {
        await rejectLeadAssignment(id);
      } else {
        await rejectAssignment(id);
      }
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected" as const } : a));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update. Try again.");
    } finally { setActionLoading(null); }
  }, [assignmentSource]);

  // Derive tab-specific data
  const tabAssignments = assignments.filter((a) => a.assignmentType === activeTab);
  const todayAssignment = tabAssignments.find((a) => a.dateLabel === "Today" && a.status !== "rejected");
  const upcoming = tabAssignments.filter((a) => a !== todayAssignment && a.status !== "rejected");
  const confirmedCount = tabAssignments.filter((a) => a.status === "confirmed").length;
  const pendingCount = tabAssignments.filter((a) => a.status === "scheduled").length;

  // Which tabs have assignments?
  const availableTypes = [...new Set(assignments.map((a) => a.assignmentType))];
  // Auto-switch to first available tab
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(activeTab)) {
      setActiveTab(availableTypes[0]);
    }
  }, [availableTypes, activeTab]);

  const typeConfig = ASSIGNMENT_TYPE_LABELS[activeTab];

  return (
    <div className="min-h-dvh bg-background">
      <TopBar>
        <span className="inline-flex items-center h-5 px-1.5 bg-muted text-[9px] font-semibold uppercase tracking-wide">
          {typeConfig.label}
        </span>
        {confirmedCount > 0
          ? <span>{confirmedCount} confirmed</span>
          : pendingCount > 0
            ? <span>{pendingCount} pending</span>
            : <span className="text-muted-foreground">No tasks</span>
        }
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? "animate-spin" : ""}>
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
        </button>
      </TopBar>

      {/* Role tabs */}
      {availableTypes.length > 1 && (
        <div className="sticky top-10 z-40 bg-background border-b border-border">
          <div className="flex max-w-lg mx-auto">
            {(["verifier", "shipper", "deployer"] as const).filter((t) => availableTypes.includes(t)).map((type) => {
              const count = assignments.filter((a) => a.assignmentType === type && a.status !== "rejected").length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 py-2.5 text-[10px] uppercase tracking-[0.15em] font-semibold transition-colors ${
                    activeTab === type
                      ? "text-foreground border-b-2 border-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ASSIGNMENT_TYPE_LABELS[type].label}
                  {count > 0 && <span className="ml-1.5 tabular-nums">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="px-5 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner className="size-5" /></div>
        ) : error ? (
          <div className="px-4 py-6 text-center mt-8"><p className="text-xs text-muted-foreground">{error}</p></div>
        ) : (
          <>
            {actionError && (
              <div className="mt-2 border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs flex items-center justify-between">
                <span>{actionError}</span>
                <button type="button" onClick={() => setActionError(null)} className="ml-2 text-xs font-bold opacity-60 hover:opacity-100">&times;</button>
              </div>
            )}

            {/* ── Hero: Today's Assignment ── */}
            <section className="pt-8 pb-6 animate-fade-in">
              {todayAssignment ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-muted-foreground">
                      Today · {typeConfig.taskLabel}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelected(todayAssignment)}
                      className="shrink-0 text-[10px] font-semibold text-primary underline underline-offset-2 hover:opacity-90"
                    >
                      Full details
                    </button>
                  </div>

                  {/* Map preview */}
                  {todayAssignment.lat && todayAssignment.lng ? (
                    <div className="mt-4 h-40 border border-border overflow-hidden relative">
                      <LocationPreview
                        lat={todayAssignment.lat}
                        lng={todayAssignment.lng}
                        label={todayAssignment.site.split(",")[0]}
                        theme={resolvedTheme}
                        className="w-full h-full"
                      />
                      {todayAssignment.googleMapsUrl && (
                        <a
                          href={todayAssignment.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm px-2 py-1 text-[10px] font-medium text-primary hover:underline border border-border/50"
                        >
                          Open in Google Maps ↗
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 h-24 border border-border bg-muted/20 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Map unavailable</span>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-display text-2xl tracking-tight font-bold">{todayAssignment.site}</p>
                    {todayAssignment.address && (
                      <p className="text-[12px] text-muted-foreground mt-1">{todayAssignment.address}</p>
                    )}
                  </div>

                  {/* Stat chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {todayAssignment.time && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium tabular-nums">
                        {todayAssignment.time}
                      </span>
                    )}
                    {todayAssignment.workers && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium tabular-nums">
                        {todayAssignment.workers} workers
                      </span>
                    )}
                    {todayAssignment.devices && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium tabular-nums">
                        {todayAssignment.devices} devices
                      </span>
                    )}
                    {todayAssignment.shifts && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium">
                        {todayAssignment.shifts} shift{todayAssignment.shifts > 1 ? "s" : ""}
                      </span>
                    )}
                    {todayAssignment.industry && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium">
                        {todayAssignment.industry}
                      </span>
                    )}
                    {todayAssignment.assignedOperators && todayAssignment.assignedOperators.length > 0 && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium tabular-nums">
                        {todayAssignment.assignedOperators.length} operator{todayAssignment.assignedOperators.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {todayAssignment.deliveryServices && todayAssignment.deliveryServices.length > 0 && (
                      <span className="inline-flex items-center h-6 px-2 bg-muted text-[11px] font-medium tabular-nums">
                        {todayAssignment.deliveryServices.length} delivery leg{todayAssignment.deliveryServices.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {todayAssignment.status === "confirmed" && (
                      <span className="inline-flex items-center h-6 px-2 bg-green-500/15 text-green-700 dark:text-green-400 text-[11px] font-semibold">
                        Confirmed
                      </span>
                    )}
                  </div>

                  {/* POC contact */}
                  {(todayAssignment.contactName || todayAssignment.contactPhone) && (
                    <div className="mt-3 flex items-center gap-3 py-2 border-t border-border/30">
                      {todayAssignment.contactName && (
                        <span className="text-[12px] font-medium">{todayAssignment.contactName}</span>
                      )}
                      {todayAssignment.contactPhone && (
                        <a href={`tel:${todayAssignment.contactPhone}`} className="text-[12px] text-primary font-medium hover:underline">
                          {todayAssignment.contactPhone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {todayAssignment.status === "scheduled" && (
                    <div className="flex gap-3 mt-4">
                      <button
                        type="button"
                        className="flex-1 h-12 bg-primary text-primary-foreground text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                        disabled={actionLoading === todayAssignment.id}
                        onClick={() => void handleConfirm(todayAssignment.id)}
                      >
                        {actionLoading === todayAssignment.id ? <Spinner className="size-4 mx-auto" /> : typeConfig.confirmLabel}
                      </button>
                      <button
                        type="button"
                        className="flex-1 h-12 border border-border text-sm font-semibold text-muted-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                        disabled={actionLoading === todayAssignment.id}
                        onClick={() => void handleReject(todayAssignment.id)}
                      >
                        Can&apos;t Make
                      </button>
                    </div>
                  )}

                  {/* Dynamic checklist from DB */}
                  {checklist && checklist.items.length > 0 && (
                    <div className="mt-5 border border-border bg-card">
                      <div className="px-4 py-2.5 border-b border-border/30">
                        <p className="text-[11px] font-semibold uppercase tracking-wide">{checklist.title}</p>
                        {checklist.instructions && (
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{checklist.instructions}</p>
                        )}
                      </div>
                      <div className="px-4 py-2">
                        {checklist.items.map((item, i) => (
                          <label key={i} className="flex items-start gap-3 py-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checkedItems.has(i)}
                              onChange={() => setCheckedItems((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              })}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                            />
                            <span className={`text-xs leading-relaxed transition-colors ${
                              checkedItems.has(i) ? "text-muted-foreground line-through" : "text-foreground"
                            }`}>
                              {item.label}
                              {item.required && <span className="text-destructive ml-1">*</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="pt-4 pb-2">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-muted-foreground">
                    Today · {typeConfig.taskLabel}
                  </p>
                  <p className="text-sm text-muted-foreground mt-3">No {typeConfig.taskLabel.toLowerCase()} assigned for today.</p>
                </div>
              )}
            </section>

            {/* ── Stats bar ── */}
            {tabAssignments.length > 0 && (
              <section className="pb-4 animate-fade-in" style={{ animationDelay: "80ms" }}>
                <div className="flex gap-2">
                  <div className="flex-1 border border-border p-2.5 text-center">
                    <p className="text-display text-lg tracking-tight tabular-nums">{confirmedCount}</p>
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Confirmed</p>
                  </div>
                  <div className="flex-1 border border-border p-2.5 text-center">
                    <p className="text-display text-lg tracking-tight tabular-nums">{pendingCount}</p>
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Pending</p>
                  </div>
                  <div className="flex-1 border border-border p-2.5 text-center">
                    <p className="text-display text-lg tracking-tight tabular-nums">{tabAssignments.length}</p>
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Total</p>
                  </div>
                </div>
              </section>
            )}

            {/* ── Upcoming ── */}
            {upcoming.length > 0 && (
              <section className="pb-6 animate-fade-in" style={{ animationDelay: "150ms" }}>
                <h2 className="text-sm font-semibold text-foreground mb-3">Upcoming</h2>
                <div className="space-y-2">
                  {upcoming.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-border bg-card hover:bg-muted/20 transition-all text-left cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{a.site}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {a.dateLabel}{a.time ? ` · ${a.time}` : ""}
                          {a.workers ? ` · ${a.workers} workers` : ""}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide shrink-0 ml-3 ${
                        a.status === "confirmed" ? "bg-green-500/15 text-green-700 dark:text-green-400" :
                        a.status === "rejected" ? "bg-red-500/12 text-red-600 dark:text-red-400" :
                        "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                      }`}>
                        {a.status === "confirmed" ? "Confirmed" : a.status === "rejected" ? "Can't Make" : "Pending"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Assignment Detail Modal */}
      {selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">{selected.site}</DialogTitle>
            </DialogHeader>
            {selected.lat && selected.lng && (
              <div className="h-36 border border-border overflow-hidden -mx-4 -mt-2 relative">
                <LocationPreview lat={selected.lat} lng={selected.lng} theme={resolvedTheme} className="w-full h-full" />
                {selected.googleMapsUrl && (
                  <a
                    href={selected.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm px-2 py-1 text-[10px] font-medium text-primary hover:underline border border-border/50"
                  >
                    Google Maps ↗
                  </a>
                )}
              </div>
            )}
            <div className="space-y-2">
              {selected.address && (
                <DetailRow label="Address" value={selected.address} />
              )}
              <DetailRow label="Date" value={selected.dateLabel} />
              {selected.time && <DetailRow label="Time" value={selected.time} />}
              {selected.workers && <DetailRow label="Workers" value={String(selected.workers)} />}
              {selected.devices && <DetailRow label="Devices" value={String(selected.devices)} />}
              {selected.industry && <DetailRow label="Industry" value={selected.industry} />}
              {selected.contactName && <DetailRow label="POC" value={selected.contactName} />}
              {selected.contactPhone && (
                <div className="flex justify-between py-1 border-b border-border/20">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">Phone</span>
                  <a href={`tel:${selected.contactPhone}`} className="text-xs font-medium text-primary hover:underline">{selected.contactPhone}</a>
                </div>
              )}

              {selected.assignedOperators && selected.assignedOperators.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-2">
                    Operators assigned
                  </p>
                  <ul className="space-y-2">
                    {selected.assignedOperators.map((op, i) => (
                      <li
                        key={`${op.name}-${i}`}
                        className="flex flex-col gap-0.5 rounded border border-border/50 bg-muted/15 px-3 py-2"
                      >
                        <span className="text-xs font-semibold text-foreground">{op.name}</span>
                        <span className="text-[11px] text-muted-foreground">{op.role}</span>
                        {op.phone && (
                          <a href={`tel:${op.phone}`} className="text-[11px] font-medium text-primary hover:underline w-fit">
                            {op.phone}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.deliveryServices && selected.deliveryServices.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-2">
                    Delivery & logistics
                  </p>
                  <ul className="space-y-2">
                    {selected.deliveryServices.map((d, i) => (
                      <li
                        key={`${d.name}-${i}`}
                        className="rounded border border-border/50 bg-muted/10 px-3 py-2 space-y-1"
                      >
                        <p className="text-xs font-semibold text-foreground">{d.name}</p>
                        {d.serviceType && (
                          <p className="text-[11px] text-muted-foreground">{d.serviceType}</p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          {d.trackingId && (
                            <span>
                              <span className="uppercase tracking-wide opacity-80">Tracking </span>
                              <span className="font-mono text-foreground/90">{d.trackingId}</span>
                            </span>
                          )}
                          {d.eta && (
                            <span>
                              <span className="uppercase tracking-wide opacity-80">ETA </span>
                              {d.eta}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {selected.status === "scheduled" && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 h-10 bg-primary text-primary-foreground text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50"
                  disabled={actionLoading === selected.id}
                  onClick={() => { void handleConfirm(selected.id); setSelected(null); }}
                >
                  {ASSIGNMENT_TYPE_LABELS[selected.assignmentType].confirmLabel}
                </button>
                <button
                  type="button"
                  className="flex-1 h-10 border border-border text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                  disabled={actionLoading === selected.id}
                  onClick={() => { void handleReject(selected.id); setSelected(null); }}
                >
                  Can&apos;t Make
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/20">
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

