"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Edit3 } from "lucide-react";

export type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
  tokensIn?: number | null;
  tokensOut?: number | null;
  llmProvider?: string | null;
  meta?: any;
};

interface ChatInterfaceProps {
  selectedConversationId?: string | null;
  isSubscribed: boolean;
}

export function ChatInterface({ selectedConversationId, isSubscribed }: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubscriptionAlert, setShowSubscriptionAlert] = useState(!isSubscribed);
  const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [allowExpertEscalation, setAllowExpertEscalation] = useState(false);
  const [pendingExpertCaseStatus, setPendingExpertCaseStatus] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewConversation = async () => {
    if (!isSubscribed) {
      setShowSubscriptionAlert(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nuova Consulenza' }),
      });

      if (!response.ok) {
        throw new Error('Errore nella creazione della nuova consulenza');
      }

      const newConversation = await response.json();
      router.push(`/dashboard?conversationId=${newConversation.id}`);
      router.refresh();

      setCurrentConversationId(newConversation.id);
      setConversationTitle(newConversation.title);
      setMessages([]);
      setTokenCount({ input: 0, output: 0 });
      setAllowExpertEscalation(false);
      setPendingExpertCaseStatus(null);
      setEditableTitle(newConversation.title);
      setIsEditingTitle(true);

    } catch (err: any) {
      setError(err.message || 'Impossibile creare una nuova consulenza.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setShowSubscriptionAlert(!isSubscribed);
  }, [isSubscribed]);

  useEffect(() => {
    const loadConversation = async () => {
      if (!isSubscribed) {
        setMessages([]);
        setCurrentConversationId(null);
        setConversationTitle("Nuova Consulenza");
        setError(null);
        return;
      }

      if (selectedConversationId) {
        setIsLoading(true);
        setError(null);
        try {
          const messagesResponse = await fetch(`/api/chat?conversationId=${selectedConversationId}`);
          if (!messagesResponse.ok) {
            const errorData = await messagesResponse.json().catch(() => null);
            throw new Error(errorData?.error || 'Impossibile caricare i messaggi.');
          }
          const loadedData: any = await messagesResponse.json();
          const loadedMessages: Message[] = Array.isArray(loadedData) ? loadedData : (loadedData.messages || []);
          setAllowExpertEscalation(!!(Array.isArray(loadedData) ? false : loadedData.allowExpertEscalation));
          setPendingExpertCaseStatus(Array.isArray(loadedData) ? null : (loadedData.pendingExpertCaseStatus ?? null));

          const convDetailsResponse = await fetch(`/api/conversations?id=${selectedConversationId}`);
          let title = `Consulenza ID: ${selectedConversationId.substring(0, 8)}...`;
          if (convDetailsResponse.ok) {
            const convDetails = await convDetailsResponse.json();
            title = convDetails.title || `Consulenza del ${new Date(loadedMessages[0]?.createdAt || Date.now()).toLocaleDateString()}`;
          }

          setMessages(loadedMessages.map((m: any) => ({ ...m, createdAt: new Date(m.createdAt) })));
          setCurrentConversationId(selectedConversationId);
          setConversationTitle(title);

          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          loadedMessages.forEach((msg: Message) => {
            totalInputTokens += msg.tokensIn || 0;
            totalOutputTokens += msg.tokensOut || 0;
          });
          setTokenCount({ input: totalInputTokens, output: totalOutputTokens });

        } catch (err: any) {
          setError(err.message || "Impossibile caricare la conversazione.");
          setMessages([]);
          setCurrentConversationId(null);
          setConversationTitle(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setMessages([]);
        setCurrentConversationId(null);
        setConversationTitle("Nuova Consulenza");
        setError(null);
        setTokenCount({ input: 0, output: 0 });
        setAllowExpertEscalation(false);
        setPendingExpertCaseStatus(null);
        setIsLoading(false);
      }
    };

    loadConversation();
  }, [selectedConversationId, isSubscribed]);

  const handleTitleClick = () => {
    if (currentConversationId) {
      setEditableTitle(conversationTitle || "");
      setIsEditingTitle(true);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableTitle(e.target.value);
  };

  const saveConversationTitle = async () => {
    if (!currentConversationId || !editableTitle.trim() || editableTitle.trim() === conversationTitle) {
      setIsEditingTitle(false);
      return;
    }
    const oldTitle = conversationTitle;
    setIsEditingTitle(false);
    try {
      const response = await fetch(`/api/conversations/${currentConversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editableTitle.trim() }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Errore durante l\'aggiornamento del titolo.');
        setConversationTitle(oldTitle);
        return;
      }
      const data = await response.json();
      setConversationTitle(data.title);
      router.refresh();
    } catch (error) {
      setError('Errore di rete durante l\'aggiornamento del titolo.');
      setConversationTitle(oldTitle);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveConversationTitle();
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditableTitle(conversationTitle || "");
    }
  };
  
  const handleSubmit = async (content: string, file?: File) => {
    if (!isSubscribed) {
      setShowSubscriptionAlert(true);
      return;
    }
    if (!content.trim() && !file) return;

    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: content + (file ? `\n\n--- Allegato: ${file.name} ---` : ""),
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const formData = new FormData();
      formData.append("message", content);
      if (currentConversationId) {
        formData.append("conversationId", currentConversationId);
      }
      if (file) {
        formData.append("file", file);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        let errorData;
        let errorMessageText = "Si è verificato un errore.";
        try {
          errorData = await response.json();
          if (errorData?.error === 'file_parse_failed' && typeof errorData?.details === 'string' && errorData.details.trim()) {
            errorMessageText = errorData.details;
          } else {
            errorMessageText = errorData?.error || errorMessageText;
          }
        } catch (jsonError) { /* Ignore */ }
        
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));

        if (errorMessageText.includes("Nessun abbonamento attivo")) {
          setShowSubscriptionAlert(true);
          setError(null);
        } else {
          setError(errorMessageText);
        }
        return;
      }
      
      const data = await response.json();

      if (!currentConversationId && data.conversationId) {
        setCurrentConversationId(data.conversationId);
        setConversationTitle(data.title || `Consulenza del ${new Date().toLocaleDateString("it-IT")}`);
        router.push(`/dashboard?conversationId=${data.conversationId}`, { scroll: false });
        router.refresh();
      }

      setAllowExpertEscalation(!!data.allowExpertEscalation);
      setPendingExpertCaseStatus(data.pendingExpertCaseStatus ?? null);
      
      const assistantMessage: Message = {
        id: data.messageId || `assistant-${Date.now()}`,
        role: "ASSISTANT",
        content: data.content,
        createdAt: new Date(),
        tokensIn: data.tokensIn,
        tokensOut: data.tokensOut,
        llmProvider: data.llmProvider,
      };
      
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== userMessage.id), 
        { ...userMessage, id: data.userMessageId || userMessage.id },
        assistantMessage
      ]);
      
      setTokenCount((prev) => ({
        input: prev.input + (data.tokensIn || 0),
        output: prev.output + (data.tokensOut || 0)
      }));
      
    } catch (networkError) {
      const errorMsg = networkError instanceof Error ? networkError.message : "Errore di connessione di rete.";
      setError(errorMsg);
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 border-b">
        {isEditingTitle ? (
          <input 
            type="text"
            value={editableTitle}
            onChange={handleTitleChange}
            onBlur={saveConversationTitle}
            onKeyDown={handleTitleKeyDown}
            className="text-xl font-semibold bg-transparent border-b border-primary focus:outline-none"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2 cursor-pointer group min-w-0" onClick={handleTitleClick}>
            <h1 className="text-lg sm:text-xl font-semibold truncate">
              {conversationTitle || "Nuova Consulenza"}
            </h1>
            {currentConversationId && (
              <Edit3 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            <span className="mr-2">Token: {tokenCount.input + tokenCount.output}</span>
            <span className="text-xs">(In: {tokenCount.input} / Out: {tokenCount.output})</span>
          </div>
          <Button variant="outline" size="sm" onClick={startNewConversation} className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Nuova Conversazione</span>
            <span className="sm:hidden">Nuova</span>
          </Button>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 space-y-4">
        {showSubscriptionAlert ? (
          <Alert variant="destructive" className="mb-4">
            <Terminal className="w-4 h-4" />
            <AlertTitle>Nessun Abbonamento Attivo</AlertTitle>
            <AlertDescription>
              Per iniziare una nuova conversazione, è necessario un abbonamento attivo.
              <Button asChild variant="link" className="p-0 pl-1 h-auto">
                <Link href="/dashboard/plans">Vedi i Piani</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {messages.length === 0 && !isLoading && !error && !showSubscriptionAlert && (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Benvenuto nella Consulenza Legale AI</h2>
            <p className="mb-4 text-muted-foreground">
              Inizia una conversazione con il nostro assistente legale per ricevere consulenza o seleziona una consulenza passata.
            </p>
          </Card>
        )}

        {messages.length === 0 && !isLoading && error && (
           <Alert variant="destructive" className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Errore nel Caricamento</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        <MessageList
          messages={messages}
          conversationId={currentConversationId}
          allowExpertEscalation={allowExpertEscalation}
          isSubscribed={isSubscribed}
          pendingExpertCaseStatus={pendingExpertCaseStatus}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 sm:p-4 border-t">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <Terminal className="w-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <MessageInput 
          onSend={handleSubmit} 
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
