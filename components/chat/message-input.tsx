"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  onInputChange?: () => void; // Aggiunta nuova prop opzionale
}

export function MessageInput({ onSend, isLoading, disabled, onInputChange }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSend(message);
      setMessage("");
      // Focus back to the textarea
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter without Shift
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex space-x-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (onInputChange) {
              onInputChange(); // Chiama la callback se fornita
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi il tuo messaggio..."
          className="flex-1 min-h-[60px] resize-none"
          disabled={isLoading || disabled}
        />
        <div className="flex flex-col space-y-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={true} // Disabilitato in questa versione MVP
            title="Carica documento (presto disponibile)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || isLoading || disabled}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Premi Invio per inviare, Shift+Invio per andare a capo
      </p>
    </div>
  );
}
