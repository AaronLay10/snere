import osc from 'osc';
import { EventEmitter } from 'events';
import { logger } from '../logger.js';

export interface OSCClientConfig {
  remoteAddress: string;
  remotePort: number;
  localPort?: number;
  backupAddress?: string;
}

export class OSCClient extends EventEmitter {
  private udpPort: any;
  private connected = false;
  private currentHost: string;
  private useBackup = false;

  constructor(private readonly config: OSCClientConfig) {
    super();
    this.currentHost = config.remoteAddress;
  }

  public async start(): Promise<void> {
    this.createUDPPort();
  }

  private createUDPPort(): void {
    this.udpPort = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: this.config.localPort || 0,
      remoteAddress: this.currentHost,
      remotePort: this.config.remotePort,
      metadata: true
    });

    this.udpPort.on('ready', () => {
      this.connected = true;
      logger.info({
        remoteAddress: this.currentHost,
        remotePort: this.config.remotePort
      }, 'SCS OSC client ready');
      this.emit('connected');
    });

    this.udpPort.on('error', (error: Error) => {
      logger.error({ err: error, host: this.currentHost }, 'SCS OSC client error');

      // Try backup if available and not already using it
      if (this.config.backupAddress && !this.useBackup) {
        logger.warn('Attempting failover to backup SCS host');
        this.useBackup = true;
        this.currentHost = this.config.backupAddress;
        this.udpPort.close();
        this.createUDPPort();
      } else {
        this.emit('error', error);
      }
    });

    this.udpPort.open();
  }

  public async stop(): Promise<void> {
    if (this.udpPort) {
      this.udpPort.close();
      this.connected = false;
    }
  }

  public sendMessage(address: string, args: any[] = []): void {
    if (!this.connected) {
      logger.warn({ address }, 'OSC client not connected, queuing message');
      // Could implement queue here if needed
      return;
    }

    this.udpPort.send({
      address,
      args
    });

    logger.debug({ address, args, host: this.currentHost }, 'Sent OSC message to SCS');
  }

  public playCue(cueId: string): void {
    this.sendMessage('/cue/go', [{ type: 's', value: cueId }]);
    logger.info({ cueId }, 'Triggered SCS cue');
  }

  public stopCue(): void {
    this.sendMessage('/stop');
    logger.info('Sent SCS stop command');
  }

  public pauseCue(): void {
    this.sendMessage('/pause');
    logger.info('Sent SCS pause command');
  }

  public resumeCue(): void {
    this.sendMessage('/resume');
    logger.info('Sent SCS resume command');
  }

  public go(): void {
    this.sendMessage('/go');
    logger.info('Sent SCS go command');
  }

  public fadeIn(durationMs: number): void {
    this.sendMessage('/fadein', [{ type: 'i', value: durationMs }]);
    logger.info({ durationMs }, 'Sent SCS fade in command');
  }

  public fadeOut(durationMs: number): void {
    this.sendMessage('/fadeout', [{ type: 'i', value: durationMs }]);
    logger.info({ durationMs }, 'Sent SCS fade out command');
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getCurrentHost(): string {
    return this.currentHost;
  }
}
