import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useRef } from "preact/hooks";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { useAiSummary, type UseAiSummaryResult } from "@/hooks/useAiSummary";
import { AiSummaryDrawer } from "./AiSummaryDrawer";
import { AiSummaryMiniChip } from "./AiSummaryMiniChip";
import { aiSummariesEnabled } from "./aiSummariesEnabled";

const AiSummaryCtx = createContext<UseAiSummaryResult | undefined>(undefined);

/**
 * Owns AI-summary state above the router, so a summary (and its chip) survives
 * navigation and can be reopened on any page. The summary belongs to the
 * community it started in; switching communities drops it.
 */
export function AiSummaryProvider({ children }: { children: ComponentChildren }) {
  const ai = useAiSummary();
  const community = useCommunity();
  const { aiSummaryWriter } = useAuth();
  const currentSlug = community?.slug ?? null;

  // Drop the summary when the community changes out from under it.
  const ownerSlug = useRef<string | null>(null);
  useEffect(() => {
    if (ai.status === "idle") {
      ownerSlug.current = null;
    } else if (ownerSlug.current === null) {
      ownerSlug.current = currentSlug;
    } else if (ownerSlug.current !== currentSlug) {
      ai.dismiss("community-switch");
    }
  }, [ai.status, ai.dismiss, currentSlug]);

  // Drawer + chip render here (fixed-position overlays) so they show on any page.
  return (
    <AiSummaryCtx.Provider value={ai}>
      {children}
      {aiSummariesEnabled(community, aiSummaryWriter) && (
        <>
          <AiSummaryDrawer ai={ai} />
          <AiSummaryMiniChip ai={ai} />
        </>
      )}
    </AiSummaryCtx.Provider>
  );
}

export function useAiSummaryContext(): UseAiSummaryResult {
  const value = useContext(AiSummaryCtx);
  if (value === undefined) {
    throw new Error(
      "useAiSummaryContext must be used within an AiSummaryProvider",
    );
  }
  return value;
}
