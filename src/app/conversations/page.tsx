"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { ConversationList } from "@/components/conversations/ConversationList";
import { ConversationThread } from "@/components/conversations/ConversationThread";
import { conversations, messages } from "@/data/mock";

export default function ConversationsPage() {
  const [activeConvId, setActiveConvId] = useState(conversations[0]?.id);
  const activeConv = conversations.find((c) => c.id === activeConvId);
  const activeMessages = messages.filter((m) => m.conversationId === activeConvId);

  return (
    <div className="flex h-full">
      {/* Conversation list — left panel */}
      <div className="w-[340px] border-r border-border-subtle bg-surface-1/30 shrink-0 flex flex-col h-full overflow-hidden">
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={setActiveConvId}
        />
      </div>

      {/* Thread — center */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {activeConv ? (
          <ConversationThread
            conversation={activeConv}
            messages={activeMessages}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessagesSquare className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">Selectionnez une conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
