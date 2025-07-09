"use client";

import { Message } from "./chat-interface";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FormattedMessageContent } from "./formatted-message-content";

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          history={messages.slice(0, index)}
        />
      ))}
    </div>
  );
}

function MessageItem({
  message,
  history,
}: {
  message: Message;
  history: Message[];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const isUser = message.role === "USER";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <Card
        className={cn(
          "max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary"
        )}
      >
        <CardContent className="p-3 sm:p-4">
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <FormattedMessageContent message={message} history={history} />
          )}

          {!isUser && message.tokensOut && (
            <div
              className="mt-2 text-xs opacity-70 cursor-pointer"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Nascondi dettagli" : "Mostra dettagli"} ▾

              {showDetails && (
                <div className="mt-1 space-y-1">
                  {message.tokensIn && (
                    <p>Token input: {message.tokensIn}</p>
                  )}
                  <p>Token output: {message.tokensOut}</p>
                  {message.llmProvider && (
                    <p>Provider: {message.llmProvider}</p>
                  )}
                  <p>
                    Ora: {new Date(message.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
