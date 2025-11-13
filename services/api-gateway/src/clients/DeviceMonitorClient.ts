import axios, { AxiosInstance } from 'axios';

export class DeviceMonitorClient {
  private readonly client: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs
    });
  }

  public async listDevices() {
    const { data } = await this.client.get('/devices');
    return data;
  }

  public async getDevice(deviceId: string) {
    const { data } = await this.client.get(`/devices/${encodeURIComponent(deviceId)}`);
    return data;
  }

  public async sendCommand(deviceId: string, payload: unknown) {
    const { data } = await this.client.post(`/devices/${encodeURIComponent(deviceId)}/command`, payload);
    return data;
  }

  public async deleteDevice(deviceId: string) {
    const { data } = await this.client.delete(`/devices/${encodeURIComponent(deviceId)}`);
    return data;
  }
}
