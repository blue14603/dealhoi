"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({ title, side = "bottom", children, className }: { title: string; side?: "bottom" | "right"; children: React.ReactNode; className?: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-xl",
          side === "bottom" ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl" : "inset-y-0 right-0 w-[min(90vw,22rem)]",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          <Dialog.Close className="rounded-full p-2 hover:bg-black/5" aria-label="Đóng">
            <X className="size-5" />
          </Dialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
