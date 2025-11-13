export interface SequenceStep {
  order: number;
  offsetMs?: number;
  action: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface Sequence {
  id: string;
  name: string;
  puzzleId: string;
  roomId: string;
  durationMs: number;
  steps: SequenceStep[];
}

export interface SequenceContext {
  puzzleId: string;
  roomId: string;
  sessionId?: string;
  triggeredAt: number;
}

export interface EffectCommand {
  action: string;
  target: string;
  payload: Record<string, unknown>;
  context: SequenceContext;
}

export type SequenceStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SequenceExecution {
  id: string;
  sequenceId: string;
  status: SequenceStatus;
  startedAt: number;
  completedAt?: number;
  context: SequenceContext;
  currentStep: number;
  totalSteps: number;
}
