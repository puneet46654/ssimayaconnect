'use client';

import { adminFetch as fetch } from '@/lib/admin-auth';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Named = { name: string; count: number };
type Analytics = {
  range: '24h' | '7d' | '30d';
  unit: 'hour' | 'day';
  totals: { views: number; visitors: number; sessions: number; live: number; bookings: number; pendingRegistrations: number; conversion: number };
  series: { t: string; views: number; visitors: number }[];
  funnel: { step: string; sessions: number }[];
  topPages: { path: string; views: number; sessions: number }[];
  topEvents: { eventId: string; name: string; views: number; visitors: number }[];
  referrers: Named[]; countries: Named[]; cities: Named[]; devices: Named[]; browsers: Named[]; os: Named[];
  api: { endpoint: string; method: string; count: number; errors: number; errorRate: number; p50: number; p95: number; max: number }[];
  statuses: { status: number | string; count: number }[];
};

const COLORS = { primary: '#1a9e8f', secondary: '#1b4b6b', blue: '#4387b3', red: '#d75d5d', amber: '#d49c35' };
const RANGES = [['24h', 'Last 24 hours'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days']] as const;
const REFRESH_MS = 30000;
const number = new Intl.NumberFormat('en-IN');

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Analytics['range']>('24h');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/admin/analytics?range=${range}`, { credentials: 'include', cache: 'no-store', signal });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || 'Unable to load analytics.');
      setData(body); setError('');
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    const controller = new AbortController();
    const first = window.setTimeout(() => { setLoading(true); void load(controller.signal); }, 0);
    const timer = window.setInterval(() => void load(controller.signal), REFRESH_MS);
    return () => { controller.abort(); window.clearTimeout(first); window.clearInterval(timer); };
  }, [load]);

  const label = (value: string) => new Date(value).toLocaleString('en-IN', data?.unit === 'hour'
    ? { hour: 'numeric', timeZone: 'Asia/Kolkata' } : { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const funnelTop = Math.max(1, data?.funnel[0]?.sessions || 0);

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-[22px] font-bold tracking-[-0.03em] text-secondary sm:text-[25px] lg:text-[27px]">Analytics</h1>
          <p className="mt-1 max-w-[720px] text-[11px] leading-[18px] text-gray-500 sm:text-[13px] sm:leading-5">
            Visitors, page views, the booking funnel and API performance on the attendee site. Updates every 30 seconds.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Time range">
          {RANGES.map(([key, text]) => (
            <button key={key} type="button" role="tab" aria-selected={range === key} onClick={() => setRange(key)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${range === key ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {text}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric title="Live now" value={data?.totals.live} hint="Visitors in the last 5 min" loading={loading} accent />
        <Metric title="Page views" value={data?.totals.views} hint="All tracked pages" loading={loading} />
        <Metric title="Unique visitors" value={data?.totals.visitors} hint="Distinct browsers" loading={loading} />
        <Metric title="Sessions" value={data?.totals.sessions} hint="Separate visits" loading={loading} />
        <Metric title="Bookings" value={data?.totals.bookings} hint={`${number.format(data?.totals.pendingRegistrations || 0)} left the form unfinished`} loading={loading} />
        <Metric title="Conversion" value={data ? `${data.totals.conversion}%` : undefined} hint="Sessions that reached confirmation" loading={loading} />
      </div>

      <Panel title="Traffic" className="mt-4">
        <div className="h-[260px]">
          {data?.series.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f2" vertical={false} />
                <XAxis dataKey="t" tickFormatter={label} tick={{ fontSize: 11, fill: '#8a96a3' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8a96a3' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={value => label(String(value))} />
                <Area type="monotone" dataKey="views" name="Page views" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="visitors" name="Visitors" stroke={COLORS.secondary} fill={COLORS.secondary} fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty loading={loading} />}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Booking funnel" subtitle="Sessions that reached each step">
          {data ? (
            <ul className="space-y-3">
              {data.funnel.map((step, index) => (
                <li key={step.step}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-secondary">{index + 1}. {step.step}</span>
                    <span className="text-gray-500">
                      {number.format(step.sessions)}
                      {index > 0 && data.funnel[index - 1].sessions > 0 &&
                        <span className="ml-2 text-gray-400">({Math.round((step.sessions / data.funnel[index - 1].sessions) * 100)}% continued)</span>}
                    </span>
                  </div>
                  <Bar value={step.sessions} max={funnelTop} color={COLORS.primary} />
                </li>
              ))}
            </ul>
          ) : <Empty loading={loading} />}
        </Panel>

        <Panel title="Top events" subtitle="Views of each event's pages">
          <Table loading={loading} empty={!data?.topEvents.length} head={['Event', 'Views', 'Visitors']}
            rows={(data?.topEvents || []).map(row => [row.name, number.format(row.views), number.format(row.visitors)])} />
        </Panel>

        <Panel title="Top pages">
          <Table loading={loading} empty={!data?.topPages.length} head={['Page', 'Views', 'Sessions']}
            rows={(data?.topPages || []).map(row => [<code key="p" className="text-[11px]">{row.path}</code>, number.format(row.views), number.format(row.sessions)])} />
        </Panel>

        <Panel title="Referrers" subtitle="Where visits started">
          <Breakdown rows={data?.referrers} loading={loading} color={COLORS.blue} />
        </Panel>

        <Panel title="Countries"><Breakdown rows={data?.countries} loading={loading} color={COLORS.secondary} /></Panel>
        <Panel title="Cities"><Breakdown rows={data?.cities} loading={loading} color={COLORS.secondary} /></Panel>
        <Panel title="Devices"><Breakdown rows={data?.devices} loading={loading} color={COLORS.primary} /></Panel>
        <Panel title="Browsers & operating systems">
          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown rows={data?.browsers} loading={loading} color={COLORS.amber} />
            <Breakdown rows={data?.os} loading={loading} color={COLORS.amber} />
          </div>
        </Panel>
      </div>

      <Panel title="API performance" subtitle="Response times as visitors experienced them (p50 = typical, p95 = slowest 5%)" className="mt-4">
        <Table loading={loading} empty={!data?.api.length} head={['Endpoint', 'Requests', 'p50', 'p95', 'Max', 'Errors']}
          rows={(data?.api || []).map(row => [
            <code key="e" className="text-[11px]"><span className="text-gray-400">{row.method}</span> {row.endpoint}</code>,
            number.format(row.count), `${number.format(row.p50)} ms`,
            <span key="p95" className={row.p95 > 3000 ? 'font-semibold text-red-600' : row.p95 > 1000 ? 'text-amber-600' : ''}>{number.format(row.p95)} ms</span>,
            `${number.format(row.max)} ms`,
            <span key="err" className={row.errors ? 'font-semibold text-red-600' : 'text-gray-400'}>{row.errors ? `${row.errors} (${row.errorRate}%)` : '0'}</span>,
          ])} />
        {!!data?.statuses.length && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.statuses.map(row => (
              <span key={String(row.status)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${Number(row.status) >= 500 || row.status === 'Network error' ? 'bg-red-50 text-red-700' : Number(row.status) >= 400 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {row.status}: {number.format(row.count)}
              </span>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Metric({ title, value, hint, loading, accent = false }: { title: string; value?: number | string; hint: string; loading: boolean; accent?: boolean }) {
  return (
    <article className="min-w-0 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4">
      <p className="flex items-center gap-1.5 truncate text-[9px] font-semibold uppercase tracking-[0.04em] text-gray-400 sm:text-[10px]">
        {accent && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />}
        {title}
      </p>
      <p className="mt-1.5 font-heading text-[22px] font-bold text-secondary">
        {loading && value === undefined ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-gray-100" /> : typeof value === 'number' ? number.format(value) : value ?? '0'}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-gray-400 sm:text-[11px]">{hint}</p>
    </article>
  );
}

function Panel({ title, subtitle, className = '', children }: { title: string; subtitle?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="text-[14px] font-semibold text-secondary">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

function Breakdown({ rows, loading, color }: { rows?: Named[]; loading: boolean; color: string }) {
  if (!rows?.length) return <Empty loading={loading} />;
  const max = Math.max(...rows.map(row => row.count));
  return (
    <ul className="space-y-2.5">
      {rows.map(row => (
        <li key={row.name}>
          <div className="flex justify-between gap-2 text-[12px]">
            <span className="truncate text-secondary">{row.name}</span>
            <span className="shrink-0 text-gray-500">{number.format(row.count)}</span>
          </div>
          <Bar value={row.count} max={max} color={color} />
        </li>
      ))}
    </ul>
  );
}

function Table({ head, rows, loading, empty }: { head: string[]; rows: ReactNode[][]; loading: boolean; empty: boolean }) {
  if (empty) return <Empty loading={loading} />;
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full">
        <thead><tr>{head.map((cell, index) => <th key={cell} className={index ? '!text-right' : ''}>{cell}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={cellIndex ? 'whitespace-nowrap text-right' : 'max-w-[320px] truncate'}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return loading
    ? <div className="h-24 animate-pulse rounded-lg bg-gray-50" />
    : <p className="py-6 text-center text-[12px] text-gray-400">No data for this period yet.</p>;
}
