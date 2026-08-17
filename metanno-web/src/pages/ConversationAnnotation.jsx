import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { ChevronLeft, ChevronRight, PenTool, MessageSquare, AlertCircle } from "lucide-react";

export const ConversationAnnotation = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const projectId = localStorage.getItem("metanno_current_project_id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const [utterances, setUtterances] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [allUtterancesList, setAllUtterancesList] = useState([]);

  const loadData = async () => {
    if (!projectId || !conversationId) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch conversation detail (utterances + annotations)
      const detail = await api.getConversationDetail(projectId, conversationId);
      setUtterances(detail.utterances || []);
      setAnnotations(detail.annotations || []);

      // Fetch all utterances in project for navigation
      const allUtterances = await api.getUtterances(projectId);
      setAllUtterancesList(allUtterances || []);
    } catch (err) {
      console.error("Error loading conversation data:", err);
      setError("Failed to load conversation data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [conversationId, projectId]);

  // Highlight helper
  const renderHighlightedText = (text, utteranceSpans) => {
    if (!utteranceSpans || utteranceSpans.length === 0) return <span>{text}</span>;

    const pointsSet = new Set([0, text.length]);
    utteranceSpans.forEach(s => {
      if (s.start >= 0 && s.start <= text.length) pointsSet.add(s.start);
      if (s.end >= 0 && s.end <= text.length) pointsSet.add(s.end);
    });

    const sortedPoints = Array.from(pointsSet).sort((a, b) => a - b);
    const elements = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const start = sortedPoints[i];
      const end = sortedPoints[i + 1];
      const segmentText = text.slice(start, end);
      const coveringSpans = utteranceSpans.filter(s => s.start <= start && s.end >= end);

      if (coveringSpans.length === 0) {
        elements.push(<span key={i}>{segmentText}</span>);
      } else {
        elements.push(
          <span
            key={i}
            className="bg-yellow-100 border-b border-amber-500 text-amber-900 rounded-sm px-0.5"
            title={coveringSpans.map(s => `"${s.text}"`).join(", ")}
          >
            {segmentText}
          </span>
        );
      }
    }
    return elements;
  };

  // Navigations
  const handlePrevStage = () => {
    if (utterances.length === 0) return;
    const annotatable = utterances.filter(u => u.should_annotate !== false);
    if (annotatable.length === 0) return;
    const lastUtterance = annotatable[annotatable.length - 1];
    const lastAnn = annotations.find(a => a.utterance_id === lastUtterance.id);
    if (lastAnn?.metaphor_present === true) {
      navigate(`/classification/${lastUtterance.id}`);
    } else {
      navigate(`/identification/${lastUtterance.id}`);
    }
  };

  const handleFinish = async () => {
    if (!projectId || !conversationId) return;
    setSaving(true);
    setStatusMsg("Saving...");

    const payload = {
      project_id: projectId,
      conversation_id: conversationId,
      comment: "",
      completed: true
    };

    try {
      await api.saveConversationAnnotation(payload);
      setStatusMsg("Saved!");

      // Find first annotatable utterance of next conversation
      const annotatableList = allUtterancesList.filter(u => u.should_annotate !== false);
      const lastAnnotatableIndex = annotatableList.map(u => u.conversation_id).lastIndexOf(conversationId);
      
      if (lastAnnotatableIndex !== -1 && lastAnnotatableIndex < annotatableList.length - 1) {
        const nextUtterance = annotatableList[lastAnnotatableIndex + 1];
        navigate(`/identification/${nextUtterance.id}`);
      } else {
        // Last conversation, return to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Error saving conversation annotation:", err);
      setError("Failed to save conversation annotation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
          <span className="text-sm font-medium text-slate-500">Loading conversation transcript...</span>
        </div>
      </div>
    );
  }

  // Find if this is the last conversation
  const lastIndex = allUtterancesList.map(u => u.conversation_id).lastIndexOf(conversationId);
  const isLastConversation = lastIndex === -1 || lastIndex >= allUtterancesList.length - 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <PenTool className="h-6 w-6 text-indigo-600" />
            Conversation Summary
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review the complete annotated transcript of this conversation before proceeding.
          </p>
        </div>
        {statusMsg && (
          <span className={`text-xs px-3 py-1.5 rounded-full font-bold shadow-sm font-semibold ${
            statusMsg === "Saved!" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
          }`}>
            {statusMsg}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Transcript Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex flex-col space-y-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          Full Transcript Review
        </h2>
        
        <div className="space-y-4 rounded-2xl p-4 bg-slate-50/50 border border-slate-100 max-h-[600px] overflow-y-auto pr-2">
          {utterances.map((u) => {
            const uAnn = annotations.find(a => a.utterance_id === u.id);
            const isAssistant = u.speaker === "LLM";
            
            return (
              <div
                key={u.id}
                className={`flex flex-col max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  isAssistant
                    ? "ml-auto bg-indigo-50/50 text-indigo-950 border border-indigo-100"
                    : "mr-auto bg-white text-slate-900 border border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>{u.speaker}</span>
                  <span>•</span>
                  <span>Turn {u.index + 1}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {renderHighlightedText(u.text, uAnn?.metaphors)}
                </p>
                
                {/* Spans Summary */}
                {uAnn?.metaphors && uAnn.metaphors.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/50 space-y-1">
                    {uAnn.metaphors.map((m, idx) => {
                      const typeLabel = m.lexicalized === true ? "Lexicalized" : "Avoidable";
                      const intentionsList = (m.intentions || []).join(", ");
                      const suffix = intentionsList ? `: ${intentionsList}` : "";
                      return (
                        <div key={idx} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold text-indigo-600">"{m.text}"</span>
                          <span className="px-1.5 py-0.5 bg-indigo-100/50 text-indigo-800 rounded font-medium text-[10px]">
                            {typeLabel}{suffix}
                          </span>
                          <span className="text-slate-400">({m.confidence || 0}/5 confidence)</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-4">
          <button
            onClick={handlePrevStage}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-md transition-colors"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
            Previous Stage
          </button>
          
          <button
            onClick={handleFinish}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white shadow-md transition-colors"
          >
            <span>{saving ? "Saving..." : isLastConversation ? "Finish & Go to Dashboard" : "Next Conversation"}</span>
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
