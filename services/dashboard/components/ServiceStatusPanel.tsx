"use client";

import type { ServiceEntry } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export function ServiceStatusPanel({ services }: { services: ServiceEntry[] }) {
  if (!services.length) {
    return null;
  }

  return (
    <section className="mb-12">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Services</h2>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <article key={service.id} className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-slate-100 capitalize">{service.name.replace('-', ' ')}</h3>
                <p className="text-xs text-slate-400 break-words">{service.url}</p>
              </div>
              <StatusBadge status={service.status} />
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm text-slate-300">
              <div>
                <dt className="text-slate-500 text-xs uppercase tracking-wide">Last Checked</dt>
                <dd>
                  {service.lastCheckedAt
                    ? formatDistanceToNow(service.lastCheckedAt, { addSuffix: true })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs uppercase tracking-wide">Last Healthy</dt>
                <dd>
                  {service.lastHealthyAt
                    ? formatDistanceToNow(service.lastHealthyAt, { addSuffix: true })
                    : '—'}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
