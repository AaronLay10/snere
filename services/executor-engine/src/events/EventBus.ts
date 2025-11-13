import { EventEmitter } from 'events';
import { DeviceEvent } from '../types';

export declare interface EventBus {
  on(event: 'device-event', listener: (event: DeviceEvent) => void): this;
}

export class EventBus extends EventEmitter {
  public emitDeviceEvent(event: DeviceEvent): void {
    this.emit('device-event', event);
  }
}
