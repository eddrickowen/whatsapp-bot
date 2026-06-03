'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getBroadcasts, deleteBroadcast } from '@/app/actions/broadcasts';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Radio, Plus, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const POLL_MS = 5000;

type BroadcastItem = {
  id: string;
  name: string;
  message: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string; pulse?: boolean }> = {
    draft:     { label: 'Draft',     classes: 'border-slate-600 bg-slate-800 text-slate-400' },
    sending:   { label: 'Sending',   classes: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400', pulse: true },
    completed: { label: 'Completed', classes: 'border-primary/40 bg-primary/10 text-primary' },
    failed:    { label: 'Failed',    classes: 'border-red-500/40 bg-red-500/10 text-red-400' },
  };
  const s = map[status] ?? { label: status, classes: 'border-slate-600 bg-slate-800 text-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.classes}`}>
      {s.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
        </span>
      )}
      {s.label}
    </span>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-right text-xs tabular-nums text-slate-300">{pct}%</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800">
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchBroadcasts() {
    try {
      const data = await getBroadcasts();
      setBroadcasts(data as BroadcastItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  const anySending = useMemo(() => broadcasts.some(b => b.status === 'sending'), [broadcasts]);

  useEffect(() => {
    if (anySending) {
      pollTimer.current = setInterval(fetchBroadcasts, POLL_MS);
    } else {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [anySending]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteBroadcast(id);
      setBroadcasts(prev => prev.filter(b => b.id !== id));
      toast.success('Broadcast deleted');
    } catch {
      toast.error('Failed to delete broadcast');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {anySending && (
        <div className="fixed inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-slate-800">
          <div
            className="h-full w-1/3 bg-primary"
            style={{ animation: 'broadcastSlide 1.6s cubic-bezier(.4,0,.2,1) infinite' }}
          />
          <style>{`@keyframes broadcastSlide { 0% { transform: translateX(-100%) } 100% { transform: translateX(400%) } }`}</style>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Broadcasts</h1>
          <p className="mt-1 text-sm text-slate-400">
            Send free bulk messages to your contacts via WhatsApp Web.
          </p>
        </div>
        <Button onClick={() => router.push('/broadcasts/new')} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" /> New Broadcast
        </Button>
      </div>

      {broadcasts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900">
          <Radio className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-white">No broadcasts yet</p>
          <p className="mt-1 text-xs text-slate-400">Create your first broadcast to reach your contacts at scale — for free.</p>
          <Button
            onClick={() => router.push('/broadcasts/new')}
            className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1 h-4 w-4" /> New Broadcast
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="hidden text-right text-slate-400 sm:table-cell">Recipients</TableHead>
                <TableHead className="hidden text-slate-400 lg:table-cell">Progress</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="hidden text-slate-400 sm:table-cell">Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcasts.map(b => (
                <TableRow
                  key={b.id}
                  className="cursor-pointer border-slate-800 hover:bg-slate-800/50"
                  onClick={() => router.push(`/broadcasts/${b.id}`)}
                >
                  <TableCell className="font-medium text-white">{b.name}</TableCell>
                  <TableCell className="hidden text-right tabular-nums text-slate-300 sm:table-cell">{b.total_recipients}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <ProgressBar value={b.sent_count} total={b.total_recipients} />
                  </TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="hidden text-slate-400 sm:table-cell">
                    {new Date(b.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900">
                        <DropdownMenuItem onClick={e => handleDelete(b.id, e)} className="text-red-400 focus:text-red-300">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
