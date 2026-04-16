"use client";
import BackButton from "@/components/global/BackButton";

export default function PrivacyPage() {
  const lastUpdated = "April 2026";

  return (
    <div className="min-h-screen bg-sp-bg text-sp-text font-dm px-5 pt-6 pb-20 space-y-8 max-w-105 mx-auto">
      <BackButton />
      <div className="space-y-1">
        <p className="text-[11px] tracking-widest text-sp-muted uppercase">
          Legal
        </p>
        <h1 className="font-barlow font-extrabold text-[38px] leading-none tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-sp-muted pt-1">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="space-y-4 text-sm text-sp-muted leading-relaxed">
        {[
          {
            title: "What we collect",
            body: "We collect your name, email address, and the equipment you train with. If you sign in with Google, we receive your name, email, and profile photo from Google. We also collect data about your workout sessions, exercises completed, sets, reps, and session duration, to power your progress tracking.",
          },
          {
            title: "How we use your data",
            body: "Your data is used exclusively to run the app. We use it to personalise your training programs, track your progress, maintain your streak, and improve your experience. We do not sell your data. We do not share it with third parties for advertising purposes.",
          },
          {
            title: "Authentication",
            body: "Passwords are hashed using bcrypt before being stored, we never store your plain-text password. If you use Google sign-in, your password is managed entirely by Google and never touches our servers.",
          },
          {
            title: "Session data",
            body: "We use secure, HTTP-only JWT cookies to keep you signed in. These cookies cannot be accessed by JavaScript and are cleared when you sign out.",
          },
          {
            title: "Third-party services",
            body: "We use Supabase to store your data securely in a PostgreSQL database hosted in the EU. We use Google OAuth for sign-in. These services have their own privacy policies which govern how they handle data.",
          },
          {
            title: "Data retention",
            body: "Your data is retained for as long as your account is active. If you request account deletion, all your personal data and workout history will be permanently removed within 30 days.",
          },
          {
            title: "Your rights",
            body: "You have the right to access the data we hold about you, request corrections, or request deletion of your account and all associated data. To exercise these rights, use the contact information on Help section.",
          },
          {
            title: "Contact",
            body: "If you have any questions about this privacy policy or how your data is handled, please reach out through the Help section of the app.",
          },
        ].map(({ title, body }) => (
          <div
            key={title}
            className="bg-sp-surface border border-sp-border rounded-2xl p-5 space-y-2"
          >
            <h2 className="font-barlow font-bold text-base text-sp-text">
              {title}
            </h2>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
