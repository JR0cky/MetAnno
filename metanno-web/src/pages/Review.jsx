import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Search, ChevronRight, Check, X, Calendar, ClipboardCheck } from "lucide-react";

export const Review = () => {
  const navigate = useNavigate();
  const projectId = localStorage.getItem("metanno_current_project_id");

  const [utterances, setUtterances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // "all" | "not_started" | "started" | "completed"

  const loadUtterances = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await api.getUtterances(projectId);
      setUtterances(data);
    } catch (err) {
      console.error("Error loading utterances for review:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUtterances();

    // Listen for project changes in header
    window.addEventListener("projectChanged", loadUtterances);
    return () => {
      window.removeEventListener("projectChanged", loadUtterances);
    };
  }, [projectId]);

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "-";
    }
  };

  // Filter and Search logic
  const annotatableUtterances = utterances.filter(u => u.should_annotate !== false);

  const filteredUtterances = annotatableUtterances.filter((u) => {
    const matchesSearch = u.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.conversation_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterMode === "not_started") {
      return matchesSearch && !u.identification_completed;
    }
    if (filterMode === "started") {
      return matchesSearch && u.identification_completed && !(u.classification_completed || u.metaphor_present === false);
    }
    if (filterMode === "completed") {
      return matchesSearch && (u.classification_completed || u.metaphor_present === false);
    }
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">No Project Selected</h2>
        <p className="mt-2 text-sm text-slate-500">Please choose a project from the header to review annotations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-[1800px] mx-auto text-slate-800">
      
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-black">Annotation Review</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Browse, filter, and jump back to individual utterance annotation forms.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search text or conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2 w-full lg:w-auto flex-wrap">
          <button
            onClick={() => setFilterMode("all")}
            className={`flex-1 lg:flex-initial px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
              filterMode === "all"
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All ({annotatableUtterances.length})
          </button>
          <button
            onClick={() => setFilterMode("not_started")}
            className={`flex-1 lg:flex-initial px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
              filterMode === "not_started"
                ? "bg-rose-600 border-rose-600 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Not Started ({annotatableUtterances.filter(u => !u.identification_completed).length})
          </button>
          <button
            onClick={() => setFilterMode("started")}
            className={`flex-1 lg:flex-initial px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
              filterMode === "started"
                ? "bg-amber-600 border-amber-600 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Started / Incomplete ({annotatableUtterances.filter(u => u.identification_completed && !(u.classification_completed || u.metaphor_present === false)).length})
          </button>
          <button
            onClick={() => setFilterMode("completed")}
            className={`flex-1 lg:flex-initial px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
              filterMode === "completed"
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Completed ({annotatableUtterances.filter(u => u.classification_completed || u.metaphor_present === false).length})
          </button>
        </div>
      </div>

      {/* Utterance Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4 w-24">Conversation</th>
                <th className="px-6 py-4 w-20">Speaker</th>
                <th className="px-6 py-4 max-w-[200px]">Utterance</th>
                <th className="px-6 py-4 text-center">Spans</th>
                <th className="px-6 py-4 text-center">Identification</th>
                <th className="px-6 py-4 text-center">Classification</th>
                <th className="px-6 py-4">Last Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredUtterances.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic font-medium">
                    No utterances matching filter rules.
                  </td>
                </tr>
              ) : (
                filteredUtterances.map((u) => (
                  <tr 
                    key={u.id}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/identification/${u.id}`)}
                  >
                    {/* Conversation ID */}
                    <td className="px-6 py-4 font-bold text-slate-600 truncate max-w-[80px]" title={u.conversation_id}>
                      {u.conversation_id}
                    </td>

                    {/* Speaker */}
                    <td className="px-6 py-4 w-20">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        u.speaker === "LLM" 
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                          : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}>
                        {u.speaker}
                      </span>
                    </td>

                    {/* Text Snippet */}
                    <td className="px-6 py-4 max-w-[200px] truncate text-slate-800 font-bold" title={u.text}>
                      {u.text}
                    </td>

                    {/* Spans count */}
                    <td className="px-6 py-4 text-center font-black">
                      {u.spans_count > 0 ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 border border-blue-100">
                          {u.spans_count}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">0</span>
                      )}
                    </td>

                    {/* Identification Done */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {u.identification_completed ? (
                          <div className="rounded-full bg-emerald-50 p-1 text-emerald-600 border border-emerald-100">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="rounded-full bg-slate-50 p-1 text-slate-300 border border-slate-100">
                            <X className="h-4 w-4 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Classification Done */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {u.classification_completed ? (
                          <div className="rounded-full bg-emerald-50 p-1 text-emerald-600 border border-emerald-100">
                            <Check className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="rounded-full bg-slate-50 p-1 text-slate-300 border border-slate-100">
                            <X className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last modified date */}
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-xs font-semibold">
                      {u.last_modified ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(u.last_modified)}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
