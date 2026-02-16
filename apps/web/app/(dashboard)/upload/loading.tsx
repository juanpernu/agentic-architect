import { LoadingCards } from '@/components/ui/loading-skeleton';

export default function UploadLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <LoadingCards count={1} />
    </div>
  );
}
