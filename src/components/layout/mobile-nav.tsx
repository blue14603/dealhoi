"use client";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const all = [{ href: "/", label: "Trang chủ" }, ...links, { href: "/tim-kiem", label: "Tìm deal" }];
  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="grid size-11 place-items-center rounded-lg hover:bg-white/5" aria-label="Mở menu">
          <Menu className="size-6" />
        </SheetTrigger>
        <SheetContent title="Menu" side="right">
          <nav aria-label="Điều hướng di động" className="flex flex-col p-3">
            {all.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="font-display rounded-xl px-4 py-3 text-xl font-semibold hover:bg-white/5">
                {l.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
