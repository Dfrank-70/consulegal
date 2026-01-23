"use client";

import { Message } from "./chat-interface";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { FormattedMessageContent } from "./formatted-message-content";
import { Volume2, VolumeX, UserPlus } from "lucide-react";
import { getTTS } from "@/lib/speech/tts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MessageListProps {
  messages: Message[];
  conversationId?: string | null;
  allowExpertEscalation: boolean;
  isSubscribed: boolean;
  pendingExpertCaseStatus: string | null;
}

export function MessageList({ messages, conversationId, allowExpertEscalation, isSubscribed, pendingExpertCaseStatus }: MessageListProps) {
  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "ASSISTANT") return i;
    }
    return -1;
  })();

  const lastUserIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "USER") return i;
    }
    return -1;
  })();

  const lastExpertIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m: any = messages[i];
      if (m?.role === "ASSISTANT" && m?.meta?.authorType === 'expert') return i;
    }
    return -1;
  })();

  const expertAnsweredAfterLastUser = lastExpertIndex > lastUserIndex;

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          message={message}
          history={messages.slice(0, index)}
          conversationId={conversationId}
          allowExpertEscalation={allowExpertEscalation}
          isSubscribed={isSubscribed}
          pendingExpertCaseStatus={pendingExpertCaseStatus}
          isLastAssistant={message.role === "ASSISTANT" && index === lastAssistantIndex}
          expertAnsweredAfterLastUser={expertAnsweredAfterLastUser}
        />
      ))}
    </div>
  );
}

function MessageItem({
  message,
  history,
  conversationId,
  allowExpertEscalation,
  isSubscribed,
  pendingExpertCaseStatus,
  isLastAssistant,
  expertAnsweredAfterLastUser,
}: {
  message: Message;
  history: Message[];
  conversationId?: string | null;
  allowExpertEscalation: boolean;
  isSubscribed: boolean;
  pendingExpertCaseStatus: string | null;
  isLastAssistant: boolean;
  expertAnsweredAfterLastUser: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRequestingExpert, setIsRequestingExpert] = useState(false);
  const [expertRequestSuccess, setExpertRequestSuccess] = useState(false);
  const isUser = message.role === "USER";

  const isExpertMessage = !!(!isUser && (message as any)?.meta?.authorType === 'expert');

  const hasPendingCase = pendingExpertCaseStatus === 'OPEN' || pendingExpertCaseStatus === 'WAITING_EXPERT';
  const isPendingOrJustRequested = hasPendingCase || expertRequestSuccess;
  const canShowExpertAction = !!(!isUser && !isExpertMessage && !expertAnsweredAfterLastUser && allowExpertEscalation && isSubscribed && isLastAssistant);

  const handleRequestExpert = async () => {
    if (!conversationId) {
      toast.error('Impossibile richiedere parere: conversazione non trovata');
      return;
    }

    setIsRequestingExpert(true);
    try {
      const response = await fetch('/api/cases/request-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });

      const data = await response.json();

      if (response.ok) {
        setExpertRequestSuccess(true);
        toast.success('Richiesta inviata');
      } else {
        toast.error(`${data.error}${data.details ? ` - ${data.details}` : ''}`);
      }
    } catch (error: any) {
      toast.error(`Errore di connessione: ${error.message}`);
    } finally {
      setIsRequestingExpert(false);
    }
  };

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
            : isExpertMessage
              ? "bg-secondary border-2 border-amber-400"
              : "bg-secondary"
        )}
      >
        <CardContent className="p-2.5 sm:p-4">
          <div>
            <div>
              {isExpertMessage && (
                <div className="mb-2">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Risposta dell’esperto
                  </span>
                </div>
              )}
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <FormattedMessageContent message={message} history={history} />
              )}
            </div>

            {!isUser && (
              <div className="mt-3 flex items-center justify-end gap-2">
                {canShowExpertAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestExpert}
                    disabled={isRequestingExpert || isPendingOrJustRequested}
                    className="border-green-500 text-green-600 hover:bg-green-50 cursor-pointer disabled:opacity-50"
                    title={isPendingOrJustRequested ? "Richiesta inviata (in attesa)" : "Chiedi parere all’esperto"}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isPendingOrJustRequested ? "Richiesta inviata (in attesa)" : "Chiedi parere all’esperto"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSpeak}
                  className="border-blue-500 text-blue-600 hover:bg-blue-50 cursor-pointer"
                  title={isSpeaking ? "Interrompi lettura" : "Leggi messaggio"}
                >
                  {isSpeaking ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
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
