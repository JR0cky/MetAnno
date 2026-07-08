const API_BASE_URL = window.location.origin.includes("localhost:5173") 
  ? "http://localhost:8000/api" 
  : "/api";

const getHeaders = () => {
  const token = localStorage.getItem("metanno_token");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Authentication
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Invalid login credentials");
    }
    return response.json();
  },

  getMe: async () => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch user session");
    }
    return response.json();
  },

  // Projects
  getProjects: async () => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    return response.json();
  },

  getSchema: async (projectId) => {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/schema`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch project schema");
    }
    return response.json();
  },

  // Utterances & Annotations
  getUtterances: async (projectId) => {
    const response = await fetch(`${API_BASE_URL}/utterances?project_id=${projectId}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch utterances");
    }
    return response.json();
  },

  getUtteranceDetail: async (utteranceId, projectId) => {
    const response = await fetch(
      `${API_BASE_URL}/utterances/${utteranceId}?project_id=${projectId}`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch utterance details");
    }
    return response.json();
  },

  saveIdentification: async (projectId, utteranceId, metaphors, completed) => {
    const response = await fetch(`${API_BASE_URL}/identification`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        project_id: projectId,
        utterance_id: utteranceId,
        metaphors,
        identification_completed: completed,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to save metaphor spans");
    }
    return response.json();
  },

  saveClassification: async (projectId, utteranceId, metaphors, completed) => {
    const response = await fetch(`${API_BASE_URL}/classification`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        project_id: projectId,
        utterance_id: utteranceId,
        metaphors,
        classification_completed: completed,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to save classifications");
    }
    return response.json();
  },

  // Progress
  getProgress: async (projectId) => {
    const response = await fetch(`${API_BASE_URL}/progress?project_id=${projectId}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch progress information");
    }
    return response.json();
  },

  // Conversation Annotations
  getConversationAnnotation: async (projectId, conversationId) => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/annotation?project_id=${projectId}`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch conversation annotation");
    }
    return response.json();
  },

  getConversationDetail: async (projectId, conversationId) => {
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/detail?project_id=${projectId}`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch conversation detail");
    }
    return response.json();
  },

  saveConversationAnnotation: async (annotationData) => {
    const response = await fetch(`${API_BASE_URL}/conversations/annotation`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(annotationData),
    });
    if (!response.ok) {
      throw new Error("Failed to save conversation annotation");
    }
    return response.json();
  },

  // Admin Actions
  createProject: async (projectData) => {
    const response = await fetch(`${API_BASE_URL}/admin/projects`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to create project");
    }
    return response.json();
  },

  uploadDataset: async (name, file) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);

    const token = localStorage.getItem("metanno_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/upload_dataset`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to upload dataset");
    }
    return response.json();
  },

  getExport: async (projectId) => {
    const response = await fetch(`${API_BASE_URL}/export?project_id=${projectId}`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to export project annotations");
    }
    return response.json();
  },
};
