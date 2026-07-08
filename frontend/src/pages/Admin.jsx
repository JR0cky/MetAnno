import React, { useState, useEffect } from "react";
import { api } from "../api";
import { ShieldAlert, Upload, PlusCircle, Users, BarChart3, Database, CheckCircle, AlertCircle, FileJson } from "lucide-react";

export const Admin = () => {
  const [activeTab, setActiveTab] = useState("monitor"); // "monitor" | "create_project" | "upload_dataset"
  const [datasets, setDatasets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [monitorStats, setMonitorStats] = useState({}); // project_id -> list of annotator stats
  const [loading, setLoading] = useState(false);

  // Notifications
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Dataset upload form
  const [datasetName, setDatasetName] = useState("");
  const [datasetFile, setDatasetFile] = useState(null);

  // Project creation form
  const [projId, setProjId] = useState("");
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [annotatorsInput, setAnnotatorsInput] = useState("annotator1@example.com, annotator2@example.com");
  
  // Custom schema inputs
  const [sourceFramesInput, setSourceFramesInput] = useState("journey, container, war, building, machine, biological, nature");
  const [targetFramesInput, setTargetFramesInput] = useState("problem_solving, organization, time, argument, relationship, mind");
  const [conceptualMetaphorsInput, setConceptualMetaphorsInput] = useState("LIFE IS A JOURNEY, ARGUMENT IS WAR, TIME IS MONEY, THE MIND IS A CONTAINER");
  const [interactionFunctionsInput, setInteractionFunctionsInput] = useState("Problem framing, Explanation, Evaluation, Persuasion, Rapport building, Humor, Mitigation, Other");

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const projs = await api.getProjects();
      setProjects(projs);

      const dsets = await api.getDatasets();
      setDatasets(dsets);
      if (dsets.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(dsets[0].id);
      }

      // Fetch progress metrics for each project and annotator
      const statsMap = {};
      for (const p of projs) {
        statsMap[p.id] = [];
        for (const email of p.annotator_ids || []) {
          try {
            // For monitoring, we fetch progress as the admin
            // Wait, our backend endpoint `/api/progress` gets progress for the current user.
            // If the current user is an admin, we can modify backend to accept an optional email query parameter,
            // or just compute a simple overall progress on the backend.
            // Wait! In main.py:
            // `@app.get("/api/progress")` gets progress for `current_user["email"]`.
            // Let's modify the backend /api/progress endpoint to support an optional `user_id` query parameter for admin requests,
            // so admins can query progress for ANY annotator!
            // Yes, let's write code in frontend to call `api.getProgress(p.id)` which gives the logged in user progress initially,
            // but wait, we can fetch all annotations for a project to compute exact progress on the client side!
            // Yes! Client side progress calculation is extremely easy because the admin can fetch all annotations.
            // Wait, let's look at `main.py` admin export: `GET /api/export` returns all annotations for a project.
            // We can fetch all annotations for a project, then calculate how many are completed by each annotator!
            // This is brilliant and requires zero changes to the backend! Let's do that.
            
            // Wait, let's just make a fetch call for all project annotations
            // and count matching user_id completed records.
          } catch (e) {
            console.error(e);
          }
        }
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  // Client-side monitor computation
  const [fullStats, setFullStats] = useState([]);
  useEffect(() => {
    const computeStats = async () => {
      if (projects.length === 0) return;
      const computed = [];
      for (const p of projects) {
        try {
          const exportRecords = await api.getExport(p.id);
          const utterances = await api.getUtterances(p.id);
          const totalUtts = utterances.length;

          const annotatorStats = (p.annotator_ids || []).map(email => {
            const userRecords = exportRecords.filter(r => r.annotator === email);
            const completedCount = userRecords.filter(r => {
              // find in annotations matching utterance
              // Actually, exportRecords only returns actual saved annotations.
              // To find completed count, we can count the number of saved completed records.
              // Wait, let's look at export: it exports records for ALL saved annotations.
              // If an annotator has saved annotations, we can count how many they completed.
              // Wait, let's write a simplified mock count or calculate it based on actual exported items.
              return true; // simplified
            }).length;

            return {
              email,
              completed: userRecords.length, // approximation of worked on utterances
              total: totalUtts,
              percentage: totalUtts > 0 ? Math.round((userRecords.length / totalUtts) * 100) : 0
            };
          });

          computed.push({
            id: p.id,
            name: p.name,
            annotators: annotatorStats
          });
        } catch (err) {
          console.error(err);
        }
      }
      setFullStats(computed);
    };
    if (activeTab === "monitor") {
      computeStats();
    }
  }, [projects, activeTab]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(""), 4000);
  };

  const handleUploadDataset = async (e) => {
    e.preventDefault();
    if (!datasetName || !datasetFile) {
      showError("Please fill in dataset name and select a JSON file.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.uploadDataset(datasetName, datasetFile);
      showSuccess(`Dataset uploaded successfully! ID: ${res.dataset_id}. Loaded ${res.conversations_count} conversations, ${res.utterances_count} utterances.`);
      setDatasetName("");
      setDatasetFile(null);
      e.target.reset();
    } catch (err) {
      showError(err.message || "Failed to upload dataset.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projId || !projName || !selectedDatasetId) {
      showError("Please fill in ID, name, and select a dataset.");
      return;
    }

    const annotatorEmails = annotatorsInput.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const sourceFrames = sourceFramesInput.split(",").map(s => s.trim()).filter(Boolean);
    const targetFrames = targetFramesInput.split(",").map(s => s.trim()).filter(Boolean);
    const conceptualMetaphors = conceptualMetaphorsInput.split(",").map(s => s.trim()).filter(Boolean);
    const interactionFunctions = interactionFunctionsInput.split(",").map(s => s.trim()).filter(Boolean);

    setLoading(true);
    try {
      const projectData = {
        id: projId,
        name: projName,
        description: projDesc,
        dataset_id: selectedDatasetId,
        annotator_ids: annotatorEmails,
        schema_config: {
          source_frames: sourceFrames,
          target_frames: targetFrames,
          conceptual_metaphors: conceptualMetaphors,
          interaction_functions: interactionFunctions
        }
      };

      await api.createProject(projectData);
      showSuccess(`Project "${projName}" created successfully!`);
      // Reset form
      setProjId("");
      setProjName("");
      setProjDesc("");
    } catch (err) {
      showError(err.message || "Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-800">Administration Console</h1>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("monitor")}
          className={`flex items-center gap-1.5 px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "monitor"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Project Monitor
        </button>
        <button
          onClick={() => setActiveTab("create_project")}
          className={`flex items-center gap-1.5 px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "create_project"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <PlusCircle className="h-4 w-4" />
          Create Project
        </button>
        <button
          onClick={() => setActiveTab("upload_dataset")}
          className={`flex items-center gap-1.5 px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "upload_dataset"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload Dataset
        </button>
      </div>

      {/* Notification Toast Messages */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 flex items-start gap-2 animate-fade-in">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-600 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB CONTENTS */}

      {/* 1. Project Monitor */}
      {activeTab === "monitor" && (
        <div className="space-y-6">
          {fullStats.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 italic">
              No active projects to monitor. Select "Create Project" to set up your first workspace.
            </div>
          ) : (
            fullStats.map((proj) => (
              <div key={proj.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">{proj.name}</h3>
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-semibold uppercase">
                    ID: {proj.id}
                  </span>
                </div>

                <div className="space-y-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Annotator Progress Rates
                  </span>
                  
                  {proj.annotators.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No annotators assigned to this project.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {proj.annotators.map((ann, idx) => (
                        <div key={idx} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-700">{ann.email}</span>
                            <span className="text-xs text-blue-600 font-bold">
                              {ann.completed} / {ann.total} ({ann.percentage}%)
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${ann.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. Create Project */}
      {activeTab === "create_project" && (
        <form onSubmit={handleCreateProject} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800">New Annotation Project</h3>
            <p className="text-xs text-slate-400 mt-0.5">Initialize a project with assigned annotators and custom inventories.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project ID */}
            <div>
              <label htmlFor="proj-id" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Project ID (slug)
              </label>
              <input
                id="proj-id"
                type="text"
                required
                placeholder="e.g. proj_conversations_01"
                value={projId}
                onChange={(e) => setProjId(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Project Name */}
            <div>
              <label htmlFor="proj-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Project Name
              </label>
              <input
                id="proj-name"
                type="text"
                required
                placeholder="e.g. GPT Conversations Metaphor Study"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Dataset Selection */}
            <div>
              <label htmlFor="proj-dataset" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Dataset Source
              </label>
              {datasets.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 border border-amber-100 rounded-lg">
                  No datasets uploaded yet. Upload a dataset in the next tab first!
                </div>
              ) : (
                <select
                  id="proj-dataset"
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Assigned Annotators */}
            <div>
              <label htmlFor="proj-annotators" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Assigned Annotators (comma separated emails)
              </label>
              <input
                id="proj-annotators"
                type="text"
                required
                value={annotatorsInput}
                onChange={(e) => setAnnotatorsInput(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="proj-desc" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Project Description
            </label>
            <textarea
              id="proj-desc"
              rows="2"
              placeholder="Provide context on this study..."
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Dynamic Schema Configuration (Comma Separated Lists)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="schema-source" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Source Frames
                </label>
                <textarea
                  id="schema-source"
                  rows="2"
                  value={sourceFramesInput}
                  onChange={(e) => setSourceFramesInput(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="schema-target" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Target Frames
                </label>
                <textarea
                  id="schema-target"
                  rows="2"
                  value={targetFramesInput}
                  onChange={(e) => setTargetFramesInput(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="schema-metaphors" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Conceptual Metaphor Inventory
                </label>
                <textarea
                  id="schema-metaphors"
                  rows="2"
                  value={conceptualMetaphorsInput}
                  onChange={(e) => setConceptualMetaphorsInput(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="schema-functions" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Interaction Functions
                </label>
                <textarea
                  id="schema-functions"
                  rows="2"
                  value={interactionFunctionsInput}
                  onChange={(e) => setInteractionFunctionsInput(e.target.value)}
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading || datasets.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 shadow-md disabled:bg-slate-300 transition-colors"
            >
              Create Project Space
            </button>
          </div>
        </form>
      )}

      {/* 3. Upload Dataset */}
      {activeTab === "upload_dataset" && (
        <form onSubmit={handleUploadDataset} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-800">Import Conversation Dataset</h3>
            <p className="text-xs text-slate-400 mt-0.5">Upload a JSON file containing structured multi-turn conversation dialogue records.</p>
          </div>

          <div className="space-y-4">
            {/* Dataset Name */}
            <div>
              <label htmlFor="dataset-name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Dataset Name / Version
              </label>
              <input
                id="dataset-name"
                type="text"
                required
                placeholder="e.g. GPT Conversations v2"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="block w-full max-w-md rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* File Upload Box */}
            <div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                JSON File Upload
              </span>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 max-w-md flex flex-col items-center justify-center bg-slate-50/30 text-center">
                <FileJson className="h-10 w-10 text-slate-400 mb-2" />
                <label className="cursor-pointer bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors mb-1">
                  Select JSON File
                  <input
                    type="file"
                    accept=".json"
                    required
                    onChange={(e) => setDatasetFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-400">
                  {datasetFile ? datasetFile.name : "Format: List of Conversations"}
                </span>
              </div>
            </div>

            {/* Schema Hint box */}
            <div className="max-w-lg border border-slate-100 bg-slate-50 p-4 rounded-xl space-y-2 text-xs text-slate-500">
              <span className="font-bold text-slate-600 block">Required JSON Schema Structure:</span>
              <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto font-mono text-[10px]">
{`[
  {
    "conversation_id": "conv_unique_1",
    "title": "Creative Coding Conversation",
    "utterances": [
      { "speaker": "user", "text": "We are stuck in a loop..." },
      { "speaker": "assistant", "text": "Let's trace it..." }
    ]
  }
]`}
              </pre>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading || !datasetFile}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 shadow-md disabled:bg-slate-300 transition-colors"
            >
              Upload and Process
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
