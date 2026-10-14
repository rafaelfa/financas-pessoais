import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastFunction = typeof sonnerToast;

export interface ToastProps {
  description?: React.ReactNode;
  title?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
}

export function useToast() {
  const toast = React.useCallback(
    ({ title, description, variant }: ToastProps) => {
      if (variant === "destructive") {
        sonnerToast.error(title as string, { description: description as string });
      } else {
        sonnerToast(title as string, { description: description as string });
      }
    },
    []
  );

  return { toast };
}
