import type { DeviceCommand } from '../devices/types';

export interface TopicBuilderOptions {
  defaultNamespace?: string;
}

const DEFAULT_NAMESPACE = 'paragon';

export class TopicBuilder {
  constructor(private readonly options: TopicBuilderOptions = {}) {}

  public commandTopic(command: DeviceCommand): string {
    const namespace = this.options.defaultNamespace ?? DEFAULT_NAMESPACE;
    const { roomId, puzzleId, deviceId, category = 'commands' } = command;

    const segments = [namespace];
    if (roomId) segments.push(roomId);
    if (puzzleId) segments.push(puzzleId);
    if (deviceId) segments.push(deviceId);
    segments.push(category);
    segments.push(command.command);

    return segments.join('/').replace(/\/+/g, '/');
  }
}
