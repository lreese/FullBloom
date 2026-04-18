import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ProductArchiveDialogProps {
  open: boolean;
  entityName: string;
  entityType: "variety" | "product line" | "color" | "sales item";
  warningText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ProductArchiveDialog({
  open,
  entityName,
  entityType,
  warningText,
  onConfirm,
  onCancel,
}: ProductArchiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-heading">
            Archive {entityName}?
          </DialogTitle>
          <DialogDescription className="text-sm text-text-body">
            {warningText
              ? warningText
              : `This ${entityType} will be hidden from the active list but can be restored later.`}
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
