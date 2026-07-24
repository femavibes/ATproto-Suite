import axios, { AxiosInstance } from 'axios';
import { ZeroTrustProxyAuth } from '../types';

export class ZeroTrustProxyClient {
  private client: AxiosInstance;
  private userIdentifier: string;

  constructor(proxyUrl: string, apiKey: string, userIdentifier: string) {
    this.client = axios.create({
      baseURL: proxyUrl,
      headers: { 'X-API-Key': apiKey },
      timeout: 10000
    });
    this.userIdentifier = userIdentifier;
  }

  async getGrazeSession(reason: string): Promise<string> {
    const { data } = await this.client.post<{ sessionCookie: string }>('/auth/graze-session', { 
      reason,
      identifier: this.userIdentifier
    });
    return data.sessionCookie;
  }

  async getBlueskyToken(reason: string): Promise<ZeroTrustProxyAuth> {
    const { data } = await this.client.post<ZeroTrustProxyAuth>('/auth/bluesky-token', { 
      reason,
      identifier: this.userIdentifier
    });
    return data;
  }

  async getMonitoredAccountToken(accountHandle: string, accountDid?: string): Promise<ZeroTrustProxyAuth> {
    const { data } = await this.client.post<ZeroTrustProxyAuth>('/auth/monitored-account', { 
      accountHandle,
      accountDid,
      reason: 'AUTOBLOCK_MONITORED',
      masterIdentifier: this.userIdentifier
    });
    return data;
  }

  async checkStatus(): Promise<{ users_configured: number; healthy: boolean }> {
    const { data} = await this.client.get('/auth/status');
    return data;
  }
}
