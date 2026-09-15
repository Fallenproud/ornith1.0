/**
 * ULTIMATE ORNITH 1.0 — OAuth2 Authentication & Identity Modal
 */

import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  LogIn,
  LogOut,
  X,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Sparkles,
  Server,
  Fingerprint,
} from "lucide-react";
import { AuthUser, OAuthProviderType } from "../types";
import {
  signInWithGoogleOAuth,
  signInWithGithubOAuth,
  createDevOAuthSession,
  signOutAuth,
} from "../lib/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onAuthSuccess: (user: AuthUser) => void;
  onSignOut: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onSignOut,
}) => {
  const [loadingProvider, setLoadingProvider] =
    useState<OAuthProviderType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoadingProvider("google");
      setErrorMsg(null);
      const user = await signInWithGoogleOAuth();
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      console.error("Google OAuth feilet:", err);
      setErrorMsg(
        err.message || "Kunne ikke fullføre Google OAuth-autentisering",
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGithubSignIn = async () => {
    try {
      setLoadingProvider("github");
      setErrorMsg(null);
      const user = await signInWithGithubOAuth();
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      console.error("GitHub OAuth feilet:", err);
      setErrorMsg(
        err.message || "Kunne ikke fullføre GitHub OAuth-autentisering",
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleQuickDevSignIn = () => {
    setLoadingProvider("dev-session");
    setErrorMsg(null);
    const user = createDevOAuthSession(
      "google",
      "mrevensen94@gmail.com",
      "M. Revensen",
    );
    onAuthSuccess(user);
    setLoadingProvider(null);
    onClose();
  };

  const handleLogout = async () => {
    await signOutAuth();
    onSignOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#141414] shadow-2xl shadow-black/80">
        {/* Header decoration banner */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8F2BFF] to-[#39D9E6] text-white shadow-lg shadow-[#8F2BFF]/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {currentUser
                  ? "Brukerprofil & Sikkerhet"
                  : "API Gateway Autentisering"}
              </h2>
              <p className="text-[11px] text-[#A3A3A0]">
                {currentUser
                  ? "Bekreftet OAuth2 sesjon aktiv"
                  : "Beskyttede TinyML og AI-endepunkter"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#A3A3A0] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#FF4E4E]/30 bg-[#FF4E4E]/10 p-3 text-xs text-[#FF8585]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF4E4E]" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {currentUser ? (
            /* Authenticated User Profile View */
            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#191918] p-4">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || "Bruker"}
                    className="h-12 w-12 rounded-full border border-[#8F2BFF]/40 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8F2BFF]/20 font-bold text-[#39D9E6]">
                    {(currentUser.displayName ||
                      currentUser.email ||
                      "U")[0].toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate font-semibold text-white text-sm">
                      {currentUser.displayName || "Navnløs bruker"}
                    </h3>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#77F23B]" />
                  </div>
                  <p className="truncate text-xs text-[#A3A3A0]">
                    {currentUser.email || "Ingen e-post registrert"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-[#8F2BFF]/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#B25CFF] uppercase">
                      {currentUser.provider}
                    </span>
                    <span className="rounded bg-[#77F23B]/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#77F23B]">
                      Verifisert Bearer Token
                    </span>
                  </div>
                </div>
              </div>

              {/* Endpoint Protection Scope Info */}
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111110] p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium text-[#E0E0DE]">
                  <Lock className="h-3.5 w-3.5 text-[#39D9E6]" />
                  <span>Beskyttede Ressurser Aktivert</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#A3A3A0] pt-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-[#77F23B]" />
                    <span>POST /api/training/*</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-[#77F23B]" />
                    <span>POST /api/ai/chat</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-[#77F23B]" />
                    <span>POST /api/datasets/*</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-[#77F23B]" />
                    <span>POST /api/projects/*</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF4E4E]/30 bg-[#FF4E4E]/10 py-2.5 text-xs font-semibold text-[#FF8585] transition-colors hover:bg-[#FF4E4E]/20"
              >
                <LogOut className="h-4 w-4" />
                <span>Logg ut av sesjon</span>
              </button>
            </div>
          ) : (
            /* Unauthenticated OAuth2 Providers Selection */
            <div className="space-y-4">
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#191918] p-3 text-xs leading-relaxed text-[#A3A3A0]">
                Få tilgang til sensitive API gateway endepunkter, TinyML-trening
                og AI-resonnering ved å bekrefte identitet med en
                OAuth2-tilbyder.
              </div>

              <div className="space-y-2.5 pt-1">
                {/* Google OAuth2 Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loadingProvider !== null}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1F1F1E] py-3 text-xs font-semibold text-white shadow transition-all hover:border-[#8F2BFF]/50 hover:bg-[#282826] disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {loadingProvider === "google"
                      ? "Autentiserer med Google..."
                      : "Logg inn med Google OAuth"}
                  </span>
                </button>

                {/* GitHub OAuth2 Button */}
                <button
                  onClick={handleGithubSignIn}
                  disabled={loadingProvider !== null}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[#1F1F1E] py-3 text-xs font-semibold text-white shadow transition-all hover:border-[#39D9E6]/50 hover:bg-[#282826] disabled:opacity-60"
                >
                  <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>
                    {loadingProvider === "github"
                      ? "Autentiserer med GitHub..."
                      : "Logg inn med GitHub OAuth"}
                  </span>
                </button>

                {/* Quick Development Session button for local sandbox environment */}
                <div className="pt-2">
                  <button
                    onClick={handleQuickDevSignIn}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#8F2BFF]/30 bg-[#8F2BFF]/10 py-2.5 text-xs font-semibold text-[#B25CFF] transition-all hover:border-[#8F2BFF]/60 hover:bg-[#8F2BFF]/20"
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    <span>
                      Hurtig verifisert sesjon (mrevensen94@gmail.com)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
