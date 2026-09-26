import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DevotionalIcon } from '../app/visual/DevotionalIcon';
import type { BibleManifestBook } from './types';
import { DEFAULT_READER_APPEARANCE, type ReaderAppearance } from './reader-appearance';

interface Props {
  books: BibleManifestBook[];
  book: BibleManifestBook;
  chapter: number;
  backTo: string;
  returnTo: string;
  appearance: ReaderAppearance;
  appearanceReady: boolean;
  appearanceError: string;
  onAppearance: (value: ReaderAppearance) => void;
  onNavigate: (bookId: string, chapter: number) => void;
}

export function BibleReaderControls(props: Props) {
  const [panel, setPanel] = useState<'passage' | 'appearance' | null>(null);
  const [bookId, setBookId] = useState(props.book.id);
  const [chapter, setChapter] = useState(props.chapter);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const activeBook = props.books.find(book => book.id === bookId) ?? props.book;
  useEffect(() => {
    if (panel) {
      dialog.current?.showModal();
      dialog.current?.querySelector<HTMLSelectElement>('select:not(:disabled)')?.focus();
    }
    else dialog.current?.close();
  }, [panel]);
  const openPassage = (event: React.MouseEvent<HTMLButtonElement>) => {
    trigger.current = event.currentTarget;
    setBookId(props.book.id); setChapter(props.chapter); setPanel('passage');
  };
  const returnQuery = new URLSearchParams({ return: props.returnTo });
  return <>
    <header className="bible-reader-header mg-bible-shell-header">
      <h1 className="sr-only">Bible</h1>
      <Link className="reader-icon-button" to={props.backTo} aria-label="Return to devotional context"><DevotionalIcon name="back" /></Link>
      <button className="reader-passage-button" type="button" onClick={openPassage} aria-label="Choose book and chapter" aria-haspopup="dialog">
        <span>{props.book.name} {props.chapter}</span><DevotionalIcon name="down" />
      </button>
      <Link className="reader-icon-button" to={`/bible/collections?${returnQuery}`} aria-label="Collections"><DevotionalIcon name="bookmark" /></Link>
      <button className="reader-icon-button reader-type-button" type="button" aria-label="Reading appearance" aria-haspopup="dialog" onClick={event => { trigger.current = event.currentTarget; setPanel('appearance'); }}>Aa</button>
    </header>
    <dialog ref={dialog} className="grace-reader-dialog" aria-labelledby="reader-dialog-title" onCancel={() => setPanel(null)} onClose={event => { if (!event.currentTarget.open) { setPanel(null); trigger.current?.focus(); } }}>
      <div className="reader-dialog-heading"><h2 id="reader-dialog-title">{panel === 'appearance' ? 'Reading' : 'Open Scripture'}</h2><button className="reader-icon-button" type="button" aria-label="Close reader panel" onClick={() => setPanel(null)}><DevotionalIcon name="close" /></button></div>
      {panel === 'passage' ? <>
        <form className="bible-toolbar mg-bible-toolbar" onSubmit={event => { event.preventDefault(); setPanel(null); props.onNavigate(bookId, chapter); }}>
          <label>Book<select autoFocus value={bookId} onChange={event => { setBookId(event.target.value); setChapter(1); }}>{props.books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
          <label>Chapter<select value={chapter} onChange={event => setChapter(Number(event.target.value))}>{Array.from({ length: activeBook.chapterCount }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
          <button className="grace-primary" type="submit">Open passage <DevotionalIcon name="arrow" /></button>
        </form>
        <div className="reader-dialog-links"><Link to={`/search?${returnQuery}`}><DevotionalIcon name="search" /> Search Bible</Link><Link to={`/data?${returnQuery}`}><DevotionalIcon name="profile" /> Data and settings</Link></div>
        <p className="reader-dialog-caption">Berean Standard Bible · Available offline</p>
      </> : panel === 'appearance' ? <div className="reader-appearance-controls">
        <fieldset disabled={!props.appearanceReady}>
          <legend className="sr-only">Reading appearance</legend>
          <label>Reading font<select autoFocus value={props.appearance.font} onChange={event => props.onAppearance({ ...props.appearance, font: event.target.value as ReaderAppearance['font'] })}><option value="literary">Literary serif</option><option value="classic">Classic serif</option><option value="sans">Simple sans serif</option></select></label>
          <label className="reader-size-control">Text size <output>{Math.round(props.appearance.scale * 100)}%</output><input type="range" aria-label="Scripture text size" min="90" max="150" step="10" value={Math.round(props.appearance.scale * 100)} onChange={event => props.onAppearance({ ...props.appearance, scale: Number(event.target.value) / 100 })} /></label>
          <label>Line spacing<select value={props.appearance.leading} onChange={event => props.onAppearance({ ...props.appearance, leading: event.target.value as ReaderAppearance['leading'] })}><option value="close">Close</option><option value="comfortable">Comfortable</option><option value="generous">Generous</option></select></label>
          <button className="reader-text-button" type="button" onClick={() => props.onAppearance(DEFAULT_READER_APPEARANCE)}>Reset reading appearance</button>
        </fieldset>
        <p className="reader-dialog-caption">Your choice is saved on this device.</p>
        <p role="status">{props.appearanceError}</p>
      </div> : null}
    </dialog>
  </>;
}
