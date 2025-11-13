import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import { logger } from '../logger';

export type ServiceStatus = 'healthy' | 'degraded' | 'unreachable';

export interface RegisteredService {
  id: string;
  name: string;
  url: string;
  status: ServiceStatus;
  lastCheckedAt: number | null;
  lastHealthyAt: number | null;
  metadata: Record<string, unknown>;
}

export interface ServiceRegistryOptions {
  refreshIntervalMs: number;
  timeoutMs: number;
}

export declare interface ServiceRegistry {
  on(event: 'service-status', listener: (service: RegisteredService) => void): this;
}

export class ServiceRegistry extends EventEmitter {
  private readonly services = new Map<string, RegisteredService>();
  private readonly clients = new Map<string, AxiosInstance>();
  private interval?: NodeJS.Timeout;

  constructor(private readonly options: ServiceRegistryOptions) {
    super();
  }

  public register(name: string, url: string, metadata: Record<string, unknown> = {}) {
    const id = uuid();
    const service: RegisteredService = {
      id,
      name,
      url,
      status: 'unreachable',
      lastCheckedAt: null,
      lastHealthyAt: null,
      metadata
    };
    this.services.set(id, service);

    const client = axios.create({
      baseURL: url,
      timeout: this.options.timeoutMs
    });
    this.clients.set(id, client);

    logger.info({ name, url }, 'Registered downstream service');
    return service;
  }

  public list(): RegisteredService[] {
    return Array.from(this.services.values());
  }

  public getByName(name: string): RegisteredService | undefined {
    return this.list().find((service) => service.name === name);
  }

  public getClient(serviceId: string): AxiosInstance | undefined {
    return this.clients.get(serviceId);
  }

  public start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.refreshAll().catch((error) => logger.error(error)), this.options.refreshIntervalMs);
    this.refreshAll().catch((error) => logger.error(error));
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private async refreshAll(): Promise<void> {
    await Promise.all(
      Array.from(this.services.entries()).map(([id, service]) => this.refreshService(id, service))
    );
  }

  private async refreshService(id: string, service: RegisteredService): Promise<void> {
    const client = this.clients.get(id);
    if (!client) return;

    try {
      const response = await client.get('/health');
      const status = response.status === 200 ? 'healthy' : 'degraded';

      service.status = status;
      service.lastCheckedAt = Date.now();
      if (status === 'healthy') {
        service.lastHealthyAt = service.lastCheckedAt;
      }
      service.metadata = { ...service.metadata, health: response.data };
      this.services.set(id, service);
      this.emit('service-status', service);
    } catch (error: any) {
      service.status = 'unreachable';
      service.lastCheckedAt = Date.now();
      this.services.set(id, service);
      this.emit('service-status', service);
      logger.warn({ name: service.name, url: service.url, err: error?.message }, 'Failed to reach downstream service');
    }
  }
}
