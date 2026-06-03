'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBroadcastById, startBroadcast, deleteBroadcast } from '@/app/actions/broadcasts';
import { Button } from '@/components/ui/button';
import { Radio, Loader2, Play, Trash2, ArrowLeft, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

type Target = {
  id: string;
  status: string;
  errorMsg: string | null;
  contact: { id: string; name: string | null; phone: string } | null;
};

type BroadcastDetail = {
  id: string;
  name: string;
  message: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  created_at: string;
  scheduled_at: string | null;
  targets: Target[];
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.classes}`}>
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

function TargetStatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-400" />;
  return <Clock className="h-4 w-4 text-slate-500" />;
}

export default function BroadcastDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchDetail() {
    try {
      const data = await getBroadcastById(params.id);
      setBroadcast(data as BroadcastDetail | null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDetail();
  }, [params.id]);

  useEffect(() => {
    if (broadcast?.status === 'sending') {
      pollRef.current = setInterval(fetchDetail, 4000);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [broadcast?.status]);

  async function handleStart() {
    if (!broadcast) return;
    setStarting(true);
    try {
      await startBroadcast(broadcast.id);
      toast.success('Broadcast started!');
      fetchDetail();
    } catch {
      toast.error('Failed to start broadcast');
    } finally {
      setStarting(false);
    }
  }

  async function handleDelete() {
    if (!broadcast) return;
    setDeleting(true);
    try {
      await deleteBroadcast(broadcast.id);
      toast.success('Broadcast deleted');
      router.push('/broadcasts');
    } catch {
      toast.error('Failed to delete');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Radio className="h-12 w-12 text-slate-600" />
        <p className="text-slate-400">Broadcast not found.</p>
        <Button onClick={() => router.push('/broadcasts')} variant="outline" className="border-slate-700 text-slate-300">
          Back to Broadcasts
        </Button>
      </div>
    );
  }

  const sentCount = broadcast.targets.filter(t => t.status === 'sent').length;
  const failedCount = broadcast.targets.filter(t => t.status === 'failed').length;
  const pendingCount = broadcast.targets.filter(t => t.status === 'pending').length;
  const total = broadcast.total_recipients || broadcast.targets.length;
  const pct = total ? Math.round((sentCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/broadcasts')} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{broadcast.name}</h1>
            <p className="text-xs text-slate-500">{new Date(broadcast.created_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={broadcast.status} />
          {broadcast.status === 'draft' && (
            <Button onClick={handleStart} disabled={starting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {starting ? 'Starting...' : 'Send Now'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleting || broadcast.status === 'sending'}
            className="border-slate-700 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: total, icon: Users, color: 'text-slate-400' },
          { label: 'Sent', value: sentCount, icon: CheckCircle2, color: 'text-primary' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-yellow-400' },
          { label: 'Failed', value: failedCount, icon: XCircle, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Delivery Progress</p>
          <p className="text-sm font-bold text-primary">{pct}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Message Preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Message</p>
        <p className="whitespace-pre-wrap text-sm text-slate-200">{broadcast.message}</p>
      </div>

      {/* Target List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-5 py-4">
          <p className="text-sm font-semibold text-white">Recipients</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {broadcast.targets.map(target => (
            <div key={target.id} className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3 last:border-0">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
                  {(target.contact?.name || target.contact?.phone || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{target.contact?.name || target.contact?.phone || 'Unknown'}</p>
                  {target.contact?.name && <p className="text-xs text-slate-500">{target.contact.phone}</p>}
                  {target.errorMsg && <p className="text-xs text-red-400">{target.errorMsg}</p>}
                </div>
              </div>
              <TargetStatusIcon status={target.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
