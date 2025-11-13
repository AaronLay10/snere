import axios, { AxiosInstance } from 'axios';

export class DeviceMonitorClient {
  private readonly client: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs
    });
  }

  public async sendCommand(deviceId: string, payload: unknown) {
    await this.client.post(`/devices/${encodeURIComponent(deviceId)}/command`, payload);
  }

  public async getDeviceState(deviceId: string): Promise<unknown> {
    const response = await this.client.get(`/devices/${encodeURIComponent(deviceId)}/state`);
    return response.data;
  }
}
