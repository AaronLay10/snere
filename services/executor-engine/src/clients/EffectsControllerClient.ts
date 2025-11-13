import axios, { AxiosInstance } from 'axios';

export class EffectsControllerClient {
  private readonly client: AxiosInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs
    });
  }

  public async triggerSequence(sequenceId: string, payload?: unknown) {
    await this.client.post('/sequences/trigger', {
      sequenceId,
      payload: payload ?? null
    });
  }
}
