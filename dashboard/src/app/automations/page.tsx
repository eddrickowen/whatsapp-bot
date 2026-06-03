'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Zap, Plus, MoreVertical, Copy, Pencil, Trash2,
  MessageCircle, Clock, Users, PhoneCall, Loader2
} from 'lucide-react';
import { getAutomations, toggleAutomation, duplicateAutomation, deleteAutomation } from '@/app/actions/automations';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';

type Automation = {
  id: string;
  name: string;
  description?: string | null;
  trigger_type: string;
  is_active: boolean;
  execution_count: number;
  last_executed_at?: string | null;
};

const TEMPLATES = [
  {
    slug: 'welcome_message',
    name: 'Welcome Message',
    description: 'Send a greeting when someone messages for the first time.',
    icon: MessageCircle,
    trigger: 'new_contact_created',
    steps: [{ step_type: 'send_message', step_config: { text: 'Hello! 👋 Thanks for reaching out. How can we help you today?' } }]
  },
  {
    slug: 'out_of_office',
    name: 'Out of Office',
    description: 'Auto-reply with your availability outside business hours.',
    icon: Clock,
    trigger: 'new_message_received',
    steps: [{ step_type: 'send_message', step_config: { text: 'Hi! We are currently out of office. We will get back to you during business hours. Thank you for your patience!' } }]
  },
  {
    slug: 'keyword_promo',
    name: 'Keyword: PROMO',
    description: 'Auto-reply when someone types a keyword like "promo" or "harga".',
    icon: Users,
    trigger: 'keyword_match',
    steps: [{ step_type: 'send_message', step_config: { text: 'Hi! Here are our latest promotions: [paste your promo link here]. Feel free to ask more questions!' } }]
  },
  {
    slug: 'lead_tagger',
    name: 'New Lead Tagger',
    description: 'Automatically tag new contacts as "New Lead".',
    icon: PhoneCall,
    trigger: 'new_contact_created',
    steps: [{ step_type: 'add_tag', step_config: { tag_id: '' } }]
  },
];

function formatRelative(dateStr?: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function triggerLabel(type: string): string {
  const map: Record<string, string> = {
    new_message_received: 'New Message',
    first_inbound_message: 'First Message',
    keyword_match: 'Keyword Match',
    new_contact_created: 'New Contact',
    tag_added: 'Tag Added',
    time_based: 'Scheduled',
  };
  return map[type] ?? type;
}

export default function AutomationsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try {
      const data = await getAutomations();
      setAutomations(data as Automation[]);
    } catch {
      toast.error('Failed to load automations');
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(a: Automation, next: boolean) {
    setAutomations(prev => prev?.map(x => x.id === a.id ? { ...x, is_active: next } : x) ?? prev);
    try {
      await toggleAutomation(a.id, next);
      toast.success(next ? 'Automation activated' : 'Automation paused');
    } catch {
      setAutomations(prev => prev?.map(x => x.id === a.id ? { ...x, is_active: !next } : x) ?? prev);
      toast.error('Failed to update');
    }
  }

  async function handleDuplicate(a: Automation) {
    try {
      await duplicateAutomation(a.id);
      toast.success('Automation duplicated');
      load();
    } catch {
      toast.error('Failed to duplicate');
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteAutomation(pendingDelete.id);
      toast.success('Automation deleted');
      setPendingDelete(null);
      load();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  async function startFromTemplate(t: typeof TEMPLATES[0]) {
    router.push(`/automations/new?template=${t.slug}`);
  }

  if (automations === null) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automations</h1>
          <p className="mt-1 text-sm text-slate-400">Build workflows that react to WhatsApp events automatically.</p>
        </div>
        <Button onClick={() => router.push('/automations/new')} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" /> Create Automation
        </Button>
      </div>

      {automations.length < 3 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Quick-start templates</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.slug}
                  onClick={() => startFromTemplate(t)}
                  className="group flex flex-col items-start rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition-colors hover:border-primary/50 hover:bg-slate-900/80"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <p className="mt-1 text-xs text-slate-400">{t.description}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {automations.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium text-white">No automations yet</p>
          <p className="mt-1 text-xs text-slate-400">Pick a template above or create one from scratch.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {automations.map(a => (
            <li key={a.id} className="rounded-xl border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700">
              <div className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/automations/${a.id}/edit`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">{a.name}</span>
                    {a.is_active && (
                      <span className="relative flex h-2 w-2" aria-label="active">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                    )}
                  </div>
                  {a.description && <p className="mt-0.5 truncate text-xs text-slate-400">{a.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                      {triggerLabel(a.trigger_type)}
                    </span>
                    <span className="tabular-nums">{a.execution_count} run{a.execution_count === 1 ? '' : 's'}</span>
                    <span aria-hidden>·</span>
                    <span>last {formatRelative(a.last_executed_at)}</span>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={a.is_active}
                    onCheckedChange={v => handleToggle(a, !!v)}
                    aria-label={a.is_active ? 'Deactivate' : 'Activate'}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Open menu"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900">
                      <DropdownMenuItem onClick={() => router.push(`/automations/${a.id}/edit`)} className="text-slate-300">
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(a)} className="text-slate-300">
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-700" />
                      <DropdownMenuItem onClick={() => setPendingDelete(a)} className="text-red-400 focus:text-red-300">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={v => !v && setPendingDelete(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Delete automation</DialogTitle>
            <DialogDescription className="text-slate-400">
              This permanently removes <span className="text-white">{pendingDelete?.name}</span>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting} className="text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
