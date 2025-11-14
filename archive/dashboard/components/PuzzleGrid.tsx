"use client";

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { PuzzleRuntime } from '../types';
import { StatusBadge } from './StatusBadge';

const stateLabels: Record<string, string> = {
  inactive: 'Inactive',
  waiting: 'Waiting',
  active: 'Active',
  solved: 'Solved',
  failed: 'Failed',
  timeout: 'Timeout',
  error: 'Error'
};

export function PuzzleGrid({ puzzles, isLoading }: { puzzles: PuzzleRuntime[]; isLoading: boolean }) {
  const router = useRouter();

  return (
    <section className="mb-12">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Puzzles</h2>
        <p className="text-sm text-slate-400">
          {isLoading ? 'Loading…' : `${puzzles.length} configured`}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {puzzles.map((puzzle) => (
          <article
            key={puzzle.id}
            onClick={() => router.push(`/puzzles/${puzzle.id}`)}
            className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 shadow-sm cursor-pointer hover:border-slate-700 hover:bg-slate-900/90 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-slate-100">{puzzle.name}</h3>
                <p className="text-xs text-slate-400 uppercase tracking-wide">{puzzle.roomId}</p>
              </div>
              <StatusBadge status={puzzle.state} />
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm text-slate-300">
              <div>
                <dt className="text-slate-500 text-xs uppercase tracking-wide">State</dt>
                <dd>{stateLabels[puzzle.state] ?? puzzle.state}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase tracking-wide">Attempts</dt>
                <dd>{puzzle.attempts ?? 0}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase tracking-wide">Started</dt>
                <dd>
                  {puzzle.timeStarted
                    ? formatDistanceToNow(puzzle.timeStarted, { addSuffix: true })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase tracking-wide">Completed</dt>
                <dd>
                  {puzzle.timeCompleted
                    ? formatDistanceToNow(puzzle.timeCompleted, { addSuffix: true })
                    : '—'}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        {puzzles.length === 0 && !isLoading && (
          <div className="col-span-full text-center text-slate-500 py-10 border border-dashed border-slate-700 rounded-lg">
            No puzzles registered yet.
          </div>
        )}
      </div>
    </section>
  );
}
