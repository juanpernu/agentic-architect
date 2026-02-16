'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardKPIs } from '@/components/dashboard/dashboard-kpis';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamically import chart components to avoid SSR issues with Recharts
const SpendByProjectChart = dynamic(
  () => import('@/components/dashboard/spend-by-project-chart').then(mod => mod.SpendByProjectChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Gasto por Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    ),
  }
);

const SpendTrendChart = dynamic(
  () => import('@/components/dashboard/spend-trend-chart').then(mod => mod.SpendTrendChart),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Tendencia Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    ),
  }
);

const RecentReceipts = dynamic(
  () => import('@/components/dashboard/recent-receipts').then(mod => mod.RecentReceipts),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardHeader>
          <CardTitle>Comprobantes Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    ),
  }
);

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de tus proyectos"
      />

      <div className="space-y-6">
        {/* KPIs Section */}
        <Suspense
          fallback={
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-6 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                </div>
              ))}
            </div>
          }
        >
          <DashboardKPIs />
        </Suspense>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>Gasto por Proyecto</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <SpendByProjectChart />
          </Suspense>

          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia Mensual</CardTitle>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            }
          >
            <SpendTrendChart />
          </Suspense>
        </div>

        {/* Recent Receipts Section */}
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Comprobantes Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          }
        >
          <RecentReceipts />
        </Suspense>
      </div>
    </>
  );
}
