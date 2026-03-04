import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { trackEvent } from "./lib/analytics";

export default function App() {
  const location = useLocation();
  const isFirst = useRef(true);

  // Fire page_view on every SPA route change (skip first render — GA4 fires it automatically on load)
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    trackEvent("page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location.pathname, location.search]);

  return (
    <SiteSettingsProvider>
      <div className="min-h-dvh w-full overflow-x-clip bg-gradient-to-b from-[#f9d6d1] to-white">
        <Navbar />
        <main className="w-full overflow-x-clip">
          <Outlet />
        </main>
        <Footer />
      </div>
    </SiteSettingsProvider>
  );
}
