import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FieldTooltipProps {
  content: string;
  children: ReactNode;
}

export function FieldTooltip({ content, children }: FieldTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <div className="inline-flex items-center gap-1.5">
          {children}
          <TooltipTrigger asChild>
            <span
              className="inline-flex cursor-help text-text-muted hover:text-text-body transition-colors text-sm"
              aria-label="More info"
            >
              &#9432;
            </span>
          </TooltipTrigger>
        </div>
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
