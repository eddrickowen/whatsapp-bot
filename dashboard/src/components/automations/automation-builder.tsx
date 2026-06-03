'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronDown, Plus, Trash2, GripVertical,
  MessageSquare, Tag, TagIcon, PencilLine, Briefcase,
  Hourglass, GitBranch, CircleSlash, Zap, Loader2,
  ArrowDown, ArrowUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { createAutomation, updateAutomation } from '@/app/actions/automations';

// ---- Types ----
type StepType =
  | 'send_message' | 'add_tag' | 'remove_tag' | 'update_contact_field'
  | 'create_deal' | 'wait' | 'condition' | 'send_webhook' | 'close_conversation';

type TriggerType =
  | 'new_message_received' | 'first_inbound_message' | 'keyword_match'
  | 'new_contact_created' | 'tag_added' | 'time_based';

export interface BuilderStep {
  cid: string;
  step_type: StepType;
  step_config: Record<string, unknown>;
  branches?: { yes: BuilderStep[]; no: BuilderStep[] };
}

export interface BuilderState {
  id?: string;
  name: string;
  description: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  is_active: boolean;
  steps: BuilderStep[];
}

// ---- Step metadata ----
const STEP_META: Record<StepType, { label: string; icon: typeof Zap; border: string }> = {
  send_message:         { label: 'Send Message',         icon: MessageSquare, border: 'border-l-primary' },
  add_tag:              { label: 'Add Tag',               icon: Tag,           border: 'border-l-primary' },
  remove_tag:           { label: 'Remove Tag',            icon: TagIcon,       border: 'border-l-primary' },
  update_contact_field: { label: 'Update Contact Field',  icon: PencilLine,    border: 'border-l-primary' },
  create_deal:          { label: 'Create Deal',           icon: Briefcase,     border: 'border-l-primary' },
  wait:                 { label: 'Wait',                  icon: Hourglass,     border: 'border-l-slate-500' },
  condition:            { label: 'Condition (If/Else)',   icon: GitBranch,     border: 'border-l-amber-500' },
  send_webhook:         { label: 'Send Webhook',          icon: Zap,           border: 'border-l-primary' },
  close_conversation:   { label: 'Close Conversation',   icon: CircleSlash,   border: 'border-l-primary' },
};

const ADDABLE_STEPS: StepType[] = [
  'send_message', 'add_tag', 'remove_tag', 'update_contact_field',
  'create_deal', 'wait', 'condition', 'send_webhook', 'close_conversation'
];

const TRIGGER_OPTIONS: { value: TriggerType; label: string; hint: string }[] = [
  { value: 'new_message_received',  label: 'New Message Received',       hint: 'Any incoming message' },
  { value: 'first_inbound_message', label: 'First Message from Contact', hint: 'First time this contact messages you' },
  { value: 'keyword_match',         label: 'Keyword Match',              hint: 'Message contains specific keyword(s)' },
  { value: 'new_contact_created',   label: 'New Contact Created',        hint: 'When a contact is auto-created' },
  { value: 'tag_added',             label: 'Tag Added',                  hint: 'When a tag is added to a contact' },
  { value: 'time_based',            label: 'Time-Based',                 hint: 'On a recurring schedule' },
];

// ---- Helpers ----
function uid() {
  return 'c_' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));
}

function blankConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case 'send_message': return { text: '' };
    case 'add_tag':
    case 'remove_tag': return { tag_id: '' };
    case 'update_contact_field': return { field: 'name', value: '' };
    case 'create_deal': return { pipeline_id: '', stage_id: '', title: '', value: 0 };
    case 'wait': return { amount: 1, unit: 'hours' };
    case 'condition': return { subject: 'message_contains', operand: '', value: '' };
    case 'send_webhook': return { url: '', body_template: '' };
    case 'close_conversation': return {};
    default: return {};
  }
}

function previewFor(step: BuilderStep): string {
  switch (step.step_type) {
    case 'send_message': return (step.step_config.text as string) || 'no text yet';
    case 'wait': return `${step.step_config.amount ?? '?'} ${step.step_config.unit ?? ''}`;
    case 'condition': return `when ${step.step_config.subject ?? '?'}`;
    case 'send_webhook': return (step.step_config.url as string) || 'no url';
    default: return '';
  }
}

function toApiSteps(steps: BuilderStep[]): unknown[] {
  return steps.map(s => ({
    step_type: s.step_type,
    step_config: s.step_config,
    branches: s.branches ? { yes: toApiSteps(s.branches.yes), no: toApiSteps(s.branches.no) } : undefined
  }));
}

// ---- Tree mutations ----
type ParentScope = { kind: 'root' } | { kind: 'branch'; parentCid: string; branch: 'yes' | 'no' };
type StepPath = ({ kind: 'root'; index: number } | { kind: 'branch'; parentCid: string; branch: 'yes' | 'no'; index: number })[];

function insertAt(steps: BuilderStep[], parent: ParentScope, index: number, node: BuilderStep): BuilderStep[] {
  if (parent.kind === 'root') { const c = [...steps]; c.splice(index, 0, node); return c; }
  return steps.map(s => {
    if (s.cid !== parent.parentCid || !s.branches) return s;
    const list = [...s.branches[parent.branch]]; list.splice(index, 0, node);
    return { ...s, branches: { ...s.branches, [parent.branch]: list } };
  });
}

function mapAtPath(steps: BuilderStep[], path: StepPath, upd: (s: BuilderStep) => BuilderStep): BuilderStep[] {
  if (!path.length) return steps;
  const [h, ...rest] = path;
  if (h.kind === 'root') return steps.map((s, i) => i !== h.index ? s : rest.length === 0 ? upd(s) : { ...s, branches: walkBranches(s.branches, rest, upd) });
  return steps.map(s => {
    if (s.cid !== h.parentCid || !s.branches) return s;
    const bucket = s.branches[h.branch];
    const updated = bucket.map((c, i) => i !== h.index ? c : rest.length === 0 ? upd(c) : { ...c, branches: walkBranches(c.branches, rest, upd) });
    return { ...s, branches: { ...s.branches, [h.branch]: updated } };
  });
}

function walkBranches(branches: BuilderStep['branches'], path: StepPath, upd: (s: BuilderStep) => BuilderStep): BuilderStep['branches'] {
  if (!branches || !path.length) return branches;
  const [h, ...rest] = path;
  if (h.kind !== 'branch') return branches;
  const bucket = branches[h.branch];
  const updated = bucket.map((c, i) => i !== h.index ? c : rest.length === 0 ? upd(c) : { ...c, branches: walkBranches(c.branches, rest, upd) });
  return { ...branches, [h.branch]: updated };
}

function removeAt(steps: BuilderStep[], path: StepPath): BuilderStep[] {
  if (!path.length) return steps;
  const [h, ...rest] = path;
  if (h.kind === 'root') {
    if (!rest.length) return steps.filter((_, i) => i !== h.index);
    return steps.map((s, i) => i !== h.index ? s : { ...s, branches: removeFromBranches(s.branches, rest) });
  }
  return steps.map(s => {
    if (s.cid !== h.parentCid || !s.branches) return s;
    const bucket = s.branches[h.branch];
    const next = !rest.length ? bucket.filter((_, i) => i !== h.index) : bucket.map((c, i) => i !== h.index ? c : { ...c, branches: removeFromBranches(c.branches, rest) });
    return { ...s, branches: { ...s.branches, [h.branch]: next } };
  });
}

function removeFromBranches(branches: BuilderStep['branches'], path: StepPath): BuilderStep['branches'] {
  if (!branches || !path.length) return branches;
  const [h, ...rest] = path;
  if (h.kind !== 'branch') return branches;
  const bucket = branches[h.branch];
  const next = !rest.length ? bucket.filter((_, i) => i !== h.index) : bucket.map((c, i) => i !== h.index ? c : { ...c, branches: removeFromBranches(c.branches, rest) });
  return { ...branches, [h.branch]: next };
}

function moveAt(steps: BuilderStep[], path: StepPath, dir: -1 | 1): BuilderStep[] {
  if (!path.length) return steps;
  const [h, ...rest] = path;
  const swap = <T,>(arr: T[], i: number) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };
  if (h.kind === 'root') { if (!rest.length) return swap(steps, h.index); return steps.map((s, i) => i !== h.index ? s : { ...s, branches: moveBranches(s.branches, rest, dir) }); }
  return steps.map(s => {
    if (s.cid !== h.parentCid || !s.branches) return s;
    const next = !rest.length ? swap(s.branches[h.branch], h.index) : s.branches[h.branch];
    return { ...s, branches: { ...s.branches, [h.branch]: next } };
  });
}

function moveBranches(branches: BuilderStep['branches'], path: StepPath, dir: -1 | 1): BuilderStep['branches'] {
  if (!branches || !path.length) return branches;
  const [h, ...rest] = path;
  if (h.kind !== 'branch') return branches;
  const swap = <T,>(arr: T[], i: number) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c; };
  const next = !rest.length ? swap(branches[h.branch], h.index) : branches[h.branch];
  return { ...branches, [h.branch]: next };
}

// ---- UI sub-components ----
function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function StepEditor({ step, onChange }: { step: BuilderStep; onChange: (s: BuilderStep) => void }) {
  const cfg = step.step_config;
  const set = (p: Record<string, unknown>) => onChange({ ...step, step_config: { ...cfg, ...p } });
  switch (step.step_type) {
    case 'send_message':
      return <FieldBlock label="Message text"><Textarea value={(cfg.text as string) ?? ''} onChange={e => set({ text: e.target.value })} placeholder="Hi! Thanks for reaching out…" className="min-h-24 border-slate-700 bg-slate-800 text-white" /></FieldBlock>;
    case 'add_tag':
    case 'remove_tag':
      return <FieldBlock label="Tag ID"><Input value={(cfg.tag_id as string) ?? ''} onChange={e => set({ tag_id: e.target.value })} placeholder="Paste a Tag ID from the Contacts page" className="border-slate-700 bg-slate-800 text-white" /></FieldBlock>;
    case 'update_contact_field':
      return (<>
        <FieldBlock label="Field">
          <select value={(cfg.field as string) ?? 'name'} onChange={e => set({ field: e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
            <option value="name">Name</option><option value="email">Email</option><option value="company">Company</option>
          </select>
        </FieldBlock>
        <FieldBlock label="Value"><Input value={(cfg.value as string) ?? ''} onChange={e => set({ value: e.target.value })} className="border-slate-700 bg-slate-800 text-white" /></FieldBlock>
      </>);
    case 'wait':
      return (
        <div className="grid grid-cols-2 gap-2">
          <FieldBlock label="Amount"><Input type="number" min={1} value={(cfg.amount as number) ?? 1} onChange={e => set({ amount: Math.max(1, Number(e.target.value)) })} className="border-slate-700 bg-slate-800 text-white" /></FieldBlock>
          <FieldBlock label="Unit">
            <select value={(cfg.unit as string) ?? 'hours'} onChange={e => set({ unit: e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
              <option value="seconds">Seconds</option><option value="minutes">Minutes</option><option value="hours">Hours</option>
            </select>
          </FieldBlock>
        </div>
      );
    case 'condition':
      return (<>
        <FieldBlock label="Subject">
          <select value={(cfg.subject as string) ?? 'message_contains'} onChange={e => set({ subject: e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
            <option value="message_contains">Message contains</option><option value="tag_presence">Contact has tag</option>
          </select>
        </FieldBlock>
        <FieldBlock label={cfg.subject === 'tag_presence' ? 'Tag ID' : 'Value'}>
          <Input value={(cfg.value as string) ?? ''} onChange={e => set({ value: e.target.value })} className="border-slate-700 bg-slate-800 text-white" />
        </FieldBlock>
      </>);
    case 'send_webhook':
      return (<>
        <FieldBlock label="URL"><Input value={(cfg.url as string) ?? ''} onChange={e => set({ url: e.target.value })} placeholder="https://..." className="border-slate-700 bg-slate-800 text-white" /></FieldBlock>
        <FieldBlock label="Body (JSON template)"><Textarea value={(cfg.body_template as string) ?? ''} onChange={e => set({ body_template: e.target.value })} className="min-h-20 border-slate-700 bg-slate-800 font-mono text-xs text-white" /></FieldBlock>
      </>);
    case 'close_conversation':
      return <p className="text-xs text-slate-400">No configuration needed — this marks the conversation as closed.</p>;
    case 'create_deal':
      return (<>
        <FieldBlock label="Title"><Input value={(cfg.title as string) ?? ''} onChange={e => set({ title: e.target.value })} className="border-slate-700 bg-slate-800 text-white" /></FieldBlock>
        <FieldBlock label="Value"><Input type="number" value={(cfg.value as number) ?? 0} onChange={e => set({ value: Number(e.target.value) })} className="border-slate-700 bg-slate-800 text-white" /></FieldBlock>
      </>);
    default: return null;
  }
}

function AddButton({ onPick }: { onPick: (t: StepType) => void }) {
  return (
    <div className="flex flex-col items-center">
      <div className="h-4 w-[2px] bg-slate-700" />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-700 bg-slate-950 text-slate-400 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary" aria-label="Add step">
          <Plus className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 min-w-56 overflow-y-auto border-slate-700 bg-slate-900">
          {ADDABLE_STEPS.map(t => {
            const Icon = STEP_META[t].icon;
            return (
              <DropdownMenuItem key={t} onClick={() => onPick(t)} className="text-slate-300">
                <Icon className="mr-2 h-4 w-4" />{STEP_META[t].label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="h-4 w-[2px] bg-slate-700" />
    </div>
  );
}

interface StepListProps {
  steps: BuilderStep[];
  parentPath: StepPath;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  updateStep: (path: StepPath, upd: (s: BuilderStep) => BuilderStep) => void;
  addStepAt: (parent: ParentScope, index: number, type: StepType) => void;
  deleteStepAt: (path: StepPath) => void;
  moveStepAt: (path: StepPath, dir: -1 | 1) => void;
}

function StepList({ steps, parentPath, ...props }: StepListProps) {
  const parentScope: ParentScope = parentPath.length === 0
    ? { kind: 'root' }
    : (() => { const last = parentPath[parentPath.length - 1]; if (last.kind !== 'branch') return { kind: 'root' } as const; return { kind: 'branch', parentCid: last.parentCid, branch: last.branch } as const; })();
  return (
    <div className="flex flex-col items-center">
      <AddButton onPick={t => props.addStepAt(parentScope, 0, t)} />
      {steps.map((step, idx) => {
        const path: StepPath = [...parentPath, parentScope.kind === 'root' ? { kind: 'root', index: idx } : { kind: 'branch', parentCid: parentScope.parentCid, branch: parentScope.branch, index: idx }];
        const meta = STEP_META[step.step_type];
        const Icon = meta.icon;
        const expanded = props.expandedId === step.cid;
        const isCondition = step.step_type === 'condition';
        return (
          <div key={step.cid} className={`z-10 flex flex-col ${isCondition ? 'w-full max-w-[400px]' : 'w-full max-w-[320px]'}`}>
            <div className={`rounded-lg border border-slate-800 border-l-4 bg-slate-900 shadow-lg ${meta.border}`}>
              <button type="button" onClick={() => props.setExpandedId(expanded ? null : step.cid)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-600" />
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-300"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">{isCondition ? 'Condition' : step.step_type === 'wait' ? 'Wait' : 'Action'}</div>
                  <div className="truncate text-sm font-medium text-white">{meta.label}</div>
                  <div className="truncate text-[11px] text-slate-500">{previewFor(step)}</div>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <div className="border-t border-slate-800 px-4 py-3">
                  <StepEditor step={step} onChange={next => props.updateStep(path, () => next)} />
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => props.moveStepAt(path, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={idx === steps.length - 1} onClick={() => props.moveStepAt(path, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => props.deleteStepAt(path)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {isCondition && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(['yes', 'no'] as const).map(branch => (
                  <div key={branch} className="flex flex-col items-center">
                    <div className={`mb-2 text-[11px] font-semibold uppercase ${branch === 'yes' ? 'text-primary' : 'text-rose-400'}`}>{branch}</div>
                    <StepList {...props} steps={step.branches?.[branch] ?? []} parentPath={[...path, { kind: 'branch', parentCid: step.cid, branch, index: 0 }]} />
                  </div>
                ))}
              </div>
            )}
            <AddButton onPick={t => props.addStepAt(parentScope, idx + 1, t)} />
          </div>
        );
      })}
    </div>
  );
}

function TriggerCard({ type, config, onTypeChange, onConfigChange }: {
  type: TriggerType;
  config: Record<string, unknown>;
  onTypeChange: (t: TriggerType) => void;
  onConfigChange: (c: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="z-10 w-full max-w-[320px]">
      <div className="rounded-lg border border-slate-800 border-l-4 border-l-blue-500 bg-slate-900 shadow-lg">
        <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400"><Zap className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-blue-300">Trigger</div>
            <div className="truncate text-sm font-medium text-white">{TRIGGER_OPTIONS.find(o => o.value === type)?.label ?? type}</div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="space-y-3 border-t border-slate-800 px-4 py-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Trigger type</label>
              <select value={type} onChange={e => onTypeChange(e.target.value as TriggerType)} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-primary focus:outline-none">
                {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">{TRIGGER_OPTIONS.find(o => o.value === type)?.hint}</p>
            </div>
            {type === 'keyword_match' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Keywords (comma-separated)</label>
                  <Input value={((config.keywords as string[]) ?? []).join(', ')} onChange={e => onConfigChange({ ...config, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="border-slate-700 bg-slate-800 text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Match type</label>
                  <select value={(config.match_type as string) ?? 'contains'} onChange={e => onConfigChange({ ...config, match_type: e.target.value })} className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white">
                    <option value="contains">Contains</option><option value="exact">Exact</option>
                  </select>
                </div>
              </>
            )}
            {type === 'time_based' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Schedule (cron expression or HH:mm)</label>
                <Input value={(config.schedule as string) ?? ''} onChange={e => onConfigChange({ ...config, schedule: e.target.value })} placeholder="0 9 * * *" className="border-slate-700 bg-slate-800 text-white" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main exported component ----
export function AutomationBuilder({ initial }: { initial: BuilderState }) {
  const router = useRouter();
  const isEditing = !!initial.id;
  const [state, setState] = useState<BuilderState>(initial);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function patch<K extends keyof BuilderState>(key: K, value: BuilderState[K]) {
    setState(s => ({ ...s, [key]: value }));
  }

  function updateStep(path: StepPath, upd: (s: BuilderStep) => BuilderStep) {
    setState(s => ({ ...s, steps: mapAtPath(s.steps, path, upd) }));
  }

  function addStepAt(parent: ParentScope, index: number, type: StepType) {
    const node: BuilderStep = { cid: uid(), step_type: type, step_config: blankConfig(type), branches: type === 'condition' ? { yes: [], no: [] } : undefined };
    setState(s => ({ ...s, steps: insertAt(s.steps, parent, index, node) }));
    setExpandedId(node.cid);
  }

  function deleteStepAt(path: StepPath) {
    setState(s => ({ ...s, steps: removeAt(s.steps, path) }));
  }

  function moveStepAt(path: StepPath, dir: -1 | 1) {
    setState(s => ({ ...s, steps: moveAt(s.steps, path, dir) }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        name: state.name || 'Untitled Automation',
        description: state.description || undefined,
        triggerType: state.trigger_type,
        triggerConfig: state.trigger_config,
        steps: toApiSteps(state.steps),
        isActive: state.is_active,
      };
      if (isEditing && initial.id) {
        await updateAutomation(initial.id, payload);
        toast.success('Automation saved');
      } else {
        const id = await createAutomation(payload);
        toast.success('Automation created');
        router.replace(`/automations/${id}/edit`);
      }
    } catch {
      toast.error('Failed to save automation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => router.push('/automations')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Back to automations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={state.name}
          onChange={e => patch('name', e.target.value)}
          placeholder="Untitled Automation"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-sm font-semibold text-white placeholder:text-slate-500 focus:bg-slate-800 focus:outline-none sm:text-base"
        />
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden sm:inline">Active</span>
          <Switch checked={state.is_active} onCheckedChange={v => patch('is_active', !!v)} aria-label="Active" />
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEditing ? 'Save' : 'Save Draft'}
        </Button>
      </header>

      <div className="relative flex-1 overflow-y-auto">
        <div className="absolute inset-0 bg-[radial-gradient(circle,#1e293b_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-0 px-4 py-10">
          <TriggerCard
            type={state.trigger_type}
            config={state.trigger_config}
            onTypeChange={t => patch('trigger_type', t)}
            onConfigChange={c => patch('trigger_config', c)}
          />
          <StepList
            steps={state.steps}
            parentPath={[]}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            updateStep={updateStep}
            addStepAt={addStepAt}
            deleteStepAt={deleteStepAt}
            moveStepAt={moveStepAt}
          />
        </div>
      </div>
    </div>
  );
}
