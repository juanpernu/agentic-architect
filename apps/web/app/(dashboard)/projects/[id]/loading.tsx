import { LoadingCards, LoadingTable } from '@/components/ui/loading-skeleton';

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <LoadingCards count={3} />
      <LoadingTable rows={5} />
    </div>
  );
}
