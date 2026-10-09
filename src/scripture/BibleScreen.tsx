import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Bookmark, Highlight, PlanEnrollment, ScriptureReference, VerseKey, VerseNote } from "../domain/types";
import { DevotionalIcon } from "../app/visual/DevotionalIcon";
import { MorningGraceArtwork } from "../app/visual/MorningGraceArtwork";
import { BibleReaderControls } from "./BibleReaderControls";
import { useReaderAppearance } from "./reader-appearance";
import { VerseNoteEditor, type VerseNoteEditorHandle } from "./VerseNoteEditor";
import { db } from "../data/database";
import { VerseNoteRepository } from "../data/repositories/verse-notes";
import { todayLocalDate } from "../domain/time";
import { buildPrayerFromScriptureUrl } from "../prayer/context";
import { buildReflectionUrl, parsePendingScripture } from "../reflection/context";
import { prayerReferenceLabel } from "../prayer/references";
import { savedPassageUrl, withSearchReturn } from "../search/context";
import { appendPlanQuery, buildPlanReadingUrl, chapterWithinReference, parsePlanReadingLocator, resolveReading, type PlanReadingLocator } from "../mcheyne/context";
import { loadMcheynePlan } from "../mcheyne/loader";
import { McheyneRepository } from "../mcheyne/repository";
import type { McheyneReading } from "../mcheyne/types";
import { scriptureTextForRange } from "./plain-text";
import { useMutation } from "../app/useMutation";
import { loadBibleBook, loadBibleChapter, loadBibleManifest } from "./loader";
import { parseVerseKey, rangeContainsVerse, scriptureRange, ScriptureRepository } from "./repository";
import { coveredVersesForChapter } from "./chapter-annotation-index";
import type { BibleChapterAsset, BibleManifest, BibleManifestBook, ScriptureBlock } from "./types";

interface VerseSelection { start: number; end: number; }
interface ActivePlanContext { locator: PlanReadingLocator; enrollment: PlanEnrollment; reading: McheyneReading; completed: boolean; }
const repository = new ScriptureRepository();
const mcheyneRepository = new McheyneRepository();
const verseNoteRepository = new VerseNoteRepository(db);
function referenceLabel(book: BibleManifestBook, chapter: number, selection: VerseSelection): string { const start = Math.min(selection.start, selection.end); const end = Math.max(selection.start, selection.end); return `${book.name} ${chapter}:${start}${start === end ? "" : `–${end}`}`; }
function rangeEquals(item: ScriptureReference, reference: ScriptureReference): boolean { return item.translationId === reference.translationId && item.startVerseKey === reference.startVerseKey && item.endVerseKey === reference.endVerseKey; }


export function BibleScreen() {
  const readerAppearance = useReaderAppearance();
  const readerRoot = useRef<HTMLElement>(null);
  const actionDock = useRef<HTMLDivElement>(null);
  const { busy: annotationBusy, status: mutationStatus, failed: mutationFailed, run: runMutation } = useMutation();
  const navigate = useNavigate(); const location = useLocation(); const params = useParams(); const [searchParams] = useSearchParams(); const searchKey = searchParams.toString();
  const [manifest,setManifest]=useState<BibleManifest|null>(null); const [chapterData,setChapterData]=useState<BibleChapterAsset|null>(null); const [highlights,setHighlights]=useState<Highlight[]>([]); const [bookmarks,setBookmarks]=useState<Bookmark[]>([]); const [verseNotes,setVerseNotes]=useState<VerseNote[]>([]); const [selection,setSelection]=useState<VerseSelection|null>(null); const [status,setStatus]=useState(""); const [moreOpen,setMoreOpen]=useState(false); const [noteEditorOpen,setNoteEditorOpen]=useState(false); const [error,setError]=useState<string|null>(null); const [planContext,setPlanContext]=useState<ActivePlanContext|null>(null); const positionTimer=useRef<number|null>(null); const restoredLocation=useRef<string|null>(null);
  const [selectionEdited,setSelectionEdited]=useState(false); const [chapterIdentity,setChapterIdentity]=useState(""); const [noteReference,setNoteReference]=useState<ScriptureReference|null>(null); const noteHandle=useRef<VerseNoteEditorHandle|null>(null); const noteRecoveryKey=useRef(""); const pendingPosition=useRef<(()=>void)|null>(null);
  useEffect(() => {
    const root = readerRoot.current;
    const dock = actionDock.current;
    if (!root) return;
    if (!dock) { root.style.setProperty('--reader-dock-height', '0px'); return; }
    const observer = new ResizeObserver(() => root.style.setProperty('--reader-dock-height', `${dock.getBoundingClientRect().height}px`));
    observer.observe(dock);
    return () => observer.disconnect();
  }, [selection, moreOpen, noteEditorOpen]);
  const requestNote=(action:()=>void)=>{if(noteHandle.current)noteHandle.current.request(action);else action();};
  const routeBookId=(params.bookId??"").toUpperCase(); const routeChapter=Number(params.chapter??Number.NaN); const activeBook=useMemo(()=>manifest?.books.find((book)=>book.id===routeBookId)??null,[manifest,routeBookId]); const validChapter=activeBook!==null&&Number.isInteger(routeChapter)&&routeChapter>=1&&routeChapter<=activeBook.chapterCount; const selectedReference=useMemo(()=>activeBook&&validChapter&&selection?scriptureRange(activeBook.id,routeChapter,selection.start,selection.end):null,[activeBook,routeChapter,selection,validChapter]);
  useEffect(()=>{let cancelled=false;loadBibleManifest().then((value)=>{if(!cancelled)setManifest(value);}).catch((reason:unknown)=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Could not load the Bible manifest.");});return()=>{cancelled=true;};},[]);
  useEffect(()=>{let cancelled=false;const locator=parsePlanReadingLocator(new URLSearchParams(searchKey));if(!locator){setPlanContext(null);return()=>{cancelled=true;};}Promise.all([loadMcheynePlan(),mcheyneRepository.getEnrollment(locator.enrollmentId)]).then(async([plan,enrollment])=>{if(!enrollment)throw new Error("This M’Cheyne enrollment is no longer available.");const reading=resolveReading(plan,locator);if(!reading||!reading.references[locator.segmentIndex])throw new Error("This M’Cheyne reading could not be resolved.");const progress=await mcheyneRepository.getReadingProgress(locator.enrollmentId,locator.sequence,locator.readingIndex);if(!cancelled)setPlanContext({locator,enrollment,reading,completed:Boolean(progress?.completedAt)});}).catch((reason:unknown)=>{if(!cancelled){setPlanContext(null);setStatus(reason instanceof Error?reason.message:"Plan context unavailable.");}});return()=>{cancelled=true;};},[searchKey]);
  useEffect(()=>{if(!manifest)return;if(!params.bookId||!params.chapter){void repository.getResumePosition().then((position)=>{if(position)navigate(`/bible/${position.bookId}/${position.chapter}${searchKey?'?'+searchKey:''}`,{replace:true});else navigate("/bible/GEN/1"+(searchKey?'?'+searchKey:''),{replace:true});});return;}if(!activeBook||!validChapter)navigate("/bible/GEN/1"+(searchKey?'?'+searchKey:''),{replace:true});},[activeBook,manifest,navigate,params.bookId,params.chapter,validChapter]);
  const refreshAnnotations=useCallback(async()=>{if(!activeBook||!validChapter)return;const[nextHighlights,nextBookmarks,nextNotes]=await Promise.all([repository.listHighlightsForChapter(activeBook.id,routeChapter),repository.listBookmarksForChapter(activeBook.id,routeChapter),verseNoteRepository.listForChapter(activeBook.id,routeChapter)]);setHighlights(nextHighlights);setBookmarks(nextBookmarks);setVerseNotes(nextNotes);},[activeBook,routeChapter,validChapter]);
  useEffect(()=>{if(!activeBook||!validChapter)return;let cancelled=false;setChapterData(null);setChapterIdentity("");setSelectionEdited(false);setSelection(null);setNoteEditorOpen(false);setMoreOpen(false);setError(null);Promise.all([loadBibleChapter(activeBook.id,routeChapter),loadBibleBook(activeBook.id),refreshAnnotations()]).then(([chapter])=>{if(!cancelled){setChapterData(chapter);setChapterIdentity(`${activeBook.id}.${routeChapter}`);}}).catch((reason:unknown)=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Could not load this chapter.");});return()=>{cancelled=true;};},[activeBook,refreshAnnotations,routeChapter,validChapter]);
  useEffect(()=>{if(!chapterData||!activeBook)return;const key=`${activeBook.id}.${routeChapter}?${searchKey}`;if(restoredLocation.current===key)return;if(parsePlanReadingLocator(new URLSearchParams(searchKey))&&!planContext)return;restoredLocation.current=key;const targetVerse=Number(new URLSearchParams(searchKey).get("verse"));if(Number.isInteger(targetVerse)&&targetVerse>0&&chapterData.blocks.some((block)=>block.segments.some((segment)=>segment.verse===targetVerse))){const endVerse=Number(new URLSearchParams(searchKey).get("endVerse"));setSelection({start:targetVerse,end:Number.isInteger(endVerse)&&endVerse>=targetVerse&&endVerse<=chapterData.verseCount?endVerse:targetVerse});requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-verse-key="${activeBook.id}.${routeChapter}.${targetVerse}"]`)?.scrollIntoView({block:"center"}));return;}if(planContext){const segment=planContext.reading.references[planContext.locator.segmentIndex];if(!segment)return;const start=parseVerseKey(segment.startVerseKey);if(start.bookId===activeBook.id&&start.chapter===routeChapter)requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-verse-key="${segment.startVerseKey}"]`)?.scrollIntoView({block:"center"}));return;}void repository.getReaderPosition(activeBook.id,routeChapter).then((position)=>{if(position?.verseKey)requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-verse-key="${position.verseKey}"]`)?.scrollIntoView({block:"center"}));});},[activeBook,chapterData,planContext,routeChapter,searchKey]);
  useEffect(()=>{if(!chapterData||!activeBook||!("IntersectionObserver" in window))return;const nodes=Array.from(document.querySelectorAll<HTMLElement>(".scripture-reader [data-verse-key]"));if(!nodes.length)return;const observer=new IntersectionObserver((entries)=>{const visible=entries.filter((entry)=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];const verseKey=visible?.target.getAttribute("data-verse-key") as VerseKey|null;if(!verseKey)return;if(positionTimer.current!==null)window.clearTimeout(positionTimer.current);const offset=window.scrollY;pendingPosition.current=()=>{void repository.saveReaderPosition(activeBook.id,routeChapter,verseKey,offset).catch(()=>undefined);};positionTimer.current=window.setTimeout(()=>{pendingPosition.current?.();pendingPosition.current=null;},400);},{rootMargin:"-8% 0px -72% 0px",threshold:0});nodes.forEach((node)=>observer.observe(node));return()=>{observer.disconnect();if(positionTimer.current!==null)window.clearTimeout(positionTimer.current);pendingPosition.current?.();pendingPosition.current=null;};},[activeBook,chapterData,routeChapter]);
  const highlightedVerses = useMemo(() => coveredVersesForChapter(highlights, routeBookId, routeChapter, chapterData?.verseCount ?? 0), [highlights, routeBookId, routeChapter, chapterData?.verseCount]);
  const bookmarkedVerses = useMemo(() => coveredVersesForChapter(bookmarks, routeBookId, routeChapter, chapterData?.verseCount ?? 0), [bookmarks, routeBookId, routeChapter, chapterData?.verseCount]);
  const notedVerses = useMemo(() => coveredVersesForChapter(verseNotes, routeBookId, routeChapter, chapterData?.verseCount ?? 0), [verseNotes, routeBookId, routeChapter, chapterData?.verseCount]);
  const requestedNoteDraft=searchParams.get("draft");
  useEffect(()=>{if((!requestedNoteDraft && new URLSearchParams(searchKey).get("noteReview") !== "1")||!selectedReference||!chapterData||chapterData.chapter!==routeChapter||chapterIdentity!==`${routeBookId}.${routeChapter}`||noteRecoveryKey.current===searchKey)return;noteRecoveryKey.current=searchKey;setNoteReference(parsePendingScripture(new URLSearchParams(searchKey))??selectedReference);setNoteEditorOpen(true);setMoreOpen(false);},[requestedNoteDraft,selectedReference,chapterData,chapterIdentity,routeBookId,routeChapter,searchKey]);
  if((!manifest&&!error)||(!activeBook&&!error))return <main className="visual-screen bible-screen mg-route-state mg-loading-state"><p className="eyebrow">Scripture reader</p><p className="bible-loading mg-inline-state" role="status">Opening the Berean Standard Bible…</p></main>;if(error)return <main className="visual-screen bible-screen mg-route-state mg-error-state"><p className="eyebrow">Scripture reader</p><h1 className="bible-error-title">Bible</h1><p className="bible-error mg-inline-state" role="alert">{error}</p><button className="quiet-button" type="button" onClick={()=>window.location.reload()}>Try again</button></main>;if(!manifest||!activeBook||!validChapter||!chapterData)return <main className="visual-screen bible-screen mg-route-state mg-loading-state"><p className="eyebrow">Scripture reader</p><p className="bible-loading mg-inline-state" role="status">Opening {activeBook?.name??"Scripture"}…</p></main>;
  const exactHighlight=selectedReference?highlights.some((item)=>rangeEquals(item,selectedReference)):false;const exactBookmark=selectedReference?bookmarks.some((item)=>rangeEquals(item,selectedReference)):false;const routedNoteRange=parsePendingScripture(new URLSearchParams(searchKey));const noteTarget=!selectionEdited&&selectedReference&&routedNoteRange&&selectedReference.startVerseKey===routedNoteRange.startVerseKey&&(selectedReference.endVerseKey===routedNoteRange.endVerseKey||selectedReference.endVerseKey===selectedReference.startVerseKey)?routedNoteRange:selectedReference;const exactVerseNote=noteTarget?verseNotes.some((item)=>rangeEquals(item,noteTarget)):false;const currentIndex=manifest.books.findIndex((book)=>book.id===activeBook.id);
  const navigateToChapter=(bookId:string,chapter:number)=>{let path=`/bible/${bookId}/${chapter}`;if(planContext&&chapterWithinReference(bookId,chapter,planContext.reading,planContext.locator.segmentIndex))path=appendPlanQuery(path,planContext.locator);const returnTo=searchParams.get('return');if(returnTo?.startsWith('/')&&!returnTo.startsWith('//'))path+=`${path.includes('?')?'&':'?'}${new URLSearchParams({return:returnTo})}`;navigate(path);};
  const navigateAdjacent=(direction:-1|1)=>{if(direction<0){if(routeChapter>1)navigateToChapter(activeBook.id,routeChapter-1);else if(currentIndex>0){const previous=manifest.books[currentIndex-1];if(previous)navigateToChapter(previous.id,previous.chapterCount);}return;}if(routeChapter<activeBook.chapterCount)navigateToChapter(activeBook.id,routeChapter+1);else{const next=manifest.books[currentIndex+1];if(next)navigateToChapter(next.id,1);}};
  const chooseVerse=(verse:number)=>requestNote(()=>{setSelectionEdited(true);setStatus("");setMoreOpen(false);setNoteEditorOpen(false);setSelection(current=>{if(!current)return{start:verse,end:verse};if(current.start===verse&&current.end===verse)return null;return{start:current.start,end:verse};});});
  const toggleHighlight=async()=>{if(!selectedReference)return;await repository.toggleHighlight(selectedReference);await refreshAnnotations();setStatus(exactHighlight?"Highlight removed.":"Highlighted locally.");};const toggleBookmark=async()=>{if(!selectedReference)return;await repository.toggleBookmark(selectedReference);await refreshAnnotations();setStatus(exactBookmark?"Bookmark removed.":"Bookmarked locally.");};const togglePlanCompletion=async()=>{if(!planContext)return;await mcheyneRepository.setReadingCompleted(planContext.enrollment.id,planContext.locator.sequence,planContext.locator.readingIndex,!planContext.completed);setPlanContext({...planContext,completed:!planContext.completed});setStatus(planContext.completed?"Reading marked unread.":"Reading marked complete.");};
  const copySelection=async()=>{if(!selection)return;const text=scriptureTextForRange(chapterData,selection.start,selection.end);const label=referenceLabel(activeBook,routeChapter,selection);try{await navigator.clipboard.writeText(`${text}\n\n${label} — Berean Standard Bible`);setStatus("Selection copied.");}catch{setStatus("Copy is unavailable. You can select and copy the Scripture text directly.");}setMoreOpen(false);};const openVerseNote=()=>{if(!selectedReference||noteEditorOpen)return;setNoteReference(noteTarget);setNoteEditorOpen(true);setMoreOpen(false);};const selectedReturn=()=>{const query=new URLSearchParams(location.search);if(selection){query.set("verse",String(Math.min(selection.start,selection.end)));query.set("endVerse",String(Math.max(selection.start,selection.end)));}return `${location.pathname}?${query}`;};const openReflection=()=>{if(selectedReference)navigate(buildReflectionUrl(todayLocalDate(),selectedReference,selectedReturn()));};const openPrayer=()=>{if(selectedReference)navigate(buildPrayerFromScriptureUrl(selectedReference,selectedReturn()));};const openCollection=()=>{if(!selectedReference)return;const query=new URLSearchParams({translation:selectedReference.translationId,start:selectedReference.startVerseKey,end:selectedReference.endVerseKey,return:`${location.pathname}${location.search}`});navigate(`/bible/collections?${query.toString()}`);};
  const renderBlock=(block:ScriptureBlock,blockIndex:number)=>{if(block.kind==="blank")return <div className="scripture-blank" key={blockIndex} aria-hidden="true"/>;const content=block.segments.map((segment,segmentIndex)=>{const verse=segment.verse;const selected=verse!==null&&selection!==null&&verse>=Math.min(selection.start,selection.end)&&verse<=Math.max(selection.start,selection.end);const highlighted=verse!==null&&highlightedVerses.has(verse);const bookmarked=verse!==null&&bookmarkedVerses.has(verse);const noted=verse!==null&&notedVerses.has(verse);const planReading=verse!==null&&planContext!==null&&rangeContainsVerse(planContext.reading.references[planContext.locator.segmentIndex]!,activeBook.id,routeChapter,verse);const classes=["scripture-run",segment.redLetter?"is-red-letter":"",highlighted?"is-highlighted":"",selected?"is-selected":"",planReading?"is-plan-reading":"",segment.emphasis?`emphasis-${segment.emphasis}`:""].filter(Boolean).join(" ");const leading=segment.text.match(/^(\s*\S+)([\s\S]*)$/u);
      return <span className={classes} key={`${blockIndex}-${segmentIndex}`}>
        {segment.isVerseStart&&segment.verseKey&&verse!==null ? <>
          <span className="verse-start">
            <button className={`verse-number${bookmarked?" is-bookmarked":""}${noted?" is-noted":""}`} type="button" data-verse-key={segment.verseKey} aria-label={`Select ${activeBook.name} ${routeChapter}:${verse}`} aria-pressed={selected} onClick={()=>chooseVerse(verse)}>{verse}</button>
            <span className="scripture-text">{leading?.[1]??segment.text}</span>
          </span>
          {leading?.[2]&&<span className="scripture-text">{leading[2]}</span>}
        </> : <span className="scripture-text">{segment.text}</span>}
      </span>;});if(block.kind==="heading")return <h3 className={`scripture-heading level-${block.level}`} key={blockIndex}>{content}</h3>;if(block.kind==="superscription")return <p className="scripture-superscription" key={blockIndex}>{content}</p>;if(block.kind==="poetry")return <p className={`scripture-block scripture-poetry level-${block.level}`} key={blockIndex}>{content}</p>;return <p className="scripture-block" key={blockIndex}>{content}</p>;};
  const firstChapter=currentIndex===0&&routeChapter===1;const lastBook=currentIndex===manifest.books.length-1&&routeChapter===activeBook.chapterCount;const currentSegment=planContext?.reading.references[planContext.locator.segmentIndex]??null;const segmentCount=planContext?.reading.references.length??0;const requestedReturn=new URLSearchParams(searchKey).get("return");const backTarget=requestedReturn?.startsWith("/")&&!requestedReturn.startsWith("//")?requestedReturn:planContext?.locator.origin==="plan"?"/today/plan":"/today";
  const savedRange = parsePendingScripture(searchParams);
  const savedEnd = savedRange ? parseVerseKey(savedRange.endVerseKey) : null;
  const savedStart = savedRange ? parseVerseKey(savedRange.startVerseKey) : null;
  const crossChapterRange = savedStart && savedEnd && (savedStart.chapter !== savedEnd.chapter || savedStart.bookId !== savedEnd.bookId);
  const nextSavedBook = routeChapter < activeBook.chapterCount ? activeBook.id : manifest.books[currentIndex + 1]?.id;
  const nextSavedChapter = routeChapter < activeBook.chapterCount ? routeChapter + 1 : 1;
  const rangeCanContinue = savedEnd && (currentIndex < manifest.books.findIndex(book => book.id === savedEnd.bookId) || activeBook.id === savedEnd.bookId && routeChapter < savedEnd.chapter);
  const nextSavedParams = savedRange ? new URLSearchParams({translation:savedRange.translationId,start:savedRange.startVerseKey,end:savedRange.endVerseKey,verse:'1',return:backTarget}) : null;
  if (nextSavedParams && savedEnd && savedEnd.bookId === nextSavedBook && savedEnd.chapter === nextSavedChapter) nextSavedParams.set('endVerse', String(savedEnd.verse));
  const readerStyle = {
    '--scripture-scale': readerAppearance.appearance.scale,
    '--scripture-leading': { close: 1.45, comfortable: 1.65, generous: 1.85 }[readerAppearance.appearance.leading],
  } as CSSProperties;
  return (
    <main ref={readerRoot} className="bible-screen grace-bible" data-reading-font={readerAppearance.appearance.font} style={readerStyle}>
      <BibleReaderControls books={manifest.books} book={activeBook} chapter={routeChapter} backTo={backTarget}
        returnTo={`${location.pathname}${location.search}`} appearance={readerAppearance.appearance}
        appearanceReady={readerAppearance.ready} appearanceError={readerAppearance.error}
        onAppearance={readerAppearance.update} onNavigate={navigateToChapter} />

      <article className="reader-page scripture-reader mg-scripture-page" aria-label={`${activeBook.name} ${routeChapter}, Berean Standard Bible`}>
        {crossChapterRange && savedRange && <aside className="reader-saved-range" aria-label="Saved passage context"><strong>{prayerReferenceLabel(savedRange, manifest)} · {savedRange.translationId}</strong><p>This saved passage continues across chapters. You are reading {activeBook.name} {routeChapter}.</p><Link to={savedPassageUrl(savedRange, backTarget)}>Start of saved passage</Link>{rangeCanContinue && nextSavedBook && <Link to={`/bible/${nextSavedBook}/${nextSavedChapter}?${nextSavedParams}`}>Continue saved passage →</Link>}</aside>}
        <MorningGraceArtwork variant="context" className="mg-bible-chapter-art" />
        <header className="reader-heading scripture-reader-heading mg-reader-heading">
          <h2>{activeBook.name} {routeChapter}</h2>
        </header>

        {planContext && currentSegment ? (
          <section className="plan-reading-context mg-plan-context" aria-label="M’Cheyne reading context">
            <div className="plan-context-copy"><span className="section-kicker">M’Cheyne · {planContext.reading.group === "family" ? "Family" : "Private"}</span><strong>{planContext.reading.displayReference}</strong><span>Day {planContext.locator.sequence}{segmentCount > 1 ? ` · Part ${planContext.locator.segmentIndex + 1} of ${segmentCount}` : ""}</span></div>
            <div className="plan-context-actions">
              <Link to={backTarget}>Back to {backTarget.startsWith("/history") ? "History" : planContext.locator.origin === "plan" ? "plan" : "Today"}</Link>
              {planContext.locator.segmentIndex > 0 ? <Link to={withSearchReturn(buildPlanReadingUrl(planContext.reading, planContext.enrollment.id, planContext.locator.sequence, planContext.locator.readingIndex, planContext.locator.origin, planContext.locator.segmentIndex - 1), backTarget)}>Previous passage</Link> : null}
              {planContext.locator.segmentIndex + 1 < segmentCount ? <Link to={withSearchReturn(buildPlanReadingUrl(planContext.reading, planContext.enrollment.id, planContext.locator.sequence, planContext.locator.readingIndex, planContext.locator.origin, planContext.locator.segmentIndex + 1), backTarget)}>Next passage</Link> : null}
              <button type="button" className={planContext.completed ? "is-complete" : ""} disabled={annotationBusy} onClick={() => void runMutation(() => togglePlanCompletion())}>{planContext.completed ? "Mark unread" : "Mark reading complete"}</button>
            </div>
          </section>
        ) : null}

        <div className="scripture-copy scripture-content">{chapterData.blocks.map(renderBlock)}</div>
        {planContext && currentSegment && planContext.locator.segmentIndex + 1 === segmentCount && parseVerseKey(currentSegment.endVerseKey).bookId === activeBook.id && parseVerseKey(currentSegment.endVerseKey).chapter === routeChapter && <section className="reader-plan-finish" aria-label="Finish this reading"><p>End of {planContext.reading.displayReference}. Completion is always your choice.</p>{planContext.completed ? <p>This reading is marked complete.</p> : <button className="grace-primary" disabled={annotationBusy} onClick={() => void runMutation(async () => { await mcheyneRepository.setReadingCompleted(planContext.enrollment.id, planContext.locator.sequence, planContext.locator.readingIndex, true); navigate(backTarget); })}>Mark complete and continue</button>}</section>}
        <nav className="chapter-navigation mg-chapter-navigation" aria-label="Adjacent chapters">
          <button type="button" disabled={firstChapter} onClick={() => navigateAdjacent(-1)}><DevotionalIcon name="back" /> Previous</button>
          <span>{activeBook.name} {routeChapter}</span>
          <button type="button" disabled={lastBook} onClick={() => navigateAdjacent(1)}>Next <DevotionalIcon name="chevron" /></button>
        </nav>
        <p className="reader-help">Berean Standard Bible. Select a verse number to highlight, write a note, reflect, or pray.</p>
        <Link className="reader-search-link" to={`/search?${new URLSearchParams({ return: `${location.pathname}${location.search}` })}`}><DevotionalIcon name="search" /> Search Bible</Link>
      </article>

      {selection && selectedReference ? (
        <div ref={actionDock} className="verse-action-dock mg-verse-action-dock" role="region" aria-label={`Actions for ${referenceLabel(activeBook, routeChapter, selection)}`}>
          <div className="selection-reference"><strong>{referenceLabel(activeBook, routeChapter, selection)}</strong><button type="button" className="reader-icon-button clear-selection" onClick={() => requestNote(() => { setSelectionEdited(true); setSelection(null); setNoteEditorOpen(false); })} aria-label="Clear verse selection"><DevotionalIcon name="close" /></button></div>
          <div className="verse-actions">
            <button type="button" disabled={annotationBusy} aria-label={exactHighlight ? "Remove highlight" : "Highlight"} aria-pressed={exactHighlight} onClick={() => void runMutation(() => toggleHighlight())}><DevotionalIcon name="highlight" active={exactHighlight} /><span>Highlight</span></button>
            <button type="button" disabled={annotationBusy} aria-label={exactVerseNote ? "Edit verse note" : "Add verse note"} onClick={openVerseNote}><DevotionalIcon name="note" active={exactVerseNote} /><span>Note</span></button>
            <button type="button" aria-label="Copy selection" onClick={() => void copySelection()}><DevotionalIcon name="copy" /><span>Copy</span></button>
            <button type="button" aria-expanded={moreOpen} aria-controls="verse-more-actions" onClick={() => requestNote(() => { setMoreOpen(value => !value); setNoteEditorOpen(false); })}><DevotionalIcon name="more" /><span>More</span></button>
          </div>
          {moreOpen ? <div className="verse-action-menu" id="verse-more-actions">
            <button type="button" onClick={openReflection}><DevotionalIcon name="bible" /> Reflect</button>
            <button type="button" onClick={openPrayer}><DevotionalIcon name="prayer" /> Pray</button>
            <button type="button" disabled={annotationBusy} onClick={() => void runMutation(() => toggleBookmark())}><DevotionalIcon name="bookmark" active={exactBookmark} /> {exactBookmark ? "Remove bookmark" : "Bookmark"}</button>
            <button type="button" onClick={openCollection}><DevotionalIcon name="plan" /> Add to collection</button>
          </div> : null}
          {noteEditorOpen && noteReference ? <VerseNoteEditor key={`${noteReference.translationId}:${noteReference.startVerseKey}:${noteReference.endVerseKey}`} ref={noteHandle} reference={noteReference} label={prayerReferenceLabel(noteReference,manifest)} returnTo={selectedReturn()} onClose={(removed)=>{setNoteEditorOpen(false);if(removed)setStatus("Verse note removed from current views.");requestAnimationFrame(()=>actionDock.current?.querySelector<HTMLButtonElement>(".verse-actions button[aria-label*=\"verse note\"]")?.focus());}} onChanged={()=>{void refreshAnnotations().catch(()=>setStatus("Your note action was recorded. Could not refresh annotations; reopen the chapter to retry."));}} /> : null}
          <p className="reader-status" role={mutationFailed ? "alert" : "status"} aria-live="polite">{mutationStatus || status}</p>
        </div>
      ) : <p className="reader-status" role={mutationFailed ? "alert" : "status"} aria-live="polite">{mutationStatus || status}</p>}
    </main>
  );
}
