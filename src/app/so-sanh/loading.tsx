import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="py-8" role="status" aria-label="Đang tải so sánh ưu đãi">
      <Skeleton className="h-8 w-2/3 max-w-lg" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-md" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[7fr_3fr]">
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="hidden h-96 w-full lg:block" />
      </div>
    </div>
  );
}
