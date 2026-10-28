"use client";

// Saved AI advisor sessions. Before these existed, "Mulai Baru" wiped the
// transcript with nothing behind it — the chat endpoint is stateless and the
// conversation lived only in React state, so a reload lost it outright.
//
// Sessions are stored server-side and scoped to the member who held them (see
// the API's AiConversationService), which is why this is a query against the
// API rather than a localStorage list: the same account on a second device
// sees the same history, and one member never sees another's.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/hooks/use-locale";
import { showDelayedUndoToast } from "@/components/wm/undo-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  truncated: boolean;
  createdAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
};

export function useAiConversations() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const pendingDeletes = useRef(new Map<string, () => void>());
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? null;
  const queryClient = useQueryClient();

  // Not in lib/query-keys.ts (protected path) — inline, mirroring the same
  // choice use-ai-key.ts already made for the sibling ai-key query.
  const queryKey = ["family-groups", familyGroupId, "ai-conversations"];

  const { data, isLoading, isError } = useQuery<ConversationSummary[]>({
    queryKey,
    queryFn: () =>
      apiFetch<ConversationSummary[]>(
        `/family-groups/${familyGroupId}/ai-advisor/conversations`,
        { token },
      ),
    enabled: Boolean(familyGroupId && token),
  });

  const remove = useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<void>(
        `/family-groups/${familyGroupId}/ai-advisor/conversations/${conversationId}`,
        { method: "DELETE", token },
      ),
    onSuccess: (_data, id) => {
      // A successful DELETE must not depend on a successful follow-up GET.
      queryClient.setQueryData<ConversationSummary[]>(queryKey, (old) =>
        old?.filter((conversation) => conversation.id !== id),
      );
      return queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      // Leaving this account cancels requests that have not started yet.
      for (const undo of pending.values()) undo();
      pending.clear();
    };
  }, [familyGroupId, token]);

  function deleteConversation(id: string) {
    if (pendingDeletes.current.has(id)) return;
    setHiddenIds((old) => new Set(old).add(id));
    const restore = () => {
      pendingDeletes.current.delete(id);
      setHiddenIds((old) => {
        const next = new Set(old);
        next.delete(id);
        return next;
      });
    };
    const cancel = showDelayedUndoToast({
      message: t.ai.historyDeleted,
      undoLabel: t.common.undo,
      onUndo: restore,
      commit: async () => {
        try {
          await remove.mutateAsync(id);
        } finally {
          restore();
        }
      },
      onError: () => toast.error(t.ai.historyDeleteFailed),
    });
    pendingDeletes.current.set(id, cancel);
  }

  /** Loads one session's full transcript on demand. Not a `useQuery` per row:
   *  the list can be long and only the row the user clicks is ever needed. */
  async function fetchConversation(
    conversationId: string,
  ): Promise<ConversationDetail> {
    return apiFetch<ConversationDetail>(
      `/family-groups/${familyGroupId}/ai-advisor/conversations/${conversationId}`,
      { token },
    );
  }

  /** Called after a chat turn is filed server-side, so a session that was
   *  just created appears in the list without a manual refresh. */
  function refresh() {
    void queryClient.invalidateQueries({ queryKey });
  }

  return {
    conversations: (data ?? []).filter(
      (conversation) => !hiddenIds.has(conversation.id),
    ),
    isLoading,
    isError,
    deleteConversation,
    isDeleting: remove.isPending,
    fetchConversation,
    refresh,
  };
}
