import localforage from "localforage";
import Papa from "papaparse";

// Initialize localforage stores
const db = localforage.createInstance({ name: "MetAnnoWeb" });

// We keep a reference to the active file handle in memory
let activeFileHandle = null;

// ==========================================
// FILE SYSTEM ACCESS API & INITIALIZATION
// ==========================================

export const api = {
  // Authentication & File Setup
  login: async (annotatorName, createNewFile = true, datasetChoice = "both") => {
    try {
      let fileHandle = null;
      
      // Check if browser supports File System Access API
      if (window.showSaveFilePicker) {
        if (createNewFile) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: `metanno_${annotatorName.replace(/\\s+/g, '_')}_data.json`,
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          });
        } else {
          const [handle] = await window.showOpenFilePicker({
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          });
          fileHandle = handle;
        }
        activeFileHandle = fileHandle;
      } else {
        console.warn("File System Access API not supported. Falling back to internal browser storage (IndexedDB).");
      }
      
      // Save session info
      await db.setItem("currentUser", { name: annotatorName });
      
      let text = "";
      if (fileHandle) {
        if (!createNewFile) {
          const file = await fileHandle.getFile();
          text = await file.text();
        }
      } else {
        // Fallback: check if we already have data in IndexedDB for this user
        if (!createNewFile) {
          const existingData = await db.getItem("appData_v4");
          if (existingData) {
              text = JSON.stringify(existingData);
          }
        }
      }
      
      let appData_v4 = {
        projects: {},
        schemas: {},
        utterances: {},
        annotations: {} // stores user's annotations
      };

      if (text && text.trim().length > 0) {
        appData_v4 = JSON.parse(text);
        
        // Clean up deprecated schema fields from existing files
        if (appData_v4.schemas) {
          Object.values(appData_v4.schemas).forEach(schema => {
            delete schema.conceptual_metaphors;
            delete schema.source_frames;
            delete schema.target_frames;
          });
        }
        // Clean up deprecated annotation fields from existing files
        if (appData_v4.annotations) {
          Object.values(appData_v4.annotations).forEach(ann => {
            if (ann.metaphors) {
              ann.metaphors.forEach(m => {
                delete m.conceptual_metaphor;
                delete m.source_frame;
                delete m.target_frame;
              });
            }
          });
        }
        if (appData_v4.conversation_annotations) {
          Object.values(appData_v4.conversation_annotations).forEach(ann => {
            delete ann.conceptual_metaphor;
            delete ann.source_domain;
            delete ann.target_domain;
          });
        }
      } else {
        // Initialize fresh data by reading CSVs from /public
        appData_v4 = await initializeFreshData(datasetChoice);
      }

      await db.setItem("appData_v4", appData_v4);
      await saveToDisk(appData_v4); // Ensure file has initial structure

      return { user: { email: annotatorName, name: annotatorName, role: "annotator" } };
    } catch (error) {
      console.error("Login/File setup failed:", error);
      throw error;
    }
  },

  getMe: async () => {
    const user = await db.getItem("currentUser");
    if (!user) throw new Error("No active session");
    
    // If the browser supports File System API but we lost the handle (e.g. reload)
    if (window.showSaveFilePicker && !activeFileHandle) {
        throw new Error("File permission lost. Please log in again.");
    }
    
    return { user: { email: user.name, name: user.name, role: "annotator" } };
  },

  // Projects
  getProjects: async () => {
    const data = await db.getItem("appData_v4");
    return Object.values(data.projects || {});
  },

  getSchema: async (projectId) => {
    const data = await db.getItem("appData_v4");
    const schema = data.schemas[projectId];
    if (!schema) throw new Error("Schema not found");
    return schema;
  },

  // Utterances
  getUtterances: async (projectId) => {
    const data = await db.getItem("appData_v4");
    const utterances = Object.values(data.utterances || {}).filter(u => u.dataset_id === data.projects[projectId]?.dataset_id);
    const annotations = Object.values(data.annotations || {}).filter(a => a.project_id === projectId);
    
    // Merge annotations into utterances so the UI gets what it expects
    return utterances.map(utt => {
      // Fix string booleans from older cached data
      let shouldAnn = utt.should_annotate;
      if (typeof shouldAnn === 'string') {
        shouldAnn = ["true", "1", "yes"].includes(shouldAnn.toLowerCase());
      }
      
      const ann = annotations.find(a => a.utterance_id === utt.id);
      if (ann) {
         return {
           ...utt,
           should_annotate: shouldAnn,
           identification_completed: ann.identification_completed,
           classification_completed: ann.classification_completed,
           spans_count: (ann.metaphors || []).length,
           last_modified: ann.last_modified || new Date().toISOString(),
           metaphor_present: ann.metaphor_present
         };
      }
      return { ...utt, should_annotate: shouldAnn };
    });
  },

  getProgress: async (projectId) => {
    const utterances = await api.getUtterances(projectId);
    const annotatable = utterances.filter(u => u.should_annotate !== false);
    
    const idDone = annotatable.filter(u => u.identification_completed).length;
    const classDone = annotatable.filter(u => u.classification_completed || u.metaphor_present === false).length;
    const total = annotatable.length;
    
    return {
      identification_progress: total > 0 ? (idDone / total) * 100 : 0,
      classification_progress: total > 0 ? (classDone / total) * 100 : 0,
      total_utterances: total,
      identified_count: idDone,
      classified_count: classDone
    };
  },

  getUtteranceDetail: async (utteranceId, projectId) => {
    const data = await db.getItem("appData_v4");
    const utterance = data.utterances[utteranceId];
    
    // Find context (previous 5, next 5)
    const allUtterances = Object.values(data.utterances || {}).filter(u => u.conversation_id === utterance.conversation_id);
    allUtterances.sort((a, b) => a.index - b.index);
    
    const uIdx = allUtterances.findIndex(u => u.id === utteranceId);
    const startIdx = Math.max(0, uIdx - 5);
    const endIdx = Math.min(allUtterances.length - 1, uIdx + 5);
    
    const rawContext = allUtterances.slice(startIdx, endIdx + 1);
    
    const context = rawContext.map(utt => {
      let shouldAnn = utt.should_annotate;
      if (typeof shouldAnn === 'string') {
        shouldAnn = ["true", "1", "yes"].includes(shouldAnn.toLowerCase());
      }
      return { ...utt, should_annotate: shouldAnn };
    });

    const annotation = data.annotations[`${projectId}_${utteranceId}`] || null;

    return { utterance, context, annotation };
  },

  getConversationDetail: async (projectId, conversationId) => {
    const data = await db.getItem("appData_v4");
    const allUtterances = Object.values(data.utterances || {}).filter(u => u.conversation_id === conversationId);
    allUtterances.sort((a, b) => a.index - b.index);
    
    allUtterances.forEach(utt => {
      let shouldAnn = utt.should_annotate;
      if (typeof shouldAnn === 'string') {
        utt.should_annotate = ["true", "1", "yes"].includes(shouldAnn.toLowerCase());
      }
    });

    const allAnnotations = Object.values(data.annotations || {}).filter(a => a.project_id === projectId);
    const annotationsForConv = allAnnotations.filter(a => allUtterances.some(u => u.id === a.utterance_id));

    return { utterances: allUtterances, annotations: annotationsForConv };
  },

  // Saving
  saveConversationAnnotation: async (payload) => {
    const data = await db.getItem("appData_v4");
    if (!data.conversation_annotations) {
      data.conversation_annotations = {};
    }
    const annId = `${payload.project_id}_${payload.conversation_id}`;
    data.conversation_annotations[annId] = {
      ...payload,
      last_modified: new Date().toISOString()
    };
    await db.setItem("appData_v4", data);
    await saveToDisk(data);
    return true;
  },
  updateMetaphorPresence: async (projectId, utteranceId, metaphorPresent) => {
    const data = await db.getItem("appData_v4");
    const user = await db.getItem("currentUser");
    const annId = `${projectId}_${utteranceId}`;
    
    const annotation = data.annotations[annId] || {
      id: annId,
      project_id: projectId,
      utterance_id: utteranceId,
      user_id: user.name,
      metaphors: [],
      identification_completed: false,
      classification_completed: false
    };
    
    annotation.metaphor_present = metaphorPresent;
    annotation.last_modified = new Date().toISOString();
    
    data.annotations[annId] = annotation;
    await db.setItem("appData_v4", data);
    await saveToDisk(data);
    
    return { annotation };
  },

  saveIdentification: async (projectId, utteranceId, metaphors, completed) => {
    const data = await db.getItem("appData_v4");
    const user = await db.getItem("currentUser");
    const annId = `${projectId}_${utteranceId}`;
    
    const annotation = data.annotations[annId] || {
      id: annId,
      project_id: projectId,
      utterance_id: utteranceId,
      user_id: user.name,
      metaphors: [],
      identification_completed: false,
      classification_completed: false
    };

    annotation.metaphors = metaphors;
    annotation.identification_completed = completed;
    
    data.annotations[annId] = annotation;
    await db.setItem("appData_v4", data);
    await saveToDisk(data); // Auto-save!
    
    return { annotation };
  },

  saveClassification: async (projectId, utteranceId, metaphors, completed) => {
    const data = await db.getItem("appData_v4");
    const user = await db.getItem("currentUser");
    const annId = `${projectId}_${utteranceId}`;
    
    const annotation = data.annotations[annId];
    if (!annotation) throw new Error("Cannot classify before identification");

    annotation.metaphors = metaphors;
    annotation.classification_completed = completed;
    
    data.annotations[annId] = annotation;
    await db.setItem("appData_v4", data);
    await saveToDisk(data); // Auto-save!
    
    return { annotation };
  },

  exportData: async () => {
    const data = await db.getItem("appData_v4");
    const user = await db.getItem("currentUser");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metanno_${user.name.replace(/\\s+/g, '_')}_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// ==========================================
// HELPERS
// ==========================================

async function saveToDisk(appData_v4) {
  if (!activeFileHandle) return;
  try {
    const writable = await activeFileHandle.createWritable();
    await writable.write(JSON.stringify(appData_v4, null, 2));
    await writable.close();
  } catch (err) {
    console.error("Autosave failed:", err);
  }
}

async function initializeFreshData(datasetChoice = "both") {
  const shared_schema = {
    interaction_functions: ["Problem framing", "Explanation", "Evaluation", "Persuasion", "Rapport building", "Humor", "Mitigation", "Other", "Artistic metaphor", "Visualization", "Argumentative metaphor", "Social interaction", "Heuristic reasoning"]
  };

  const appData_v4 = {
    projects: {},
    schemas: {},
    utterances: {},
    annotations: {}
  };

  if (datasetChoice === "main" || datasetChoice === "both") {
    appData_v4.projects["proj_01"] = { id: "proj_01", name: "Main Dataset", dataset_id: "dataset_main" };
    appData_v4.schemas["proj_01"] = shared_schema;
  }
  
  if (datasetChoice === "pilot" || datasetChoice === "both") {
    appData_v4.projects["proj_pilot"] = { id: "proj_pilot", name: "Pilot Dataset", dataset_id: "dataset_pilot" };
    appData_v4.schemas["proj_pilot"] = shared_schema;
  }

  // Load and parse CSVs
  if (datasetChoice === "main" || datasetChoice === "both") {
    await loadCSVToAppData(`${import.meta.env.BASE_URL}main_anno.csv`, 'dataset_main', appData_v4);
  }
  if (datasetChoice === "pilot" || datasetChoice === "both") {
    await loadCSVToAppData(`${import.meta.env.BASE_URL}pilot_anno.csv`, 'dataset_pilot', appData_v4);
  }
  
  return appData_v4;
}

async function loadCSVToAppData(csvUrl, datasetId, appData_v4) {
  return new Promise((resolve) => {
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach(row => {
          const c_id = row["conversation_id"];
          if (!c_id) return;
          const suffix = datasetId.split("_").pop();
          const conv_key = `conv_${suffix}_${c_id}`;
          const u_idx_str = row["message_index"];
          const utt_key = `utt_${suffix}_${c_id}_${u_idx_str}`;
          
          let should_ann = true;
          if (row.should_annotate) {
              should_ann = ["true", "1", "yes"].includes(row.should_annotate.toLowerCase());
          }

          appData_v4.utterances[utt_key] = {
            id: utt_key,
            conversation_id: conv_key,
            dataset_id: datasetId,
            speaker: row["role"] === "llm" ? "LLM" : "User",
            index: parseInt(u_idx_str) || 0,
            text: row["plain_text"] || "",
            should_annotate: should_ann
          };
        });
        resolve();
      },
      error: (err) => {
        console.warn(`Failed to parse ${csvUrl}`, err);
        resolve();
      }
    });
  });
}
