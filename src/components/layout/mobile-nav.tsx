"use client";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="rounded-full p-2 hover:bg-black/5" aria-label="Mở menu">
          <Menu className="size-6" />
        </SheetTrigger>
        <SheetContent title="Menu" side="right">
          <nav aria-label="Điều hướng di động" className="flex flex-col p-2">
            <Link href="/" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-medium hover:bg-black/5">
              Trang chủ
            </Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 font-medium hover:bg-black/5">
                {l.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
