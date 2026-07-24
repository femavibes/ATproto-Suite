import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Agent } from 'https';

class HttpClient {
  private client: AxiosInstance;
  private static instance: HttpClient;

  private constructor() {
    // Create HTTP agent with connection pooling
    const httpsAgent = new Agent({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 60000,
    });

    this.client = axios.create({
      timeout: 30000,
      httpsAgent,
      headers: {
        'User-Agent': 'FeedModerator/1.0',
        'Accept': 'application/json',
        'Connection': 'keep-alive',
      },
      // Retry configuration
      validateStatus: (status) => status < 500, // Don't retry on 4xx errors
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('HTTP Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        // Retry logic for network errors and 5xx responses
        if (
          !config._retry &&
          (error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           (error.response && error.response.status >= 500))
        ) {
          config._retry = true;
          config._retryCount = (config._retryCount || 0) + 1;
          
          if (config._retryCount <= 3) {
            const delay = Math.pow(2, config._retryCount) * 1000; // Exponential backoff
            console.log(`Retrying request in ${delay}ms (attempt ${config._retryCount})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.client(config);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  public getClient(): AxiosInstance {
    return this.client;
  }
}

export const httpClient = HttpClient.getInstance();