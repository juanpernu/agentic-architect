import { LoadingTable } from '@/components/ui/loading-skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <LoadingTable rows={5} />
    </div>
  );
}
