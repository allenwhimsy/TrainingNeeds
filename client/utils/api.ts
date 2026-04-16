const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

export interface Questionnaire {
  id: number;
  title: string;
  description: string;
  deadline: string;
  status: 'active' | 'completed';
  qr_code_url: string;
  created_at: string;
  updated_at: string;
}

export interface Suggestion {
  id: number;
  questionnaire_id: number;
  content: string;
  submitter_name: string;
  created_at: string;
}

export interface Report {
  id: number;
  questionnaire_id: number;
  analysis_content: string;
  word_file_key: string;
  word_download_url: string;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
  updated_at: string;
}

// Create questionnaire
export async function createQuestionnaire(data: {
  title: string;
  description: string;
  deadline: string;
}): Promise<Questionnaire> {
  const response = await fetch(`${API_BASE_URL}/api/v1/questionnaires`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create questionnaire');
  }
  
  return response.json();
}

// Get all questionnaires
export async function getQuestionnaires(): Promise<Questionnaire[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/questionnaires`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch questionnaires');
  }
  
  return response.json();
}

// Get single questionnaire
export async function getQuestionnaire(id: number): Promise<Questionnaire> {
  const response = await fetch(`${API_BASE_URL}/api/v1/questionnaires/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch questionnaire');
  }
  
  return response.json();
}

// Submit suggestion
export async function submitSuggestion(
  questionnaireId: number,
  data: { content: string; submitterName?: string }
): Promise<Suggestion> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/questionnaires/${questionnaireId}/suggestions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit suggestion');
  }
  
  return response.json();
}

// Get suggestions
export async function getSuggestions(questionnaireId: number): Promise<Suggestion[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/questionnaires/${questionnaireId}/suggestions`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch suggestions');
  }
  
  return response.json();
}

// Trigger analysis
export async function triggerAnalysis(questionnaireId: number): Promise<Report> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/questionnaires/${questionnaireId}/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to trigger analysis');
  }
  
  return response.json();
}

// Get report
export async function getReport(questionnaireId: number): Promise<Report> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/questionnaires/${questionnaireId}/report`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch report');
  }
  
  return response.json();
}

// Download word report
export async function downloadReport(questionnaireId: number): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/questionnaires/${questionnaireId}/report/download`
  );
  
  if (!response.ok) {
    throw new Error('Failed to download report');
  }
  
  // Return the blob URL for download
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
