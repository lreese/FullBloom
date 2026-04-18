import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CustomerArchiveDialogProps {
  open: boolean;
  customerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CustomerArchiveDialog({
  open,
  customerName,
  onConfirm,
  onCancel,
}: CustomerArchiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-heading">
            Archive {customerName}?
          </DialogTitle>
          <DialogDescription className="text-sm text-text-body">
            They will be hidden from the active list but can be restored later.
            Existing orders will not be affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-rose-action hover:bg-rose-action/90 text-white"
            onClick={onConfirm}
          >
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
