import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ChevronLeft, ChevronRight, Keyboard, HelpCircle, FileText, CheckCircle, X, RotateCcw, BookOpen, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";

const INTENTION_EXPLANATIONS = {
  "Artistic metaphor": {
    description: "Used to predicate a whole set of features of the Topic that need not be clearly determined in advance, to stimulate creative interpretation.",
    examples: [
      "To her, the long summer days had stretched ahead, world without end.",
      "Fermi's mantle in physics had fallen on his young shoulders...",
      "The summer's sprawl begins to be oppressive..."
    ]
  },
  "Visualization": {
    description: "Resorts to a vehicle that is easier to visualize than the topic, to help the receiver form an intuitive representation of abstract or unfamiliar topics.",
    examples: [
      "Relief surged through her like a physical infusion of new blood.",
      "And beyond, green grass and geraniums like splashes of blood.",
      "The results are terse and sharply etched, like the best line drawings."
    ]
  },
  "Persuasiveness": {
    description: "Gives a non-neutral connotation to the topic, not motivated on explicit grounds, to prompt the audience to adopt the utterer's positive/negative attitude.",
    examples: [
      "The ramshackle Whitley Council negotiating machinery...",
      "America may have changed Presidents... but the fiscal ticket remains as impenetrable as ever.",
      "An atmosphere poisoned by mistrust."
    ]
  },
  "Explanation": {
    description: "Used for didactic purposes, to explain a new or already familiar concept to the addressee.",
    examples: [
      "Canals within the algae stand out as rods in this kind of preservation...",
      "Thus one can and must say... it incarnates the enveloping totalization...",
      "The ego-identity of that person is shaped by these choices."
    ]
  },
  "Argumentative metaphor": {
    description: "Metaphors that are part of explicit arguments intended to convince the audience of a claim by supporting the argument.",
    examples: [
      "The effect is rather like an extended advertisement for Marlboro Lights.",
      "There was already a rather perfunctory air... as if it were just a required coda to her tour...",
      "But the villages are dying, becoming suburbs or dormitories where few people work but many sleep."
    ]
  },
  "Social interaction": {
    description: "Focuses on interpersonal relations, group or cultural conventions, to create or strengthen a bond between producer and receiver.",
    examples: [
      "But I'm starting to think that everything's a turn-off for you, doll.",
      "Chasing the dragon was one feature...",
      "Political correctness, just as we suspected, will be perfectly grey."
    ]
  },
  "Humour": {
    description: "Intended to entertain the addressee/be funny. Exploits metaphoric language for divertive effects that would go missing in literal paraphrases.",
    examples: [
      "Not sure of the music policy, but the name sounds like the ingredients of a takeaway...",
      "From there, like a buzzard in its eyrie, he would make forays...",
      "It's my life which is about to go down the plughole."
    ]
  },
  "Heuristic reasoning": {
    description: "Provides an interpretative model for a scientific theory, work of art, etc., organizing the addressee's conceptualization based on prior knowledge of another domain.",
    examples: [
      "It is her body as the canvas her appearance as art.",
      "It is as if it is walking through a minefield.",
      "history constitutes, we might say today, a political unconscious."
    ]
  }
};

export const Classification = () => {
  const { utteranceId } = useParams();
  const navigate = useNavigate();
  const projectId = localStorage.getItem("metanno_current_project_id");

  const [utterance, setUtterance] = useState(null);
  const [context, setContext] = useState([]);
  const [spans, setSpans] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [metaphorPresent, setMetaphorPresent] = useState(null); // null | true | false
  const [utterancesList, setUtterancesList] = useState([]);
  const [schema, setSchema] = useState({
    source_frames: [],
    target_frames: [],
    interaction_functions: []
  });
  
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);


  const activeBubbleRef = useRef(null);
  const activeCardRef = useRef(null);
  const contextContainerRef = useRef(null);

  useEffect(() => {
    if (showHistory && activeBubbleRef.current && contextContainerRef.current) {
      const timer = setTimeout(() => {
        if (activeBubbleRef.current && contextContainerRef.current) {
          const container = contextContainerRef.current;
          const bubble = activeBubbleRef.current;
          const scrollPos = bubble.offsetTop - container.offsetTop - (container.clientHeight / 2) + (bubble.clientHeight / 2);
          container.scrollTo({ top: scrollPos, behavior: 'smooth' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [utteranceId, context, showHistory]);

  const loadData = async () => {
    if (!projectId || !utteranceId) return;
    setLoading(true);
    try {
      const data = await api.getUtteranceDetail(utteranceId, projectId);
      setUtterance(data.utterance);
      setContext(data.context);
      setSpans(data.annotation?.metaphors || []);
      setCompleted(data.annotation?.classification_completed || false);
      setMetaphorPresent(data.annotation?.metaphor_present ?? null);
      
      const schemaData = await api.getSchema(projectId);
      setSchema(schemaData);

      const list = await api.getUtterances(projectId);
      setUtterancesList(list);

      // Determine initial active index
      if (data.annotation?.metaphors && data.annotation.metaphors.length > 0) {
        setActiveIndex(0);
      } else {
        setActiveIndex(-1);
      }
      
      // Scroll down to focus on the active content (Active Utterance / Classification Form)
      setTimeout(() => {
        if (activeCardRef.current) {
          const y = activeCardRef.current.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: y, behavior: "smooth" });
        } else {
          window.scrollTo(0, 0);
        }
      }, 50);
    } catch (err) {
      console.error("Error loading classification data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [utteranceId, projectId]);

  const activeSpan = activeIndex !== -1 ? spans[activeIndex] : null;


  const triggerAutosave = async (updatedSpans, isCompleted, isPresent) => {
    if (!projectId || !utteranceId) return;
    setSaving(true);
    setStatusMsg("Saving...");
    try {
      await api.saveClassification(projectId, utteranceId, updatedSpans, isCompleted);
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

  const handleFieldChange = (field, value, skipAutosave = false) => {
    if (activeIndex === -1 || !spans[activeIndex]) return;

    const updatedSpans = [...spans];
    updatedSpans[activeIndex] = {
      ...updatedSpans[activeIndex],
      [field]: value
    };

    setSpans(updatedSpans);
    if (!skipAutosave) {
      setCompleted(true);
    }
  };

  const handleIntentionToggle = (intention) => {
    if (activeIndex === -1 || !spans[activeIndex]) return;
    
    const currentIntentions = spans[activeIndex].intentions || [];
    let newIntentions;
    if (currentIntentions.includes(intention)) {
      newIntentions = currentIntentions.filter(i => i !== intention);
    } else {
      if (currentIntentions.length >= 3) {
        return;
      }
      newIntentions = [...currentIntentions, intention];
    }
    
    handleFieldChange("intentions", newIntentions);
  };

  const handleRevokeMetaphor = async () => {
    if (!window.confirm("Are you sure you want to revoke the metaphor decision? This will clear all identified spans and mark this utterance as entirely literal.")) return;
    try {
      setSaving(true);
      setStatusMsg("Revoking...");
      
      // Clear spans and mark metaphorPresent as false
      setSpans([]);
      setMetaphorPresent(false);
      setActiveIndex(-1);
      setCompleted(true);
      
      await triggerAutosave([], true, false);
      setStatusMsg("Revoked successfully");
      
      // Go back to the identification stage for the current utterance
      navigate(`/identification/${utteranceId}`);
    } catch (err) {
      console.error("Error revoking metaphor decision:", err);
      setStatusMsg("Revoke failed");
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteActiveSpan = async () => {
    if (!activeSpan) return;
    if (!window.confirm(`Are you sure you want to remove the metaphor span "${activeSpan.text}"?`)) return;
    
    try {
      setSaving(true);
      setStatusMsg("Deleting span...");
      
      const updatedSpans = spans.filter((_, idx) => idx !== activeIndex);
      setSpans(updatedSpans);
      
      if (updatedSpans.length === 0) {
        // If no spans are left, mark as entirely literal
        setMetaphorPresent(false);
        setActiveIndex(-1);
        setCompleted(true);
        await triggerAutosave([], true, false);
        
        // Go back to the identification stage for the current utterance
        navigate(`/identification/${utteranceId}`);
      } else {
        // If there are still spans left, keep them on the page
        // Set activeIndex to the first remaining span
        setActiveIndex(0);
        await triggerAutosave(updatedSpans, completed, true);
        setStatusMsg("Span deleted");
        setTimeout(() => setStatusMsg(""), 1500);
      }
    } catch (err) {
      console.error("Error deleting active span:", err);
      setStatusMsg("Delete failed");
    } finally {
      setSaving(false);
    }
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

  const isSpanComplete = (span) => {
    if (!span) return false;
    if (span.confidence === null || span.confidence === undefined) return false;
    if (span.lexicalized === null || span.lexicalized === undefined || span.lexicalized === "") return false;
    if (span.lexicalized === false && (!span.intentions || span.intentions.length === 0)) return false;
    return true;
  };

  const isFieldMissing = (field) => {
    if (!activeSpan) return false;
    if (field === "confidence") return activeSpan.confidence === null || activeSpan.confidence === undefined;
    if (field === "lexicalized") return activeSpan.lexicalized === null || activeSpan.lexicalized === undefined;
    if (field === "intentions") return activeSpan.lexicalized === false && (!activeSpan.intentions || activeSpan.intentions.length === 0);
    return false;
  };

  const isClassificationComplete = () => {
    if (metaphorPresent === false) return true;
    if (metaphorPresent === null) return false;
    if (spans.length === 0) return false;
    return spans.every(span => isSpanComplete(span));
  };

  const handleNavigateNext = async () => {
    if (!utterance) return;
    if (!isClassificationComplete()) return;
    // Save state as completed before moving forward
    await triggerAutosave(spans, true, metaphorPresent);
    if (isLastTurnOfConversation()) {
      navigate(`/conversation-annotation/${utterance.conversation_id}`);
    } else if (next) {
      navigate(`/identification/${next}`);
    }
  };

  const handleNavigatePrev = () => {
    // Go to the identification page of the same utterance
    navigate(`/identification/${utteranceId}`);
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
      } else if (activeIndex !== -1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key >= "1" && e.key <= "5") {
        const target = e.target.tagName.toLowerCase();
        if (target !== "input" && target !== "textarea" && target !== "select") {
          e.preventDefault();
          handleFieldChange("confidence", parseInt(e.key, 10));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prev, next, activeIndex, spans, utteranceId, metaphorPresent]);

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
        const isActiveSegment = activeIndex !== -1 && coveringSpans.includes(spans[activeIndex]);
        
        let highlightClass = "bg-blue-100 border-b-2 border-blue-500 text-blue-900";
        if (coveringSpans.length > 1) {
          highlightClass = "bg-violet-100/80 border-b-2 border-violet-500 text-violet-900";
        }
        if (isActiveSegment) {
          highlightClass = "bg-yellow-100 border-b-2 border-amber-600 text-amber-955 font-black ring-1 ring-amber-200 shadow-sm";
        }
        
        const handleClick = () => {
          // Cycle through covering spans
          const currentActiveInCovering = coveringSpans.findIndex(s => spans.indexOf(s) === activeIndex);
          const nextIndexInCovering = (currentActiveInCovering + 1) % coveringSpans.length;
          const nextSpan = coveringSpans[nextIndexInCovering];
          const spanIdx = spans.indexOf(nextSpan);
          if (spanIdx !== -1) {
            setActiveIndex(spanIdx);
          }
        };

        elements.push(
          <span
            key={i}
            onClick={handleClick}
            className={`metaphor-highlight rounded-sm px-0.5 py-0.25 cursor-pointer ${highlightClass}`}
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 font-mono font-semibold">Stage 2 of 2</span>
          <h1 className="text-2xl font-black text-slate-950 mt-0.5">Classify Identified Metaphors</h1>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap">

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

      {metaphorPresent === false ? (
        /* Literal skip view */
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm space-y-4 max-w-lg mx-auto animate-fade-in">
          <X className="h-12 w-12 text-rose-500 mx-auto bg-rose-50 rounded-2xl p-2.5 border border-rose-100" />
          <h3 className="text-lg font-black text-slate-800">No Metaphors to Classify</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            This utterance was marked as **entirely literal** (containing no metaphorical spans) in the identification stage. Classification is skipped automatically.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => navigate(`/identification/${utteranceId}`)}
              className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm shadow-sm hover:bg-slate-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleNavigateNext}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors"
            >
              Go to Next Utterance
            </button>
          </div>
        </div>
      ) : (
        /* 2x2 Layout structure */
        <div className="space-y-6">
                 {/* ROW 1: Dialogue Context (collapsible) */}
          <div className="animate-fade-in">
            {/* Dialogue Context Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col transition-all">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest pb-2.5 border-b border-slate-100 hover:text-slate-600 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-slate-450" />
                  <span className="text-slate-500">Dialogue Context</span>
                </div>
                {showHistory ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>
              
              {showHistory && (
                <div ref={contextContainerRef} className="flex-grow overflow-y-auto h-[220px] mt-3 pr-1 space-y-3 animate-fade-in">
                  {context.map((utt) => {
                    const isCurrent = utt.id === utterance.id;
                    const isContextOnly = utt.should_annotate === false;
                    return (
                      <div 
                        key={utt.id}
                        ref={isCurrent ? activeBubbleRef : null}
                        className={`flex flex-col gap-1 rounded-xl p-3 text-xs transition-all ${
                          isCurrent 
                            ? "bg-slate-50 border border-slate-200 text-slate-800" 
                            : isContextOnly
                              ? "bg-slate-50/40 border border-dashed border-slate-200 opacity-60 text-slate-400"
                              : "bg-white border border-slate-100 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                          <span>{utt.speaker} {isContextOnly && <span className="text-[9px] font-normal text-slate-400 font-sans lowercase tracking-normal italic ml-1">(context only)</span>}</span>
                          {utt.stage === "literal" && (
                            <span className="text-rose-500 font-bold lowercase">literal</span>
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
          </div>

          {/* ROW 2: Active Utterance/Selector (left) & Classification Form (right) */}
          <div ref={activeCardRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Left of Parallel workspace: Active Utterance text and Identified metaphor spans list */}
            <div className="space-y-6">
              
              {/* Current Utterance display */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Click a Highlighted Metaphor to Classify
                  </span>
                  <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    utterance.speaker === "LLM" 
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  }`}>
                    Speaker: {utterance.speaker}
                  </span>
                </div>
                <div className="text-base font-semibold leading-relaxed text-slate-800 p-5 border border-slate-100 rounded-2xl bg-slate-50/40 select-none min-h-[120px] whitespace-pre-wrap">
                  {renderAnnotatedText()}
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Marked a metaphor by mistake?</span>
                  <button
                    onClick={handleRevokeMetaphor}
                    className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01]"
                  >
                    Revoke Metaphor Decision (Mark Literal)
                  </button>
                </div>
              </div>

              {/* Identified Metaphors selection tags list */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-3">
                  Identified Metaphors List
                </span>
                
                {spans.length === 0 ? (
                  <div className="text-center py-4 text-sm text-slate-400 italic">
                    No spans identified. Go back to identification stage.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                     {spans.map((span, idx) => {
                      const isActive = idx === activeIndex;
                      const complete = isSpanComplete(span);
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveIndex(idx)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-2xl border transition-all ${
                            isActive 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10"
                              : complete
                                ? "bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100/50"
                                : "bg-rose-50/40 border-rose-250 text-rose-600 hover:bg-rose-50/80"
                          }`}
                        >
                          <span>"{span.text}"</span>
                          {complete ? (
                            <CheckCircle className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-emerald-600"}`} />
                          ) : (
                            <AlertCircle className={`h-4 w-4 shrink-0 ${isActive ? "text-white animate-pulse" : "text-rose-500 animate-pulse"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Right of Parallel workspace: Classification Form */}
            <div className="space-y-6">
              
              {activeSpan ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Classifying Span</span>
                      <h2 className="text-xl font-black text-slate-900 mt-1">"{activeSpan.text}"</h2>
                    </div>
                    <button
                      onClick={handleDeleteActiveSpan}
                      className="px-2.5 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg shadow-sm transition-all hover:scale-[1.01] shrink-0"
                      title="Remove this specific metaphor highlight"
                    >
                      Delete Span
                    </button>
                  </div>
                  <div className="space-y-5">

                    {/* Section 2: Metaphor Intention */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-4 shadow-sm animate-fade-in">
                      
                      {/* Step 1: Avoidability */}
                      <div className={`p-2.5 rounded-xl transition-all ${isFieldMissing("lexicalized") ? "border border-rose-255 bg-rose-50/20 shadow-sm" : "border border-transparent"}`}>
                        <span className="block text-sm font-black text-black mb-1.5">
                          Classification Step
                        </span>
                        <p className="text-[11px] text-slate-500 mb-3.5 leading-relaxed font-medium">
                          Decide if the metaphoric expression could be avoided.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <label 
                            className={`flex items-center gap-2 p-2.5 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer text-xs font-semibold ${
                              activeSpan.lexicalized === false 
                                ? "bg-indigo-50/50 border-indigo-200 text-indigo-955 font-bold" 
                                : "bg-white border-slate-200 text-slate-650"
                            }`}
                          >
                            <input
                              type="radio"
                              name="lexicalized-group"
                              checked={activeSpan.lexicalized === false}
                              onChange={() => {
                                handleFieldChange("lexicalized", false);
                              }}
                              className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span>Avoidable (non-lexicalized)</span>
                          </label>
                          
                          <label 
                            className={`flex items-center gap-2 p-2.5 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer text-xs font-semibold ${
                              activeSpan.lexicalized === true 
                                ? "bg-indigo-50/50 border-indigo-200 text-indigo-955 font-bold" 
                                : "bg-white border-slate-200 text-slate-650"
                            }`}
                          >
                            <input
                              type="radio"
                              name="lexicalized-group"
                              checked={activeSpan.lexicalized === true}
                              onChange={() => {
                                const updatedSpans = [...spans];
                                updatedSpans[activeIndex] = {
                                  ...updatedSpans[activeIndex],
                                  lexicalized: true,
                                  intentions: []
                                };
                                setSpans(updatedSpans);
                                setCompleted(true);
                              }}
                              className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span>Lexicalized</span>
                          </label>
                        </div>
                      </div>

                      {/* Step 2: Taxonomy of Intentions (Only if non-lexicalized) */}
                      {activeSpan.lexicalized === false && (
                        <div className={`p-2.5 rounded-xl transition-all ${isFieldMissing("intentions") ? "border border-rose-250 bg-rose-50/20 shadow-sm" : "border border-transparent"}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-black text-black">Taxonomy of Intentions</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-[9px] font-bold text-indigo-500 uppercase tracking-widest border border-indigo-100">
                              {(activeSpan.intentions || []).length}/3 Max
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {(schema.interaction_functions || []).map(func => {
                              const isSelected = (activeSpan.intentions || []).includes(func);
                              const details = INTENTION_EXPLANATIONS[func] || { description: "Select to classify the communicative purpose." };
                              
                              return (
                                <div 
                                  key={func}
                                  className="relative group"
                                  onMouseEnter={() => setActiveTooltip(func)}
                                  onMouseLeave={() => setActiveTooltip(null)}
                                >
                                  <label 
                                    className={`flex items-start gap-2.5 p-2.5 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer h-full ${
                                      isSelected 
                                        ? "bg-indigo-50/50 border-indigo-200 text-indigo-950 font-bold" 
                                        : "bg-white border-slate-200 text-slate-650"
                                    } ${(activeSpan.intentions || []).length >= 3 && !isSelected ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                                  >
                                    <div className="pt-0.5">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={(activeSpan.intentions || []).length >= 3 && !isSelected}
                                        onChange={() => handleIntentionToggle(func)}
                                        className="h-3.5 w-3.5 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-colors"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="block text-[11px] font-semibold leading-tight">{func}</span>
                                      <span className="block text-[9px] font-medium text-slate-400 mt-0.5 line-clamp-1">{details.description}</span>
                                    </div>
                                  </label>

                                  {activeTooltip === func && (
                                    <div className="absolute z-[100] left-full top-0 ml-2 w-64 bg-slate-900 text-white text-xs rounded-xl shadow-xl p-3 animate-fade-in pointer-events-none before:content-[''] before:absolute before:top-3 before:-left-1 before:w-2 before:h-2 before:bg-slate-900 before:rotate-45">
                                      <span className="block font-bold text-indigo-300 mb-1">{func}</span>
                                      <p className="text-slate-300 leading-relaxed mb-2">{details.description}</p>
                                      {details.examples && details.examples.length > 0 && (
                                        <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-700/50">
                                          <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Examples:</span>
                                          {details.examples.map((ex, i) => (
                                            <p key={i} className="text-slate-300 italic text-[10px] leading-tight flex gap-1">
                                              <span className="text-indigo-400 font-bold opacity-50">&bull;</span> {ex}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Section 3: Confidence & Comments */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-4 shadow-sm animate-fade-in">
                      
                      {/* Confidence 5-point rating */}
                      <div className={`p-2.5 rounded-xl transition-all ${isFieldMissing("confidence") ? "border border-rose-250 bg-rose-50/20 shadow-sm" : "border border-transparent"}`}>
                        <span className="block text-sm font-black text-black mb-2">
                          Confidence Rating
                        </span>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((val) => {
                            const isActiveVal = activeSpan.confidence === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleFieldChange("confidence", val)}
                                className={`flex-1 h-9.5 rounded-xl border font-bold text-sm transition-all ${
                                  isActiveVal 
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 font-semibold">
                          Notes / Comment
                        </label>
                        <textarea
                          id="notes"
                          value={activeSpan.comment || ""}
                          onChange={(e) => handleFieldChange("comment", e.target.value, true)}
                          onBlur={(e) => {
                            setCompleted(true);
                          }}
                          placeholder=""
                          rows="2.5"
                          className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                  </div></div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 italic shadow-sm">
                  Please choose a metaphor span to view classifications.
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* Control Buttons */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 py-4 px-6 sm:px-8 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 mt-8 flex items-center justify-between shadow-[0_-8px_20px_rgba(0,0,0,0.04)] z-40 rounded-b-[1.25rem]">
        <button
          onClick={handleNavigatePrev}
          disabled={!utterance || saving}
          className="flex items-center gap-1 px-4 py-3 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
          Previous Stage
        </button>
        
        <button
          onClick={handleNavigateNext}
          disabled={!utterance || saving || !isClassificationComplete()}
          className="flex items-center gap-1 px-5 py-3 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span>{isLastTurnOfConversation ? "Submit & Annotate Conversation" : "Submit Turn"}</span>
          <ChevronRight className="h-4.5 w-4.5" />
        </button>
      </div>

    </div>
  );
};
