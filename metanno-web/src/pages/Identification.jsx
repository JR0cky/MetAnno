import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ChevronLeft, ChevronRight, Trash2, Keyboard, HelpCircle, FileText, Check, X, RotateCcw, BookOpen, ChevronUp, ChevronDown } from "lucide-react";

export const Identification = () => {
  const { utteranceId } = useParams();
  const navigate = useNavigate();
  const projectId = localStorage.getItem("metanno_current_project_id");

  const [utterance, setUtterance] = useState(null);
  const [context, setContext] = useState([]);
  const [spans, setSpans] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [metaphorPresent, setMetaphorPresent] = useState(null); // null | true | false
  const [utterancesList, setUtterancesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [showMIP, setShowMIP] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  
  const textContainerRef = useRef(null);
  const activeBubbleRef = useRef(null);
  const noButtonRef = useRef(null);
  const activeCardRef = useRef(null);

  useEffect(() => {
    if (showHistory && activeBubbleRef.current) {
      const timer = setTimeout(() => {
        if (activeBubbleRef.current) {
          activeBubbleRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [utteranceId, context, showHistory]);

  // Scroll window to active card on utterance change
  useEffect(() => {
    if (activeCardRef.current) {
      const timer = setTimeout(() => {
        if (activeCardRef.current) {
          activeCardRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [utteranceId]);


  const loadData = async () => {
    if (!projectId || !utteranceId) return;
    setLoading(true);
    try {
      const data = await api.getUtteranceDetail(utteranceId, projectId);
      setUtterance(data.utterance);
      setContext(data.context);
      setSpans(data.annotation?.metaphors || []);
      setCompleted(data.annotation?.identification_completed || false);
      setMetaphorPresent(data.annotation?.metaphor_present ?? null);

      const list = await api.getUtterances(projectId);
      setUtterancesList(list);
      
      // Removed window.scrollTo(0, 0) to allow smooth auto-scroll to the active utterance card
    } catch (err) {
      console.error("Error loading identification data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [utteranceId, projectId]);

  const triggerAutosave = async (updatedSpans, isCompleted, isPresent) => {
    if (!projectId || !utteranceId) return;
    setSaving(true);
    setStatusMsg("Saving...");
    try {
      await api.saveIdentification(projectId, utteranceId, updatedSpans, isCompleted);
      await api.updateMetaphorPresence(projectId, utteranceId, isPresent);
      setStatusMsg("Autosaved");
      setTimeout(() => setStatusMsg(""), 1500);
    } catch (err) {
      setStatusMsg("Save failed");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Selection Handler
  const handleTextSelection = () => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !textContainerRef.current || !utterance) return;

      let start = 0;
      let end = 0;
      const range = selection.getRangeAt(0);
      
      let containerNode = range.commonAncestorContainer;
      if (containerNode.nodeType === 3) { // Node.TEXT_NODE
        containerNode = containerNode.parentNode;
      }
      if (!textContainerRef.current.contains(containerNode)) {
        return;
      }

      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(textContainerRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      start = preSelectionRange.toString().length;
      end = start + range.toString().length;

      const selectedText = utterance.text.slice(start, end).trim();
      if (selectedText.length === 0) return;

      const exists = spans.some((s) => s.start === start && s.end === end);
      if (!exists) {
        const newSpan = {
          start,
          end,
          text: selectedText,
          source_frame: "",
          target_frame: "",
          conceptual_metaphor: "",
          interaction_function: "",
          confidence: null,
          comment: ""
        };
        const newSpans = [...spans, newSpan].sort((a, b) => a.start - b.start);
        setSpans(newSpans);
        triggerAutosave(newSpans, completed, metaphorPresent);
      }
      
      selection.removeAllRanges();
    } catch (err) {
      console.error("Text selection error:", err);
    }
  };

  const handleDeleteSpan = (indexToDelete) => {
    const newSpans = spans.filter((_, idx) => idx !== indexToDelete);
    setSpans(newSpans);
    triggerAutosave(newSpans, completed, metaphorPresent);
  };

  // Yes/No workflows
  const handleSelectMetaphorPresent = (isPresent) => {
    setMetaphorPresent(isPresent);
    setCompleted(true);
    if (isPresent) {
      triggerAutosave(spans, true, true);
    } else {
      setSpans([]);
      triggerAutosave([], true, false);
    }
  };

  const handleResetChoice = () => {
    setMetaphorPresent(null);
    setCompleted(false);
    setSpans([]);
    triggerAutosave([], false, null);
  };

  const getNavIds = () => {
    if (utterancesList.length === 0 || !utterance) return { prev: null, next: null, currentIndex: -1, total: 0 };
    const annotatable = utterancesList.filter(u => u.should_annotate !== false);
    const currentIndexInAnnotatable = annotatable.findIndex(u => u.id === utterance.id);
    const currentIndexInAll = utterancesList.findIndex(u => u.id === utterance.id);
    return {
      prev: currentIndexInAnnotatable > 0 ? annotatable[currentIndexInAnnotatable - 1].id : null,
      next: currentIndexInAnnotatable < annotatable.length - 1 ? annotatable[currentIndexInAnnotatable + 1].id : null,
      currentIndex: currentIndexInAnnotatable !== -1 ? currentIndexInAnnotatable : currentIndexInAll,
      total: annotatable.length
    };
  };

  const { prev, next, currentIndex, total } = getNavIds();

  const isLastTurnOfConversation = () => {
    if (!next) return true;
    const annotatable = utterancesList.filter(u => u.should_annotate !== false);
    const currIdx = annotatable.findIndex(u => u.id === utterance?.id);
    if (currIdx === -1) return false;
    return annotatable[currIdx + 1]?.conversation_id !== utterance?.conversation_id;
  };

  const handleNavigateNext = async () => {
    if (metaphorPresent === null) {
      alert("Please select whether the utterance contains metaphors (Yes/No) before proceeding.");
      return;
    }
    if (metaphorPresent === true && spans.length === 0) {
      alert("Please highlight at least one metaphorical span in the text before proceeding to classification.");
      return;
    }
    setSaving(true);
    try {
      await triggerAutosave(spans, true, metaphorPresent);
      if (metaphorPresent === true) {
        navigate(`/classification/${utteranceId}`);
      } else if (isLastTurnOfConversation()) {
        navigate(`/conversation-annotation/${utterance.conversation_id}`);
      } else if (next) {
        navigate(`/identification/${next}`);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error during submit navigation:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNavigatePrev = async () => {
    if (!prev) return;
    try {
      const prevData = await api.getUtteranceDetail(prev, projectId);
      const isMetaphor = prevData.annotation?.metaphor_present;
      if (isMetaphor === true) {
        navigate(`/classification/${prev}`);
      } else {
        navigate(`/identification/${prev}`);
      }
    } catch (err) {
      navigate(`/identification/${prev}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        handleNavigateNext();
      } else if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        handleNavigatePrev();
      } else if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleNavigateNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prev, next, metaphorPresent, utteranceId]);

  const renderAnnotatedText = () => {
    if (!utterance) return null;
    const text = utterance.text;
    
    const pointsSet = new Set([0, text.length]);
    spans.forEach(s => {
      if (s.start >= 0 && s.start <= text.length) pointsSet.add(s.start);
      if (s.end >= 0 && s.end <= text.length) pointsSet.add(s.end);
    });
    
    const sortedPoints = Array.from(pointsSet).sort((a, b) => a - b);
    const elements = [];
    
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i];
      const end = sortedPoints[i + 1];
      const segmentText = text.slice(start, end);
      const coveringSpans = spans.filter(s => s.start <= start && s.end >= end);
      
      if (coveringSpans.length === 0) {
        elements.push(<span key={i}>{segmentText}</span>);
      } else {
        const isOverlapping = coveringSpans.length > 1;
        const highlightClass = isOverlapping
          ? "bg-violet-100/80 border-b-2 border-violet-500 text-violet-900 font-semibold"
          : "bg-blue-100 border-b-2 border-blue-500 text-blue-900 font-medium";
          
        elements.push(
          <span
            key={i}
            className={`metaphor-highlight rounded-sm px-0.5 py-0.25 ${highlightClass}`}
            title={coveringSpans.map(s => `"${s.text}"`).join(", ")}
          >
            {segmentText}
          </span>
        );
      }
    }
    return elements;
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
      </div>
    );
  }

  if (!utterance) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-red-600">
        Utterance details not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-[1800px] mx-auto text-slate-800 font-sans">
      
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 font-mono font-semibold">Stage 1 of 2</span>
          <h1 className="text-2xl font-black text-slate-950 mt-0.5">Identify Metaphor Spans</h1>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Shortcuts Panel */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-bold bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-1.5 shadow-sm font-mono select-none">
            <span className="text-slate-400 uppercase text-[9px] tracking-wider font-extrabold mr-1">Shortcuts:</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-black text-slate-700 shadow-sm">Alt+→</kbd>
              <span className="text-slate-600 font-semibold">Next</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-black text-slate-700 shadow-sm">Alt+←</kbd>
              <span className="text-slate-600 font-semibold">Prev</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-black text-slate-700 shadow-sm">Ctrl+Enter</kbd>
              <span className="text-slate-600 font-semibold">Save</span>
            </div>
          </div>

          {statusMsg && (
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/60 font-mono font-semibold animate-pulse">
              {statusMsg}
            </span>
          )}
          <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-100 font-mono font-semibold">
            Utterance {currentIndex + 1} of {total}
          </span>
        </div>
      </div>

      {/* ROW 1: Dialogue Context & Guidelines (collapsible) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Dialogue Context Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col transition-all">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest pb-2.5 border-b border-slate-100 hover:text-slate-600 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Dialogue Context</span>
            </div>
            {showHistory ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          
          {showHistory && (
            <div className="flex-grow overflow-y-auto h-[220px] mt-3 pr-1 space-y-3 animate-fade-in">
              {context.map((utt) => {
                const isCurrent = utt.id === utterance.id;
                const isSpeakerAssistant = utt.speaker === "LLM";
                const isContextOnly = utt.should_annotate === false;
                return (
                  <div 
                    key={utt.id}
                    ref={isCurrent ? activeBubbleRef : null}
                    className={`flex flex-col gap-1 rounded-xl p-3 text-xs transition-all ${
                      isCurrent 
                        ? "bg-indigo-50/40 border border-indigo-100 ring-2 ring-indigo-50/10"
                        : isContextOnly
                          ? "bg-slate-50/40 border border-dashed border-slate-200 opacity-60"
                          : "bg-slate-50 border border-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className={`capitalize ${isSpeakerAssistant ? "text-indigo-600" : "text-emerald-600"} ${isContextOnly ? "text-slate-400" : ""}`}>
                        {utt.speaker} {isContextOnly && <span className="text-[9px] font-normal text-slate-400 font-sans lowercase tracking-normal italic ml-1">(context only)</span>}
                      </span>
                      {isCurrent && (
                        <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.25 rounded-full font-bold uppercase tracking-wider font-mono">
                          Active
                        </span>
                      )}
                    </div>
                    <p className={`mt-0.5 text-slate-700 leading-relaxed ${isCurrent ? "font-semibold text-slate-900" : ""}`}>
                      {utt.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guidelines Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col transition-all">
          <button 
            onClick={() => setShowMIP(!showMIP)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest pb-2.5 border-b border-slate-100 hover:text-slate-600 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-indigo-500" />
              <span className="text-slate-500">Guidelines</span>
            </div>
            {showMIP ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          
          {showMIP && (
            <div className="flex-grow overflow-y-auto h-[220px] mt-3 pr-1 text-xs text-slate-600 space-y-3 leading-relaxed animate-fade-in">
              <ol className="space-y-2.5 list-none pl-0">
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-slate-400 shrink-0 select-none w-5 text-right">1.</span>
                  <span>Read the entire text to understand its overall meaning.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-slate-400 shrink-0 select-none w-5 text-right">2.</span>
                  <span>Identify the lexical units.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-slate-400 shrink-0 select-none w-5 text-right">3.</span>
                  <span>Determine the contextual meaning of each lexical unit.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-slate-400 shrink-0 select-none w-5 text-right">4.</span>
                  <span>Determine whether the lexical unit has a more basic contemporary meaning in another context.</span>
                </li>
                <li className="pl-7">
                  <div className="text-[10px] text-slate-400 font-medium leading-normal">
                    (Basic meanings tend to be more concrete, related to bodily action, more precise, or historically older. Basic meanings are not necessarily the most frequent meanings.)
                  </div>
                </li>
                <li className="font-medium text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-left leading-normal my-1">
                  <div className="font-bold mb-1">Ask:</div>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Does the contextual meaning contrast with the basic meaning?</li>
                    <li>Can the contextual meaning be understood in comparison with the basic meaning?</li>
                  </ul>
                </li>
                <li className="flex gap-2 items-start mt-2">
                  <span className="text-indigo-600 font-bold shrink-0 select-none w-5 text-right">→</span>
                  <span className="font-medium text-slate-700">If the answer to both questions is yes, annotate the lexical unit as metaphorical.</span>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: Active Utterance (left) & Annotation Form (right) */}
      <div ref={activeCardRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Left: Active Utterance Text Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Active Utterance Text
            </span>
            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
              utterance.speaker === "LLM" 
                ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                  : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}>
              Speaker: {utterance.speaker}
            </span>
          </div>
          
          {metaphorPresent === true ? (
            /* Highlighting enabled */
            <div 
              ref={textContainerRef}
              onMouseUp={handleTextSelection}
              className="text-base font-semibold leading-relaxed text-slate-800 p-6 border border-slate-200/80 rounded-2xl bg-slate-50/30 select-text cursor-text selection:bg-indigo-200/60 min-h-[160px] whitespace-pre-wrap"
            >
              {renderAnnotatedText()}
            </div>
          ) : (
            /* Plain text (when unselected or marked literal) */
            <div className="text-base font-semibold leading-relaxed text-slate-800 p-6 border border-slate-200/80 rounded-2xl bg-slate-50/10 select-none min-h-[160px] whitespace-pre-wrap">
              {utterance.text}
            </div>
          )}

          {metaphorPresent === true && (
            <div className="flex items-start gap-2.5 text-xs text-slate-500 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100/80 leading-relaxed animate-fade-in">
              <HelpCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <span>Select words with your cursor inside the text block above to highlight metaphors. Spans are saved automatically.</span>
            </div>
          )}

          {metaphorPresent === false && (
            <div className="flex items-start gap-2.5 text-xs text-slate-600 font-bold bg-emerald-50 p-4 rounded-xl border border-emerald-100 leading-relaxed animate-fade-in">
              <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Marked as literal. Both annotation stages are complete. Press "Submit & Next" in the footer to continue.</span>
            </div>
          )}
        </div>

        {/* Right: Annotation Controls */}
        <div className="space-y-6">
          
          {/* Question Selector Block */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                Workflow Phase 1
              </span>
              <p className="text-sm font-bold text-slate-850 mt-1">
                Does this utterance contain metaphorical expressions?
              </p>
            </div>

            {metaphorPresent === null ? (
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  ref={noButtonRef}
                  onClick={() => handleSelectMetaphorPresent(false)}
                  className="flex items-center justify-center gap-1.5 px-5 py-3 border border-slate-200 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-colors shadow-sm w-full"
                >
                  <X className="h-4 w-4 text-rose-500" />
                  No, entirely literal
                </button>
                <button
                  onClick={() => handleSelectMetaphorPresent(true)}
                  className="flex items-center justify-center gap-1.5 px-5 py-3 border border-slate-200 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-colors shadow-sm w-full"
                >
                  <Check className="h-4 w-4 text-indigo-600" />
                  Yes, contains metaphors
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  metaphorPresent 
                    ? "bg-indigo-50 border-indigo-100 text-indigo-700" 
                    : "bg-slate-200 border-slate-300 text-slate-700"
                }`}>
                  {metaphorPresent ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-rose-500" />}
                  {metaphorPresent ? "Yes, contains metaphors" : "No, entirely literal"}
                </span>
                <button
                  onClick={handleResetChoice}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 bg-white text-slate-400 hover:text-slate-700 transition-colors shadow-sm"
                  title="Change choice"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Identified Spans List (if metaphor present) */}
          {metaphorPresent === true && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 animate-fade-in">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-3">
                Identified Spans ({spans.length})
              </span>
              
              {spans.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-400 italic">
                  No spans identified. Drag cursor over text to add.
                </div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {spans.map((span, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between gap-3 p-2.5 bg-indigo-50/20 border border-indigo-100/50 rounded-xl text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">"{span.text}"</span>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Indices: {span.start} - {span.end}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteSpan(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 hover:bg-rose-50 rounded-lg"
                        title="Delete span"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* Controls */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-4 px-6 sm:px-8 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 mt-8 flex items-center justify-between shadow-[0_-8px_20px_rgba(0,0,0,0.04)] z-40 rounded-b-[1.25rem]">
        <button
          onClick={handleNavigatePrev}
          disabled={!prev || saving}
          className="flex items-center gap-1 px-4 py-3 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
          Previous
        </button>
        
        <button
          onClick={handleNavigateNext}
          disabled={metaphorPresent === null || saving}
          className="flex items-center gap-1 px-5 py-3 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <span>
            {metaphorPresent === true
              ? "Submit & Classify"
              : metaphorPresent === false
                ? "Submit & Next"
                : "Submit Turn"}
          </span>
          <ChevronRight className="h-4.5 w-4.5" />
        </button>
      </div>

    </div>
  );
};
