import axios from 'axios';
import type {
  UploadResponse,
  JobStatusResponse,
  ContractAnalysisResponse,
  VoiceTokenResponse,
  ContractChatRequest,
  ContractChatResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

export const apiClient = {
  /**
   * Request temporary AssemblyAI real-time WebSocket token
   */
  async getVoiceToken(): Promise<VoiceTokenResponse> {
    const res = await api.get<VoiceTokenResponse>('/api/v1/voice/token');
    return res.data;
  },

  /**
   * Upload PDF contract along with optional client context (voice or text notes)
   */
  async uploadContract(file: File, clientContext?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (clientContext && clientContext.trim()) {
      formData.append('client_context', clientContext.trim());
    }
    const res = await api.post<UploadResponse>('/api/v1/contracts/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  /**
   * Poll asynchronous contract audit status
   */
  async getStatus(docId: string): Promise<JobStatusResponse> {
    const res = await api.get<JobStatusResponse>(`/api/v1/contracts/${docId}/status`);
    return res.data;
  },

  /**
   * Fetch complete contract analysis report
   */
  async getAnalysis(docId: string): Promise<ContractAnalysisResponse> {
    const res = await api.get<ContractAnalysisResponse>(`/api/v1/contracts/${docId}/analysis`);
    return res.data;
  },

  /**
   * Interactive Legal Counsel Copilot Chat
   */
  async counselChat(docId: string, payload: ContractChatRequest): Promise<ContractChatResponse> {
    const res = await api.post<ContractChatResponse>(`/api/v1/contracts/${docId}/chat`, payload);
    return res.data;
  },
};
