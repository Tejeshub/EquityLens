import { 
  EquityResearchRequest, 
  EquityResearchResponse,
  AskRequest,
  AskResponse 
} from "@/types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const parseResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.statusText}`);
  }
  return response.json();
};

export const apiClient = {
  analyze: async (request: EquityResearchRequest): Promise<EquityResearchResponse> => {
    console.log("API: Calling /analyze with:", request);
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return parseResponse(response);
  },

  ask: async (request: AskRequest): Promise<AskResponse> => {
    console.log("API: Calling /ask with:", request);
    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return parseResponse(response);
  },

  health: async () => {
    const response = await fetch(`${API_BASE_URL}/health`);
    return parseResponse(response);
  },
};
