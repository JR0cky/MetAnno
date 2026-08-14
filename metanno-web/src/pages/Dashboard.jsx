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
        const hasMods = annotatable.some(u => u.identification_completed === true || u.classification_completed === true || (u.spans_count && u.spans_count > 0));
        setHasModifications(hasMods);

        // Next utterance logic: jump straight to whatever is completely untouched, or hasn't finished classification
        const nextIncomplete = annotatable.find(u => !(u.classification_completed || u.metaphor_present === false));
        if (nextIncomplete) {
          setNextUttId(nextIncomplete.id);
          setNextStage("identification"); // The identification page allows them to do both together!
        } else if (annotatable.length > 0) {
          setNextUttId(annotatable[0].id);
          setNextStage("identification");
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
  // Overall progress is based on completely classified utterances
  const overallPercent = progress && progress.total_utterances > 0 
    ? Math.round((progress.classified_count / progress.total_utterances) * 100) 
    : 0;
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
      <div className="grid grid-cols-1 gap-6">
        
        {/* Single Overall Progress Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all group">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Progress</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">Metaphor Annotation</h3>
          </div>
          
          <div className="mt-8">
            <div className="flex justify-end text-sm font-bold mb-2.5">
              <span className="text-indigo-600">{overallPercent}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallPercent}%` }}
              ></div>
            </div>
            
            {/* Distinguish Pilot vs Main here as hinted! */}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-semibold text-slate-500">
                Current Dataset: <span className="text-indigo-700">{project.name}</span>
              </span>
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
            {isNewSession ? `Start ${project.name}` : `Resume ${project.name}`}
          </h3>
          <p className="text-indigo-100 text-xs font-semibold">
            {isNewSession 
              ? `Begin labeling metaphors in the ${project.name}.` 
              : `Pick up right where you left off in the ${project.name}.`}
          </p>
        </div>

        {/* Continue Action */}
        <button
          onClick={handleContinue}
          className="group flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-indigo-600 shadow-md transition-all hover:bg-slate-50 hover:shadow-lg hover:scale-[1.02] focus:outline-none relative z-10 shrink-0 w-full sm:w-auto"
        >
          <span>{isNewSession ? "Start" : "Continue"}</span>
          <ChevronRight className="h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};
