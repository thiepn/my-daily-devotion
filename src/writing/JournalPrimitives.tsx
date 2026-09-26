import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { MorningGraceArtwork } from "../app/visual/MorningGraceArtwork";

export function JournalHeading({ title, subtitle, back }: { title: string; subtitle: string; back: string }) {
  return <header className="journal-heading">
    <Link className="quiet-back-link" to={back}>← Back</Link>
    <div className="journal-heading-line"><div><p className="journal-date">{subtitle}</p><h1>{title}</h1></div><MorningGraceArtwork variant="botanical" /></div>
  </header>;
}

export function WritingPreview({ text }: { text: string }) {
  return <div className="journal-preview">
    {text.trim() ? <ReactMarkdown skipHtml disallowedElements={["img"]} components={{
      a: ({ href, children }) => href && /^(https?:|mailto:)/i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    }}>{text}</ReactMarkdown> : <p className="journal-help">Your writing will appear here.</p>}
  </div>;
}

export function JournalDialog({ title, children, close, busy = false }: { title: string; children: ReactNode; close: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="journal-dialog" aria-labelledby="journal-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <h2 id="journal-dialog-title">{title}</h2>{children}
  </dialog>;
}
