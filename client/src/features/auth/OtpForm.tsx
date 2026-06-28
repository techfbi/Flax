import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import type { ApiResponse, LoginData } from "@/types/apiTypes";
import { handleApiError } from "@/utils/handleApiError";

/**
 * OTP verification screen.
 * Only shown when register returns { requiresVerification: true }.
 * Dev environment has REQUIRE_EMAIL_VERIFICATION=false, so this screen
 * won't appear in local development unless toggled.
 *
 * UX:
 * - 6 individual digit inputs. Auto-advances on each digit entry.
 * - Backspace on empty input moves focus back.
 * - Paste of 6-digit string fills all inputs at once.
 * - "Send new otp" triggers POST /api/auth/resend-otp and resets inputs.
 *
 * Left panel deliberately has no text body per the design.
 */
const OtpForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  // pendingId and email are passed via router state from RegisterForm
  const { pendingId, email } = (location.state ?? {}) as {
    pendingId?: number;
    email?: string;
  };

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [apiError, setApiError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  // Redirect to register if arrived without pendingId (direct URL access)
  useEffect(() => {
    if (!pendingId) navigate("/register", { replace: true });
  }, [pendingId, navigate]);

  const handleChange = (index: number, value: string) => {
    // Only accept single digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      // Move back if current input is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = digits.join("");
    if (otp.length < 6) {
      setApiError("Enter the full 6-digit code");
      return;
    }
    setApiError("");
    setIsSubmitting(true);
    try {
      const { data } = await api.post<ApiResponse<LoginData>>(
        "/api/auth/verify-otp",
        {
          pendingId,
          otp,
        },
      );
      setAuth(data.data.user, data.data.accessToken);
      navigate("/onboarding");
    } catch (err: unknown) {
      setApiError(handleApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingId) return;
    setResendLoading(true);
    setResendSuccess(false);
    setApiError("");
    try {
      await api.post("/api/auth/resend-otp", { pendingId });
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      setResendSuccess(true);
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { message?: string }; status?: number };
      };
      // Check if it's a 500 error
      if (error?.response?.status === 500) {
        setApiError(handleApiError(err));
      } else {
        // Use the API message or fallback
        setApiError(
          error?.response?.data?.message ?? "Could not resend. Try again",
        );
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout
      panelHeading={
        // Light: moringa. Dark: dark-white. Per design.
        <span>
          Check your {"\n"}
          <span className="block">
            E-mail <span className="text-pawpaw dark:text-black-pawpaw">!</span>
          </span>
        </span>
      }
      panelItems={[]} // intentionally empty per the design
    >
      {/* Error */}
      {apiError && (
        <p
          className="text-sm text-rose-500 dark:text-rose-700 text-center mb-5"
          role="alert"
        >
          {apiError}
        </p>
      )}
      {resendSuccess && (
        <p className="text-sm text-moringa dark:text-moringa-faded text-center mb-5">
          New code sent.
        </p>
      )}

      {/* Instruction */}
      <div className="mb-6">
        <p className="font-heading font-medium text-sm text-cocoa dark:text-dark-white mb-2">
          Enter the 6-digit code we sent to
        </p>
        <p className="font-heading text-sm font-medium text-cocoa-faded">
          {email ?? "your email"}
        </p>
      </div>

      {/* 6 digit inputs */}
      <div className="flex gap-2 justify-start mb-6" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-full h-12 md:mx-[3.5px] text-center text-base font-semibold rounded-lg
                       border border-cocoa/20 dark:border-dark-white/20
                       bg-transparent text-cocoa dark:text-dark-white
                       focus:border-moringa-faded focus:ring-1 focus:ring-moringa-faded/50
                       outline-none transition-colors"
            aria-label={`Digit ${i + 1} of 6`}
          />
        ))}
      </div>

      <Button
        variant="primary"
        fullWidth
        loading={isSubmitting}
        onClick={handleVerify}
      >
        Verify
      </Button>

      <p className="text-sm text-cocoa dark:text-dark-white mt-4">
        Didn't get it?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading}
          className="font-semibold hover:text-moringa dark:hover:text-moringa-faded transition-colors disabled:opacity-50"
        >
          {resendLoading ? "Sending..." : "Send new otp"}
        </button>
      </p>
    </AuthLayout>
  );
};

export default OtpForm;
