import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="py-8" role="status" aria-label="Đang tải">
      <Skeleton className="h-8 w-1/2 max-w-md" />
      <Skeleton className="mt-3 h-4 w-1/3 max-w-sm" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
