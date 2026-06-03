import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ContactDetailView({ open, onOpenChange, contactId, onUpdated }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Contact Details</DialogTitle>
        </DialogHeader>
        <div className="p-4 text-slate-400">Contact details coming soon... (ID: {contactId})</div>
      </DialogContent>
    </Dialog>
  );
}
