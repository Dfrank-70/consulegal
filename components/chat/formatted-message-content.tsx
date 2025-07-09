"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import React from "react";
import { Message } from "./chat-interface";

interface FormattedMessageContentProps {
  message: Message;
  history: Message[];
}

// Helper per contare i riferimenti alle note in un messaggio
const countNoteReferences = (content: string): number => {
  const referenceRegex = /[\(\[]nota\s+\d+[\)\]](?:\(.*?\))?/g;
  const matches = content.match(referenceRegex);
  return matches ? matches.length : 0;
};

// Funzione principale di parsing
const parseMessageContent = (content: string, baseNoteNumber: number) => {
  const notes: { [key: string]: string } = {};
  let mainContent = content;

  const notesSeparatorRegex = /\n\s*\*?\*?Notes?:\*?\*?/i;
  const parts = content.split(notesSeparatorRegex);
  mainContent = parts[0];
  const notesString = parts.length > 1 ? parts[1] : "";

  if (notesString) {
    const noteRegex = /[\(\[](\d+)[\)\]]\s*([\s\S]*?)(?=\s*[\(\[]\d+[\)\]]|$)/g;
    let match;
    while ((match = noteRegex.exec(notesString)) !== null) {
      notes[match[1]] = match[2].trim(); // Associa il testo della nota al suo numero originale
    }
  }

  const referenceRegex = /([\(\[]nota\s+(\d+)[\)\]])(?:\(.*?\))?/g;
  const elements: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let noteCounter = 0; // Contatore locale per le note in questo messaggio

  let refMatch;
  while ((refMatch = referenceRegex.exec(mainContent)) !== null) {
    const fullReference = refMatch[0];
    const originalNoteNumber = refMatch[2];
    const noteText = notes[originalNoteNumber];
    const startIndex = refMatch.index;

    if (startIndex > lastIndex) {
      elements.push(mainContent.substring(lastIndex, startIndex));
    }

    if (noteText) {
      const displayNoteNumber = baseNoteNumber + noteCounter + 1;
      elements.push(
        <Popover key={`note-${displayNoteNumber}`}>
          <PopoverTrigger asChild>
            <sup className="mx-1 cursor-pointer rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/20 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80">
              {displayNoteNumber}
            </sup>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-sm" align="start">
            <p>{noteText}</p>
          </PopoverContent>
        </Popover>
      );
      noteCounter++;
    } else {
      elements.push(fullReference);
    }

    lastIndex = startIndex + fullReference.length;
  }

  if (lastIndex < mainContent.length) {
    elements.push(mainContent.substring(lastIndex));
  }

  return elements;
};

export function FormattedMessageContent({
  message,
  history,
}: FormattedMessageContentProps) {
  const { content } = message;

  // Separa sempre il contenuto principale dalla sezione delle note
  const notesSeparatorRegex = /\n\s*\*?\*?Notes?:[\s\S]*/i;
  const mainContent = content.replace(notesSeparatorRegex, "").trim();

  const hasReferences = /nota\s+\d+/i.test(mainContent);
  const hasNotesSection = /notes?:/i.test(content);

  // Se non ci sono né riferimenti né una sezione note, mostra il contenuto grezzo
  if (!hasReferences && !hasNotesSection) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // Se ci sono riferimenti, esegui la logica di formattazione completa
  if (hasReferences) {
    const baseNoteNumber = history
      .filter((msg) => msg.role !== "USER")
      .reduce((acc, msg) => acc + countNoteReferences(msg.content), 0);

    const parsedElements = parseMessageContent(content, baseNoteNumber);

    return (
      <div className="whitespace-pre-wrap">
        {parsedElements.map((element, index) => (
          <React.Fragment key={index}>{element}</React.Fragment>
        ))}
      </div>
    );
  }

  // Se c'è una sezione note ma nessun riferimento, mostra solo il contenuto principale
  // (nascondendo di fatto la sezione delle note)
  return <div className="whitespace-pre-wrap">{mainContent}</div>;
}
