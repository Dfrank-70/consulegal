"use client";

import { Message } from "./chat-interface";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { FormattedMessageContent } from "./formatted-message-content";
import { Volume2, VolumeX } from "lucide-react";
import { getTTS } from "@/lib/speech/tts";
import { Button } from "@/components/ui/button";

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.role === "USER";

  // Cleanup: ferma audio quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        const tts = getTTS();
        tts.stop();
      }
    };
  }, [isSpeaking]);

  const handleSpeak = async () => {
    const tts = getTTS();
    
    if (!tts.isSupported()) {
      alert('Il tuo browser non supporta la sintesi vocale');
      return;
    }

    if (isSpeaking) {
      tts.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    
    try {
      // Rimuovi la sezione note dal testo da leggere
      const textToSpeak = message.content
        .replace(/\n\s*\*?\*?Notes?:[\s\S]*/i, '')
        .replace(/[\(\[]nota\s+\d+[\)\]]/gi, '')
        .trim();
      
      // iOS (Safari, Chrome, Firefox su iPhone) interpreta rate diversamente
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const rate = isIOS ? 1.05 : 1.20;
      
      await tts.speak(textToSpeak, { rate });
    } catch (error) {
      // Ignora errori "interrupted" che sono normali quando l'utente ferma manualmente
      if (error instanceof Error && !error.message.includes('interrupted')) {
        console.error('TTS error:', error);
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <Card
        className={cn(
          "max-w-[95%] sm:max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary"
        )}
      >
        <CardContent className="p-2.5 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <FormattedMessageContent message={message} history={history} />
              )}
            </div>
            {!isUser && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpeak}
                className="shrink-0 h-10 w-10 sm:h-8 sm:w-8 p-0 border-blue-500 text-blue-600 hover:bg-blue-50 cursor-pointer"
                title={isSpeaking ? "Interrompi lettura" : "Leggi messaggio"}
              >
                {isSpeaking ? (
                  <VolumeX className="h-5 w-5 sm:h-4 sm:w-4" />
                ) : (
                  <Volume2 className="h-5 w-5 sm:h-4 sm:w-4" />
                )}
              </Button>
            )}
          </div>

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
