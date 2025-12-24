
// ... imports ...
// ... imports ...
import { cn } from "@/lib/utils";
import { PropsWithChildren, useMemo } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
// import { supabase } from "@/lib/supabaseClient"; // REMOVED
// import { detectSadMood } from "@/lib/moodDetection"; // Optional, can enable if it uses local data
import { ThemeToggle } from "@/components/shared/ThemeToggle";

function Brand() {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg transition-transform group-hover:scale-105" />
      <span className="text-xl font-extrabold tracking-tight text-foreground/90">Snapmind</span>
    </Link>
  );
}

function Header() {
  const { pathname } = useLocation();

  // Moved mood check logic to be simpler or removed for now to break dependency
  // Real implementation should use useMemory hook if needed
  
  const nav = useMemo(
    () => [
      { to: "/", label: "Dashboard" },
      { to: "/analytics", label: "Analytics" },
    ],
    [],
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Brand />
          <nav className="hidden md:flex items-center gap-2">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                    isActive || pathname === n.to
                      ? "bg-cyan-500/20 text-cyan-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
           {/* Mood Button Logic Removed/Disabled for Cleanup */}
           
          <ThemeToggle />
          
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container flex flex-col items-center justify-between gap-3 py-6 md:h-16 md:flex-row">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Snapmind. Your private memory assistant.
        </p>
        <div className="inline-flex items-center gap-4 text-xs text-muted-foreground">
          <a href="#" className="transition-colors hover:text-cyan-400">
            Privacy
          </a>
          <a href="#" className="transition-colors hover:text-cyan-400">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header />
      <main className="container py-0 md:py-0">{children}</main>
      <Footer />
    </div>
  );
}
