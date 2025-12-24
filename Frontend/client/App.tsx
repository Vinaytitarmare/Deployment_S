import "./global.css";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
// import Library from "./pages/Library"; // Uncomment if you add this page back
// import Settings from "./pages/Settings"; // Uncomment if you add this page back
import AppLayout from "@/components/layout/AppLayout";
import { ThemeProvider } from "@/context/ThemeContext";
import { MemoryProvider } from "@/data/memoryStore";
import Analytics from "./pages/Analytics";
import TodaysMood from "./pages/TodaysMood";

// --- NEW AUTH IMPORTS ---

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MemoryProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <AppLayout>
                    <Index />
                  </AppLayout>
                }
              />
              <Route
                path="/analytics"
                element={
                  <AppLayout>
                    <Analytics />
                  </AppLayout>
                }
              />
              <Route
                path="/todays-mood"
                element={
                  <AppLayout>
                    <TodaysMood />
                  </AppLayout>
                }
              />
              <Route
                path="*"
                element={
                  <AppLayout>
                    <NotFound />
                  </AppLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </MemoryProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);