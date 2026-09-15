/**
 * ULTIMATE ORNITH 1.0 — User Authentication Badge Component
 */

import React from "react";
import { Shield, ShieldCheck, Lock, LogIn, ChevronDown } from "lucide-react";
import { AuthUser } from "../types";

interface UserAuthBadgeProps {
  user: AuthUser | null;
  onOpenAuthModal: () => void;
}

export const UserAuthBadge: React.FC<UserAuthBadgeProps> = ({
  user,
  onOpenAuthModal,
}) => {
  if (!user) {
    return (
      <button
        onClick={onOpenAuthModal}
        className="flex items-center gap-2 rounded-lg border border-[#8F2BFF]/40 bg-[#8F2BFF]/10 px-2.5 py-1.5 text-xs font-semibold text-[#B25CFF] shadow-sm transition-all hover:border-[#8F2BFF]/80 hover:bg-[#8F2BFF]/20"
        title="Logg inn med Google eller GitHub for å låse opp beskyttede API-endepunkter"
      >
        <Lock className="h-3.5 w-3.5 text-[#39D9E6]" />
        <span>Autentiser</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpenAuthModal}
      className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#191918] px-2.5 py-1 text-xs text-white transition-colors hover:border-[#8F2BFF]/50 hover:bg-[#242422]"
      title={`Logget inn som ${user.displayName || user.email} (${user.provider})`}
    >
      {user.photoURL ? (
        <img
          src={user.photoURL}
          alt={user.displayName || "Bruker"}
          className="h-5 w-5 rounded-full border border-[#8F2BFF]/50 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8F2BFF]/30 font-mono text-[10px] font-bold text-[#39D9E6]">
          {(user.displayName || user.email || "U")[0].toUpperCase()}
        </div>
      )}
      <div className="flex flex-col text-left">
        <span className="max-w-[100px] truncate text-[11px] font-medium leading-tight">
          {user.displayName || user.email?.split("@")[0] || "Bruker"}
        </span>
      </div>
      <ShieldCheck className="h-3.5 w-3.5 text-[#77F23B]" />
      <ChevronDown className="h-3 w-3 text-[#A3A3A0]" />
    </button>
  );
};
