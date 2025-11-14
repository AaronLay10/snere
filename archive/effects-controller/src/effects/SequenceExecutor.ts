import { EventEmitter } from 'events';
import { Sequence, SequenceContext, SequenceExecution, SequenceStep } from '../types.js';
import { logger } from '../logger.js';
import { MQTTPublisher } from '../mqtt/MQTTPublisher.js';

export class SequenceExecutor extends EventEmitter {
  private executions = new Map<string, SequenceExecution>();
  private executionCounter = 0;

  constructor(private readonly mqttPublisher: MQTTPublisher) {
    super();
  }

  public async execute(sequence: Sequence, context: SequenceContext): Promise<string> {
    const executionId = `exec-${++this.executionCounter}-${Date.now()}`;
    const execution: SequenceExecution = {
      id: executionId,
      sequenceId: sequence.id,
      status: 'running',
      startedAt: Date.now(),
      context,
      currentStep: 0,
      totalSteps: sequence.steps.length
    };

    this.executions.set(executionId, execution);
    logger.info({ executionId, sequenceId: sequence.id, puzzleId: context.puzzleId }, 'Starting sequence execution');
    this.emit('sequence-started', execution);

    try {
      const sortedSteps = [...sequence.steps].sort((a, b) => (a.offsetMs ?? 0) - (b.offsetMs ?? 0));

      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        const nextStep = sortedSteps[i + 1];

        execution.currentStep = i + 1;
        this.emit('sequence-step', { execution, step });

        await this.executeStep(step, context);

        if (nextStep) {
          const currentOffset = step.offsetMs ?? 0;
          const nextOffset = nextStep.offsetMs ?? 0;
          const delayMs = nextOffset - currentOffset;

          if (delayMs > 0) {
            await this.delay(delayMs);
          }
        }
      }

      execution.status = 'completed';
      execution.completedAt = Date.now();
      logger.info({ executionId, durationMs: execution.completedAt - execution.startedAt }, 'Sequence completed');
      this.emit('sequence-completed', execution);

      return executionId;
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      logger.error({ err: error, executionId }, 'Sequence execution failed');
      this.emit('sequence-failed', { execution, error });
      throw error;
    }
  }

  private async executeStep(step: SequenceStep, context: SequenceContext): Promise<void> {
    logger.debug({ action: step.action, puzzleId: context.puzzleId }, 'Executing step');

    const topic = this.buildCommandTopic(step.action, context);
    const payload = step.payload || { command: step.action, timestamp: Date.now() };

    try {
      await this.mqttPublisher.publishCommand(topic, payload);
    } catch (error) {
      logger.error({ err: error, action: step.action, topic }, 'Step execution failed');
      throw error;
    }
  }

  private buildCommandTopic(action: string, context: SequenceContext): string {
    // Map action to MQTT topic based on naming convention
    // paragon/{Room}/{Puzzle}/{Device}/commands/{command}

    // Extract device and command from action
    // Format: clockwork-pilotlight-led-fire-animation → Clockwork/PilotLight/*/commands/ledFireAnimation

    const parts = action.split('-');
    if (parts.length >= 3) {
      const room = this.capitalize(parts[0]);
      const puzzle = this.capitalize(parts[1]);
      const commandParts = parts.slice(2);
      const command = commandParts.map((p, i) => i === 0 ? p : this.capitalize(p)).join('');

      return `paragon/${room}/${puzzle}/Controller/commands/${command}`;
    }

    // Fallback to generic command topic
    return `paragon/${this.capitalize(context.roomId)}/${context.puzzleId}/Controller/commands/${action}`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public getExecution(id: string): SequenceExecution | undefined {
    return this.executions.get(id);
  }

  public listExecutions(): SequenceExecution[] {
    return Array.from(this.executions.values());
  }

  public getActiveExecutions(): SequenceExecution[] {
    return this.listExecutions().filter((exec) => exec.status === 'running');
  }
}
