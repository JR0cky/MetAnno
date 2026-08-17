import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, FileJson, ArrowRight, Sparkles, FolderOpen } from "lucide-react";

export const Login = () => {
  const [annotatorName, setAnnotatorName] = useState("");
  const [datasetChoice, setDatasetChoice] = useState("main");
  const [loading, setLoading] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleAction = async (createNewFile) => {
    if (!annotatorName.trim()) {
      setLocalErr("Please enter your annotator name.");
      return;
    }

    setLoading(true);
    setLocalErr("");
    try {
      await login(annotatorName.trim(), createNewFile, datasetChoice);
      navigate("/dashboard");
    } catch (err) {
      // If the user cancelled the file picker, it throws an AbortError
      if (err.name === 'AbortError') {
        setLocalErr("");
      } else {
        setLocalErr(err.message || "Failed to setup local save file.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 overflow-hidden font-sans text-slate-800">
      {/* Soft gradient decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-200/30 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-violet-200/30 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 animate-fade-in relative z-10">
        
        {/* Header */}
        <div className="text-center relative">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            MetAnno
          </h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Research-Grade Metaphor Annotation Tool
          </p>
        </div>

        {/* Login Form */}
        <div className="mt-8 space-y-6">
          {localErr && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
              {localErr}
            </div>
          )}

          <div>
            <label htmlFor="annotator" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Annotator Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <input
                id="annotator"
                name="annotator"
                type="text"
                required
                value={annotatorName}
                onChange={(e) => setAnnotatorName(e.target.value)}
                placeholder="e.g. annotator1"
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="mb-4">
              <label htmlFor="datasetChoice" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Dataset Selection (For New Files)
              </label>
              <select
                id="datasetChoice"
                name="datasetChoice"
                value={datasetChoice}
                onChange={(e) => setDatasetChoice(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-4 text-sm text-slate-800 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="main">Main Dataset Only</option>
                <option value="pilot">Pilot Dataset Only</option>
              </select>
            </div>

            <button
              onClick={() => handleAction(true)}
              disabled={loading || !annotatorName.trim()}
              className="group relative flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <FileJson className="h-5 w-5 text-indigo-400 transition-colors group-hover:text-indigo-300" />
              </span>
              {loading ? "Opening..." : "Create New Save File"}
              <ArrowRight className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-widest">Or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={() => handleAction(false)}
              disabled={loading || !annotatorName.trim()}
              className="group relative flex w-full justify-center rounded-xl bg-white border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:border-slate-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <FolderOpen className="h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-500" />
              </span>
              {loading ? "Opening..." : "Resume Existing Save File"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
