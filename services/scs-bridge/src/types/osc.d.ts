declare module 'osc' {
  export interface UDPPortOptions {
    localAddress?: string;
    localPort?: number;
    remoteAddress?: string;
    remotePort?: number;
    metadata?: boolean;
  }

  export interface OSCMessage {
    address: string;
    args?: Array<{ type: string; value: any }>;
  }

  export class UDPPort {
    constructor(options: UDPPortOptions);
    on(event: 'ready', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'message', listener: (message: OSCMessage) => void): this;
    open(): void;
    close(): void;
    send(message: OSCMessage): void;
  }
}
