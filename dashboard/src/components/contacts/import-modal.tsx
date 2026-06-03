import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ImportModal({ open, onOpenChange, onImported }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>
        <div className="p-4 text-slate-400">CSV Import coming soon...</div>
      </DialogContent>
    </Dialog>
  );
}
