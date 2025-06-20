"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation"; // Import useRouter
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, Edit3 } from "lucide-react"; // Added Edit3 icon

export type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: Date;
  tokensIn?: number | null;
  tokensOut?: number | null;
  llmProvider?: string | null;
};

interface ChatInterfaceProps {
  selectedConversationId?: string | null;
}

export function ChatInterface({ selectedConversationId }: ChatInterfaceProps) {
  const router = useRouter(); // Initialize useRouter
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setConversationTitle(null);
    setTokenCount({ input: 0, output: 0 });
    setError(null);
    // Consider updating URL to /dashboard if not handled by parent
    // if (window.location.search.includes("conversationId")) {
    //   window.history.pushState({}, '', '/dashboard');
    // }
  };

  useEffect(() => {
    if (selectedConversationId) {
      if (selectedConversationId === currentConversationId) return; // Evita ricaricamenti inutili

      const fetchConversationMessages = async () => {
        setIsLoading(true);
        setError(null);
        setMessages([]);
        setTokenCount({ input: 0, output: 0 });

        try {
          const response = await fetch(`/api/chat?conversationId=${selectedConversationId}`);
          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch (e) { /* no-op */ }
            throw new Error(errorData?.error || `Errore ${response.status} nel caricamento della conversazione.`);
          }
          const loadedMessages: Message[] = await response.json();
          
          // Fetch conversation details (including title) separately or assume passed as prop
          // This is a placeholder for fetching title. Ideally, title comes from parent or a dedicated API call.
          try {
            const convDetailsResponse = await fetch(`/api/conversations?id=${selectedConversationId}`);
            if (convDetailsResponse.ok) {
              const convDetails = await convDetailsResponse.json();
              // The API should return a single conversation object when an ID is provided
              setConversationTitle(convDetails.title || `Consulenza del ${new Date(loadedMessages[0]?.createdAt || Date.now()).toLocaleDateString()}`);
            } else {
               // Fallback title in case of error
              setConversationTitle(`Consulenza ID: ${selectedConversationId.substring(0,8)}...`);
            }
          } catch (titleError) {
            console.error("Errore nel recupero del titolo conversazione:", titleError);
            setConversationTitle(`Consulenza ID: ${selectedConversationId.substring(0,8)}...`);
          }

          setMessages(loadedMessages.map(m => ({...m, createdAt: new Date(m.createdAt) })));
          setCurrentConversationId(selectedConversationId);

          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          loadedMessages.forEach(msg => {
            totalInputTokens += msg.tokensIn || 0;
            totalOutputTokens += msg.tokensOut || 0;
          });
          setTokenCount({ input: totalInputTokens, output: totalOutputTokens });

        } catch (err: any) {
          setError(err.message || "Impossibile caricare i messaggi della conversazione.");
          setCurrentConversationId(null);
          setConversationTitle(null);
        } finally {
          setIsLoading(false);
        }
      };
      fetchConversationMessages();
    } else {
      // Se selectedConversationId è null/undefined e non c'è già una conversazione attiva (nuova), resetta.
      if (currentConversationId !== null) { // Evita di chiamare startNewConversation se è già una nuova chat
        startNewConversation();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

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
    // setConversationTitle(editableTitle.trim()); // Optimistic update spostato o gestito dalla risposta API
    setIsEditingTitle(false);
    console.log('[ChatInterface] saveConversationTitle: Attempting to save title for', currentConversationId);

    try {
      const response = await fetch(`/api/conversations/${currentConversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editableTitle.trim() }),
      });

      console.log('[ChatInterface] saveConversationTitle: Response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[ChatInterface] saveConversationTitle: Failed to update title:', errorData.error);
        setError(errorData.error || 'Errore durante l\'aggiornamento del titolo.');
        setConversationTitle(oldTitle); // Rollback optimistic update
        return;
      }
      console.log('[ChatInterface] saveConversationTitle: Title updated successfully via API. Attempting router.refresh().');
      const data = await response.json(); // Ottieni l'oggetto conversazione aggiornato
      console.log('[ChatInterface] saveConversationTitle: API response data:', data);
      setConversationTitle(data.title); // Usa il titolo dalla risposta API

      // Titolo aggiornato con successo, aggiorna la lista sidebar
      console.log('[ChatInterface] saveConversationTitle: Attempting router.refresh() after successful title update from API.');
      router.refresh();
      console.log('[ChatInterface] saveConversationTitle: router.refresh() called.'); 
    } catch (error) {
      console.error('[ChatInterface] saveConversationTitle: Error updating title:', error);
      setError('Errore di rete durante l\'aggiornamento del titolo.');
      setConversationTitle(oldTitle); // Rollback optimistic update
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveConversationTitle();
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditableTitle(conversationTitle || "");
    }
  };
  
  const handleSubmit = async (content: string) => {
    if (!content.trim()) return;
    
    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, conversationId: currentConversationId }),
      });
      
      if (!response.ok) {
        let errorData;
        let errorMessageText = "Si è verificato un errore durante l'invio del messaggio.";
        try {
          errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessageText = errorData.error;
          }
        } catch (jsonError) {
          console.error("Impossibile fare il parsing JSON della risposta di errore:", jsonError);
          if (response.statusText) {
            errorMessageText = `Errore: ${response.status} - ${response.statusText}`;
          }
        }
        console.error("Errore API ricevuto:", errorMessageText, "Dettagli:", errorData || "Nessun dettaglio JSON");
        setError(errorMessageText);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        return;
      }
      
      const data = await response.json();

      if (!currentConversationId && data.conversationId) {
        setCurrentConversationId(data.conversationId);
        const newTitle = data.title || `Consulenza del ${new Date().toLocaleDateString("it-IT")}`;
        setConversationTitle(newTitle);
        // Update URL and refresh server data to update conversation list
        router.push(`/dashboard?conversationId=${data.conversationId}`, { scroll: false });
        router.refresh();
      }
      
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
      console.error("Errore di rete o fetch:", networkError);
      const errorMsg = networkError instanceof Error ? networkError.message : "Errore di connessione di rete.";
      setError(errorMsg);
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };
  
  // startNewConversation è definita prima di useEffect

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between p-4 border-b">
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
          <div className="flex items-center gap-2 cursor-pointer group" onClick={handleTitleClick}>
            <h1 className="text-xl font-semibold">
              {conversationTitle || "Nuova Consulenza"}
            </h1>
            {currentConversationId && (
              <Edit3 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="mr-2">Token: {tokenCount.input + tokenCount.output}</span>
            <span className="text-xs">(In: {tokenCount.input} / Out: {tokenCount.output})</span>
          </div>
          <Button variant="outline" size="sm" onClick={startNewConversation}>
            Nuova Conversazione
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && !error && (
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
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t">
        {error && messages.length > 0 && ( // Mostra errore in basso solo se ci sono già messaggi o durante l'invio
          <Alert variant="destructive" className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Errore</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        <MessageInput 
          onSend={handleSubmit} 
          isLoading={isLoading} 
          onInputChange={() => setError(null)} 
        />
      </div>
    </div>
  );
}
