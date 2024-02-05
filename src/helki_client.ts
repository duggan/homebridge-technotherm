import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface NodeResponse {
  nodes: Node[];
}

interface StatusArgs {
  [key: string]: any;
}

interface SetupArgs {
  [key: string]: any;
}

interface PowerLimitResponse {
  power_limit: string;
}

interface Device {
  dev_id: string;
  name: string;
  product_id: string;
  fw_version: string;
  serial_id: string;
}

interface Node {
  name?: string;
  type: string;
  addr: string;
  installed?: boolean;
  lost?: boolean;
}

interface GroupedDevices {
  id: string;
  name: string;
  devs: Device[];
  owner: boolean;
}

interface SetStatus {
  // Common fields for getStatus response and setStatus request
  mode?: 'auto' | 'manual' | 'off';
  units?: 'C' | 'F'; // Temperature units

  // Temperature settings
  stemp?: string; // Set temperature

}

interface Status {
  // Common fields for getStatus response and setStatus request
  mode: 'auto' | 'manual' | 'off';
  units: 'C' | 'F'; // Temperature units

  // Temperature settings
  stemp: string; // Set temperature
  mtemp: string; // Measured temperature
  ice_temp: string; // Ice protection temperature
  eco_temp: string; // Economy mode temperature
  comf_temp: string; // Comfort mode temperature

  // Operational status
  active: boolean; // Device is actively heating/cooling
  locked: number; // 0 or 1, indicating if the device is locked

  // Additional features
  presence: boolean; // Presence detection enabled/disabled
  window_open: boolean; // Window open detection
  true_radiant_active: boolean; // True Radiant feature is active/inactive
  boost: boolean; // Boost mode is active/inactive
  boost_end_min: number; // Minutes until boost mode ends
  boost_end_day: number; // Days until boost mode ends

  // Device information and status
  power: string; // Current power consumption
  duty: number; // Current duty cycle
  act_duty: number; // Actual duty cycle
  pcb_temp: string; // PCB temperature
  power_pcb_temp: string; // Power PCB temperature
  error_code: string; // Current error code

  // Fields not directly related to device's operation mode or settings
  // These might be read-only and not used in setStatus
  sync_status: string; // Synchronization status, likely read-only
}


const MIN_TOKEN_LIFETIME = 60; // seconds

class HelkiClient {
  private apiHost: string;
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private password: string;
  private axiosInstance: AxiosInstance;
  private accessToken: string;
  private expiresAt: Date;

  constructor(
    apiName: string,
    clientId: string,
    clientSecret: string,
    username: string,
    password: string,
    retryAttempts = 5,
  ) {
    this.apiHost = `https://${apiName}.helki.com`;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.username = username;
    this.password = password;

    this.accessToken = '';
    this.expiresAt = new Date();

    this.axiosInstance = axios.create({
      baseURL: this.apiHost,
      timeout: 10000,
    });

    // Add a request interceptor
    this.axiosInstance.interceptors.request.use(config => {
      return config; // Always return the config object
    }, error => {
      if (error.response) {
        // Log any request error
        console.log('Request error:', error);
      }
      return Promise.reject(error);
    });

    // Add a response interceptor
    this.axiosInstance.interceptors.response.use(response => {
      // Log the response details
      return response; // Always return the response object
    }, error => {
      if (error.response) {
        // Log error details including the response from the server
        console.log(`Error response from ${error.response.config.url}:`, error.response);
      }
      return Promise.reject(error);
    });

    axiosRetry(this.axiosInstance, {
      retries: retryAttempts,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429,
    });
  }

  private async auth(): Promise<void> {
    const tokenUrl = `${this.apiHost}/client/token`;
    const tokenData = new URLSearchParams({
      grant_type: 'password',
      username: this.username,
      password: this.password,
    }).toString();
    const basicAuthCredentials = { username: this.clientId, password: this.clientSecret };
    const response = await this.axiosInstance.post<TokenResponse>(tokenUrl, tokenData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: basicAuthCredentials,
    });

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token || !refresh_token || !expires_in) {
      throw new Error('Invalid auth response');
    }

    this.accessToken = access_token;
    this.expiresAt = new Date(Date.now() + expires_in * 1000);

    if (expires_in < MIN_TOKEN_LIFETIME) {
      console.warn(`Token expires in ${expires_in}s, which is below the minimum lifetime of ${MIN_TOKEN_LIFETIME}s.`);
    }
  }

  private hasTokenExpired(): boolean {
    return (this.expiresAt.getTime() - Date.now()) < MIN_TOKEN_LIFETIME * 1000;
  }

  private async checkRefresh(): Promise<void> {
    if (this.hasTokenExpired()) {
      await this.auth();
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async apiRequest<T = any>(path: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<T> {
    await this.checkRefresh();
    const url = `${this.apiHost}/api/v2/${path}`;
    const headers = this.getHeaders();

    try {
      const response = await (method === 'GET'
        ? this.axiosInstance.get<T>(url, { headers })
        : this.axiosInstance.post<T>(url, data, { headers }));
      return response.data;
    } catch (error: any) {
      throw new Error(`API request to ${path} failed: ${error.message}`);
    }
  }

  public async getDevices(): Promise<Device[]> {
    return this.apiRequest<Device[]>('devs');
  }

  public async getGroupedDevices(): Promise<GroupedDevices[]> {
    return this.apiRequest<GroupedDevices[]>('grouped_devs');
  }

  public async getNodes(deviceId: string): Promise<Node[]> {
    const response = await this.apiRequest<{ nodes: Node[] }>(`devs/${deviceId}/mgr/nodes`);
    return response.nodes;
  }

  public async getStatus(deviceId: string, node: Node): Promise<Status> {
    return this.apiRequest<Status>(`devs/${deviceId}/${node.type}/${node.addr}/status`, 'GET');
  }

  public async setStatus(deviceId: string, node: Node, status: SetStatus): Promise<void> {
    // Here, you might want to validate the statusArgs to ensure it only contains writable properties
    await this.apiRequest<void>(`devs/${deviceId}/${node.type}/${node.addr}/status`, 'POST', status);
  }

  public async getSetup(deviceId: string, node: Node): Promise<any> {
    return this.apiRequest(`devs/${deviceId}/${node.type}/${node.addr}/setup`);
  }

  public async setSetup(deviceId: string, node: Node, setupArgs: SetupArgs): Promise<any> {
    let setupData = await this.getSetup(deviceId, node); // Assuming this returns the current setup in a directly usable format
    setupData = { ...setupData, ...setupArgs }; // Merge with new setup arguments
    return this.apiRequest(`devs/${deviceId}/${node.type}/${node.addr}/setup`, 'POST', setupData);
  }

  public async getDeviceAwayStatus(deviceId: string): Promise<any> {
    return this.apiRequest(`devs/${deviceId}/mgr/away_status`);
  }

  public async setDeviceAwayStatus(deviceId: string, statusArgs: StatusArgs): Promise<any> {
    const data = Object.fromEntries(Object.entries(statusArgs).filter(([_, v]) => v != null));
    return this.apiRequest(`devs/${deviceId}/mgr/away_status`, 'POST', data);
  }

  public async getDevicePowerLimit(deviceId: string): Promise<number> {
    const resp = await this.apiRequest<PowerLimitResponse>(`devs/${deviceId}/htr_system/power_limit`);
    return parseInt(resp.power_limit, 10);
  }

  public async setDevicePowerLimit(deviceId: string, powerLimit: number): Promise<void> {
    const data = { power_limit: powerLimit.toString() };
    await this.apiRequest(`devs/${deviceId}/htr_system/power_limit`, 'POST', data);
  }
}

export { HelkiClient, Device, Node, Status, StatusArgs, SetStatus };
