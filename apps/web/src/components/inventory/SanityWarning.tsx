import { X } from "lucide-react";

interface SanityWarningProps {
  message: string;
  onDismiss: () => void;
}

export function SanityWarning({ message, onDismiss }: SanityWarningProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-xs font-medium text-[#92400e]">
      <span>{message}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="ml-0.5 rounded-full p-0.5 hover:bg-[#f59e0b]/20 transition-colors"
        aria-label="Dismiss warning"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
