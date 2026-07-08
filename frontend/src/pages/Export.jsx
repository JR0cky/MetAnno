import React, { useState, useEffect } from "react";
import { api } from "../api";
import { Download, FileCode, CheckCircle, Copy, AlertCircle } from "lucide-react";

export const Export = () => {
  const projectId = localStorage.getItem("metanno_current_project_id");
  const [projects, setProjects] = useState([]);
  const [selectedProj, setSelectedProj] = useState("");
  const [exportData, setExportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load all projects
    api.getProjects()
      .then((data) => {
        setProjects(data);
        if (projectId && data.some(p => p.id === projectId)) {
          setSelectedProj(projectId);
        } else if (data.length > 0) {
          setSelectedProj(data[0].id);
        }
      })
      .catch(err => console.error("Error fetching projects:", err));
  }, []);

  const handleFetchExport = async () => {
    if (!selectedProj) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getExport(selectedProj);
      setExportData(data);
    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export annotations. Ensure you have administrator rights.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!exportData) return;
    
    const project = projects.find(p => p.id === selectedProj);
    const filename = `${project ? project.name.toLowerCase().replace(/\s+/g, "_") : "annotations"}_export.json`;
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!exportData) return;
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Export Annotations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Download project annotation sets as a standardized JSON structure.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Controls */}
        <div className="space-y-6 md:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Configuration
            </span>
            
            <div>
              <label htmlFor="export-project-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Select Project
              </label>
              <select
                id="export-project-select"
                value={selectedProj}
                onChange={(e) => {
                  setSelectedProj(e.target.value);
                  setExportData(null);
                }}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleFetchExport}
              disabled={!selectedProj || loading}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:bg-slate-300"
            >
              {loading ? "Generating..." : "Generate Export"}
            </button>
          </div>

          {exportData && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Actions
              </span>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download JSON File
              </button>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 text-sm font-semibold transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-semibold text-red-600 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Column: Preview */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
            <FileCode className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              JSON Output Preview
            </span>
          </div>

          <div className="p-6 flex-1 bg-slate-950 font-mono text-xs text-slate-300 overflow-auto max-h-[500px]">
            {exportData ? (
              <pre>{JSON.stringify(exportData, null, 2)}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 italic">
                Click "Generate Export" to preview records.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
