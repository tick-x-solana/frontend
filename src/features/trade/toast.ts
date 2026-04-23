"use client";

import { toast } from "sonner";

type ToastOptions = Parameters<typeof toast>[1];

export const appToast = {
  info: (message: string, options?: ToastOptions) => toast.info(message, options),
  success: (message: string, options?: ToastOptions) =>
    toast.success(message, options),
  warning: (message: string, options?: ToastOptions) =>
    toast.warning(message, options),
  error: (message: string, options?: ToastOptions) => toast.error(message, options),
};
