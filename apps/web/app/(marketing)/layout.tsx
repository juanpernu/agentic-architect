import { ClerkProvider } from '@clerk/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="min-h-screen flex flex-col bg-white text-foreground">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-2">
              <div className="bg-primary/20 p-1.5 rounded-lg">
                <span className="text-primary font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-xl tracking-tight">Agentect</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Funcionalidades
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Precios
              </a>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/sign-in">Ingresar</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-up">Empezar Gratis</Link>
              </Button>
            </div>
          </div>
        </nav>

        <main className="flex-1">{children}</main>
      </div>
    </ClerkProvider>
  );
}
