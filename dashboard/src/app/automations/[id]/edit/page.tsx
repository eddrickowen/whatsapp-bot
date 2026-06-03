'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getAutomationById } from '@/app/actions/automations';
import { AutomationBuilder } from '@/components/automations/automation-builder';

function cid() {
  return 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function addCids(steps: any[]): any[] {
  return steps.map(s => ({
    ...s,
    cid: cid(),
    branches: s.branches ? {
      yes: addCids(s.branches.yes ?? []),
      no: addCids(s.branches.no ?? []),
    } : undefined,
  }));
}

export default function EditAutomationPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any | null | 'error'>(null);

  useEffect(() => {
    getAutomationById(id)
      .then(a => setData(a ?? 'error'))
      .catch(() => setData('error'));
  }, [id]);

  if (data === null) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (data === 'error') {
    return <div className="flex h-64 items-center justify-center text-slate-400">Automation not found.</div>;
  }

  return (
    <AutomationBuilder
      initial={{
        id: data.id,
        name: data.name,
        description: data.description ?? '',
        trigger_type: data.trigger_type,
        trigger_config: data.trigger_config ?? {},
        is_active: data.is_active,
        steps: addCids(Array.isArray(data.steps) ? data.steps : []),
      }}
    />
  );
}
