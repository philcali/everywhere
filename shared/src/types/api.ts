export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
  };
  timestamp: Date;
  requestId: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ErrorResponse['error'];
  success: boolean;
}