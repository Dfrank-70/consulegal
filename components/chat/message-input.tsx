"use client";

import { useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, X, FileText, File } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string, file?: File) => void;
  isLoading: boolean;
}

export function MessageInput({ onSend, isLoading }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() || file) {
      onSend(message, file || undefined);
      setMessage("");
      setFile(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword' // .doc
      ];
      
      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile);
      } else {
        alert('Tipo di file non supportato. Sono accettati solo file PDF, DOC e DOCX.');
        // Reset dell'input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = (file: File) => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return {
        icon: FileText,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      };
    }
    
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileType === 'application/msword' || 
        fileName.endsWith('.docx') || 
        fileName.endsWith('.doc')) {
      return {
        icon: FileText,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    }
    
    // Fallback per altri tipi di file
    return {
      icon: File,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    };
  };

  return (
    <div className="relative flex flex-col rounded-lg border bg-background p-2">
      {file && (() => {
        const fileStyle = getFileIcon(file);
        const IconComponent = fileStyle.icon;
        
        return (
          <div className={`mb-2 flex items-center justify-between rounded-md border p-3 text-sm ${fileStyle.bgColor} ${fileStyle.borderColor}`}>
            <div className="flex items-center space-x-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded ${fileStyle.color}`}>
                <IconComponent className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="truncate font-medium text-gray-900">{file.name}</span>
                <span className="text-xs text-gray-500">
                  {file.type === 'application/pdf' && 'Documento PDF'}
                  {(file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                    file.type === 'application/msword') && 'Documento Word'}
                  {(!file.type.includes('pdf') && !file.type.includes('word') && !file.type.includes('document')) && 'Documento'}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-100" onClick={handleRemoveFile}>
              <X className="h-4 w-4 text-gray-500 hover:text-red-600" />
            </Button>
          </div>
        );
      })()}
      <div className="flex items-end">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi il tuo messaggio qui..."
          className="flex-1 resize-none border-0 bg-transparent pr-24 sm:pr-20 shadow-none focus-visible:ring-0"
          rows={1}
          disabled={isLoading}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1 sm:gap-2 z-10">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8 bg-background hover:bg-accent"
            onClick={handleAttachClick}
            disabled={isLoading}
            title="Allega un file"
          >
            <Paperclip className="h-5 w-5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8"
            onClick={handleSend}
            disabled={isLoading || (!message.trim() && !file)}
          >
            {isLoading ? (
              <div className="h-5 w-5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Send className="h-5 w-5 sm:h-4 sm:w-4" />
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
