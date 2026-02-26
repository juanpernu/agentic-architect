import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="min-h-screen flex flex-col bg-white text-foreground">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg">
          <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 md:px-8">
            <span className="font-bold text-lg sm:text-xl tracking-tight">Agentect</span>

            <div className="flex items-center gap-3 sm:gap-4 md:gap-8">
              <a href="#features" className="text-[11px] sm:text-xs md:text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Funcionalidades
              </a>
              <a href="#pricing" className="text-[11px] sm:text-xs md:text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Precios
              </a>
              <Button size="sm" asChild className="h-8 px-3 text-xs sm:text-sm sm:h-9 sm:px-4">
                <Link href="/sign-up">Empezar</Link>
              </Button>
            </div>
          </div>
        </nav>

        <main className="flex-1">{children}</main>
      </div>
    </ClerkProvider>
  );
}
