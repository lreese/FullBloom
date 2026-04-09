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
          <DialogTitle className="text-[#1e3a5f]">
            Archive {customerName}?
          </DialogTitle>
          <DialogDescription className="text-sm text-[#334155]">
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
            className="bg-[#c27890] hover:bg-[#a8607a] text-white"
            onClick={onConfirm}
          >
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
