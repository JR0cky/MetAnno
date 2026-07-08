import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Play, Clock, FileText, CheckCircle2, ChevronRight } from "lucide-react";

export const Dashboard = () => {
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextUttId, setNextUttId] = useState(null);
  const [nextStage, setNextStage] = useState("identification");
  const [hasModifications, setHasModifications] = useState(false);

  const loadDashboardData = async () => {
    try {
      setError("");
      // Fetch user projects
      const projects = await api.getProjects();
      
      // Resolve active project ID (fallback to first available if none in localStorage)
      let projectId = localStorage.getItem("metanno_current_project_id");
      if (!projectId && projects.length > 0) {
        projectId = projects[0].id;
        localStorage.setItem("metanno_current_project_id", projectId);
        // Sync header state
        window.dispatchEvent(new Event("projectChanged"));
      }

      if (!projectId) {
        setProject(null);
        setLoading(false);
        return;
      }

      const activeProj = projects.find(p => p.id === projectId);
      setProject(activeProj);

      if (activeProj) {
        const progData = await api.getProgress(projectId);
        setProgress(progData);

        const utterances = await api.getUtterances(projectId);
        
        const annotatable = utterances.filter(u => u.should_annotate !== false);
        const hasMods = annotatable.some(u => u.identification_completed || u.classification_completed || u.spans_count > 0 || u.last_modified !== null);
        setHasModifications(hasMods);

        const nextIdIncomplete = annotatable.find(u => !u.identification_completed);
        if (nextIdIncomplete) {
          setNextUttId(nextIdIncomplete.id);
          setNextStage("identification");
        } else {
          const nextClassIncomplete = annotatable.find(u => !u.classification_completed);
          if (nextClassIncomplete) {
            setNextUttId(nextClassIncomplete.id);
            setNextStage("classification");
          } else if (annotatable.length > 0) {
            setNextUttId(annotatable[0].id);
            setNextStage("classification");
          }
        }
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Failed to load dashboard metrics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    window.addEventListener("projectChanged", loadDashboardData);
    return () => {
      window.removeEventListener("projectChanged", loadDashboardData);
    };
  }, []);

  const handleContinue = () => {
    const projectId = localStorage.getItem("metanno_current_project_id");
    if (nextUttId && projectId) {
      navigate(`/${nextStage}/${nextUttId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
      </div>
    );
  }

  const currentProjectId = localStorage.getItem("metanno_current_project_id");
  if (!currentProjectId || !project) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center animate-fade-in max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-slate-800">No Projects Setup</h2>
        <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
          Please log in as an administrator to create your first annotation project and upload a dataset.
        </p>
      </div>
    );
  }
  const idPercent = progress ? Math.round(progress.identification_progress * 100) : 0;
  const classPercent = progress ? Math.round(progress.classification_progress * 100) : 0;
  const isNewSession = !hasModifications;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto text-slate-800">
      
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-2xl font-black text-slate-950 mt-0.5">Dashboard</h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* Main Grid Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Stage 1: Identification Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all group">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phase 1</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">Metaphor Identification</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Read through utterances and select word spans representing metaphorical actions or frames.
            </p>
          </div>
          
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm font-bold mb-2.5">
              <span className="text-slate-600">Identification rate</span>
              <span className="text-indigo-600">{idPercent}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${idPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Stage 2: Classification Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all group">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phase 2</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">Metaphor Classification</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Assign conceptual metaphors, target/source frames, conversational purpose, and confidence levels.
            </p>
          </div>
          
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm font-bold mb-2.5">
              <span className="text-slate-600">Classification rate</span>
              <span className="text-fuchsia-600">{classPercent}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-violet-500 to-fuchsia-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${classPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

      </div>

      {/* Continue Button Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute left-[30%] top-[-20%] h-32 w-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="space-y-1 relative z-10">
          <h3 className="text-lg font-black">
            {isNewSession ? "Start" : "Resume Annotation Session"}
          </h3>
          <p className="text-indigo-100 text-xs font-semibold">
            {isNewSession 
              ? "Begin labeling metaphors in the conversation corpus." 
              : "Pick up right where you left off in the conversation corpus."}
          </p>
        </div>

        {/* Continue Action */}
        <button
          onClick={handleContinue}
          className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-indigo-600 shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02] focus:outline-none relative z-10 shrink-0 w-full sm:w-auto"
        >
          <span>{isNewSession ? "Start" : "Continue"}</span>
          <ChevronRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Review Explanation Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800">Need to make corrections or browse annotations?</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Use the **Review** tab in the header to search, filter, and jump back to edit any previously annotated data.
          </p>
        </div>
        <button
          onClick={() => navigate("/review")}
          className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl shadow-sm transition-all hover:scale-[1.01] shrink-0 w-full sm:w-auto"
        >
          Go to Review
        </button>
      </div>
    </div>
  );
};
