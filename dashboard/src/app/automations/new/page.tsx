'use client';

import { useSearchParams } from 'next/navigation';
import { AutomationBuilder } from '@/components/automations/automation-builder';

const TEMPLATES: Record<string, any> = {
  welcome_message: {
    name: 'Welcome Message',
    trigger_type: 'new_contact_created',
    trigger_config: {},
    steps: [{ cid: 'tpl1', step_type: 'send_message', step_config: { text: 'Hello! 👋 Thanks for reaching out. How can we help you today?' } }]
  },
  out_of_office: {
    name: 'Out of Office',
    trigger_type: 'new_message_received',
    trigger_config: {},
    steps: [{ cid: 'tpl1', step_type: 'send_message', step_config: { text: 'Hi! We are currently out of office. We will get back to you during business hours. Thank you for your patience! 🙏' } }]
  },
  keyword_promo: {
    name: 'Keyword: PROMO',
    trigger_type: 'keyword_match',
    trigger_config: { keywords: ['promo', 'harga', 'diskon'], match_type: 'contains' },
    steps: [{ cid: 'tpl1', step_type: 'send_message', step_config: { text: 'Hi! Here are our latest promotions: [paste your promo link here]. Feel free to ask more questions! 😊' } }]
  },
  lead_tagger: {
    name: 'New Lead Tagger',
    trigger_type: 'new_contact_created',
    trigger_config: {},
    steps: [{ cid: 'tpl1', step_type: 'add_tag', step_config: { tag_id: '' } }]
  },
};

export default function NewAutomationPage() {
  const params = useSearchParams();
  const templateSlug = params.get('template');
  const template = templateSlug ? TEMPLATES[templateSlug] : null;

  return (
    <AutomationBuilder
      initial={{
        name: template?.name ?? '',
        description: '',
        trigger_type: template?.trigger_type ?? 'new_message_received',
        trigger_config: template?.trigger_config ?? {},
        is_active: false,
        steps: template?.steps ?? [],
      }}
    />
  );
}
