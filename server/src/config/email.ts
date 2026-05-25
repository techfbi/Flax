// src/config/email.ts
import { Resend } from "resend";
import { env } from "./env.js";

export const resend = new Resend(env.RESEND_API_KEY);

// Sends the password reset email containing the one-time raw token in link and hashed on arrival before we check db.
export const sendPasswordResetEmail = async (toEmail: string, displayName: string, rawToken: string): Promise<void> => {
  // The reset link points to frontend reset page with the token as a query param.
  // The frontend extracts the token and sends it to POST /api/auth/reset-password.
  const resetLink = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: "Nutridec <onboarding@resend.dev>", // Mail for testing with Resend, change to real email later
    to: toEmail,
    subject: "Reset your Nutridec password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password reset request</h2>
        <p>Hi ${displayName},</p>
        <p>We received a request to reset your password. 
           Click the button below to set a new password.</p>
        <a href="${resetLink}"
           style="display: inline-block; padding: 12px 24px; background: #4F46E5;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          Reset password
        </a>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request a password reset, ignore this email. 
           Your password will not change.</p>
        <p>For security, do not share this link with anyone.</p>
      </div>
    `,
  });

  if (error) {
    // The forgot email endpoint willalways return 200 to avoid account enumeration, so I log the error here for debugging but do not throw.
    console.error("Failed to send password reset email.", error);
  }
};

//-------------------------------------------------------------------------------------------------------------------------------------------------
// Sends the 6-digit OTP to verify email ownership during registration.
export const sendOtpEmail = async ( toEmail: string, displayName: string, otp: string): Promise<void> => {

  const { error } = await resend.emails.send({
    from: "Nutridec <onboarding@resend.dev>", // Mail for testing with Resend, change to real email later
    to: toEmail,
    subject: "Your Nutridec verification code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Verify your email address</h2>
        <p>Hi ${displayName},</p>
        <p>Enter the code below to complete your registration.</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                    background: #F3F4F6; padding: 24px; text-align: center;
                    border-radius: 8px; margin: 24px 0;">
          ${otp}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not create a Nutridec account, ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send OTP email.", error);
  }
};