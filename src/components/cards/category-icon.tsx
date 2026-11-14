import { Coffee, CreditCard, Plane, ShoppingBag, Smartphone, Store, Ticket, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  smartphone: Smartphone,
  plane: Plane,
  ticket: Ticket,
  "credit-card": CreditCard,
};

export function CategoryIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Store;
  return <Icon className={className ?? "size-5"} aria-hidden />;
}
