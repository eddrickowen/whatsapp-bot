'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBroadcast, startBroadcast, getTagsForBroadcast, getContactsForBroadcast } from '@/app/actions/broadcasts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, Radio, Users, Tag, Send, Calendar, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type TagItem = { id: string; name: string; color: string | null; contactCount: number };
type ContactItem = { id: string; name: string | null; phone: string };

const STEPS = ['Compose', 'Audience', 'Schedule & Send'] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                done ? 'bg-primary text-primary-foreground' :
                active ? 'border-2 border-primary bg-primary/10 text-primary' :
                'border border-slate-700 bg-slate-800 text-slate-500'
              }`}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`hidden text-sm font-medium sm:block ${
                active ? 'text-white' : done ? 'text-primary' : 'text-slate-500'
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 h-px flex-1 ${i < current ? 'bg-primary' : 'bg-slate-800'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewBroadcastPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 0: Compose
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  // Step 1: Audience
  const [audienceType, setAudienceType] = useState<'all' | 'tags' | 'contacts'>('tags');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [loadingAudience, setLoadingAudience] = useState(false);

  // Step 2: Schedule
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step !== 1) return;
    setLoadingAudience(true);
    Promise.all([getTagsForBroadcast(), getContactsForBroadcast()])
      .then(([t, c]) => { setTags(t); setContacts(c); })
      .catch(() => toast.error('Failed to load audience data'))
      .finally(() => setLoadingAudience(false));
  }, [step]);

  function toggleTag(id: string) {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleContact(id: string) {
    setSelectedContactIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function estimateRecipients(): number {
    if (audienceType === 'all') return contacts.length;
    if (audienceType === 'tags') {
      const taggedIds = new Set(tags.filter(t => selectedTagIds.includes(t.id)).flatMap(() => []));
      return tags.filter(t => selectedTagIds.includes(t.id)).reduce((acc, t) => acc + t.contactCount, 0);
    }
    return selectedContactIds.length;
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('Give your broadcast a name'); return; }
    if (!message.trim()) { toast.error('Write a message first'); return; }

    const tagIds = audienceType === 'tags' ? selectedTagIds : undefined;
    const contactIds = audienceType === 'contacts' ? selectedContactIds : undefined;

    if (audienceType === 'tags' && selectedTagIds.length === 0) {
      toast.error('Select at least one tag'); return;
    }
    if (audienceType === 'contacts' && selectedContactIds.length === 0) {
      toast.error('Select at least one contact'); return;
    }

    setSubmitting(true);
    try {
      const id = await createBroadcast({
        name: name.trim(),
        message: message.trim(),
        tagIds,
        contactIds,
        scheduledAt: !sendNow && scheduledAt ? scheduledAt : undefined,
      });

      if (sendNow) {
        await startBroadcast(id);
        toast.success('Broadcast started! Messages are being sent.');
      } else {
        toast.success('Broadcast scheduled!');
      }
      router.push(`/broadcasts/${id}`);
    } catch (e) {
      toast.error('Failed to create broadcast');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">New Broadcast</h1>
        <p className="mt-1 text-sm text-slate-400">Send a free bulk message via your WhatsApp Web connection.</p>
      </div>

      <StepIndicator current={step} />

      {/* Step 0: Compose */}
      {step === 0 && (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Radio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Compose Message</h2>
              <p className="text-xs text-slate-400">Write the message your contacts will receive.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Broadcast Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., June Promo Campaign"
              className="border-slate-700 bg-slate-800 text-white"
            />
            <p className="text-xs text-slate-500">Internal name — not visible to recipients.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Message</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Hello! We have an exciting offer just for you..."
              className="min-h-[160px] border-slate-700 bg-slate-800 text-white"
            />
            <p className="text-xs text-slate-500">{message.length} characters</p>
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!name.trim() || !message.trim()}
              onClick={() => setStep(1)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Next: Choose Audience <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Audience */}
      {step === 1 && (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Select Audience</h2>
              <p className="text-xs text-slate-400">Choose who receives this broadcast.</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['all', 'tags', 'contacts'] as const).map(type => (
              <button
                key={type}
                onClick={() => setAudienceType(type)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-all ${
                  audienceType === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                {type === 'all' ? 'All Contacts' : type === 'tags' ? 'By Tags' : 'Pick Contacts'}
              </button>
            ))}
          </div>

          {loadingAudience ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {audienceType === 'all' && (
                <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
                  <p className="text-sm text-slate-300">
                    This broadcast will be sent to <span className="font-bold text-primary">{contacts.length}</span> contacts.
                  </p>
                </div>
              )}

              {audienceType === 'tags' && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Select Tags</Label>
                  {tags.length === 0 ? (
                    <p className="text-sm text-slate-500">No tags found. Create tags in the Contacts section first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                            selectedTagIds.includes(tag.id)
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <Tag className="h-3 w-3" />
                          {tag.name}
                          <span className="rounded-full bg-slate-700 px-1 text-[10px]">{tag.contactCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedTagIds.length > 0 && (
                    <p className="text-xs text-slate-400">
                      Estimated ~{tags.filter(t => selectedTagIds.includes(t.id)).reduce((a, t) => a + t.contactCount, 0)} recipients
                    </p>
                  )}
                </div>
              )}

              {audienceType === 'contacts' && (
                <div className="space-y-2">
                  <Label className="text-slate-300">Select Contacts</Label>
                  <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-slate-700 bg-slate-800 p-2">
                    {contacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => toggleContact(c.id)}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-all ${
                          selectedContactIds.includes(c.id)
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                          selectedContactIds.includes(c.id) ? 'bg-primary text-primary-foreground' : 'bg-slate-700 text-slate-200'
                        }`}>
                          {selectedContactIds.includes(c.id) ? <Check className="h-3 w-3" /> : (c.name || c.phone).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{c.name || c.phone}</p>
                          {c.name && <p className="text-xs text-slate-500">{c.phone}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedContactIds.length > 0 && (
                    <p className="text-xs text-slate-400">{selectedContactIds.length} selected</p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => setStep(2)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Next: Schedule <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Schedule & Send */}
      {step === 2 && (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Schedule & Send</h2>
              <p className="text-xs text-slate-400">Review your broadcast and send it.</p>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-400">Name</span>
              <span className="font-medium text-white">{name}</span>
              <span className="text-slate-400">Audience</span>
              <span className="text-white capitalize">
                {audienceType === 'all' ? `All contacts (${contacts.length})` :
                 audienceType === 'tags' ? `${selectedTagIds.length} tag(s)` :
                 `${selectedContactIds.length} contact(s)`}
              </span>
              <span className="text-slate-400">Message</span>
              <span className="truncate text-slate-300">{message.substring(0, 60)}{message.length > 60 ? '…' : ''}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-300">When to send?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSendNow(true)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                  sendNow ? 'border-primary bg-primary/10 text-primary' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Send className="mx-auto mb-1 h-5 w-5" />
                Send Now
              </button>
              <button
                onClick={() => setSendNow(false)}
                className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                  !sendNow ? 'border-primary bg-primary/10 text-primary' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Calendar className="mx-auto mb-1 h-5 w-5" />
                Schedule
              </button>
            </div>
            {!sendNow && (
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
              />
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {submitting ? 'Creating...' : sendNow ? 'Send Broadcast' : 'Schedule Broadcast'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
