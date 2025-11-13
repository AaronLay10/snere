import { Sequence } from '../types.js';
import { logger } from '../logger.js';

export class SequenceRegistry {
  private sequences = new Map<string, Sequence>();

  public register(sequence: Sequence): void {
    this.sequences.set(sequence.id, sequence);
    logger.info({ sequenceId: sequence.id, steps: sequence.steps.length }, 'Registered sequence');
  }

  public registerMany(sequences: Sequence[]): void {
    sequences.forEach((seq) => this.register(seq));
  }

  public get(id: string): Sequence | undefined {
    return this.sequences.get(id);
  }

  public list(): Sequence[] {
    return Array.from(this.sequences.values());
  }

  public listByRoom(roomId: string): Sequence[] {
    return this.list().filter((seq) => seq.roomId === roomId);
  }

  public listByPuzzle(puzzleId: string): Sequence[] {
    return this.list().filter((seq) => seq.puzzleId === puzzleId);
  }
}
