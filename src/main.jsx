import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

const Home               = lazy(() => import("./pages/Home.jsx"));
const Admin              = lazy(() => import("./pages/Admin.jsx"));
const ServicesPage       = lazy(() => import("./pages/ServicesPage.jsx"));
const GalleryPage        = lazy(() => import("./pages/GalleryPage.jsx"));
const BookingPage        = lazy(() => import("./pages/BookingPage.jsx"));
const ContactPage        = lazy(() => import("./pages/ContactPage.jsx"));
const TechniciansPage    = lazy(() => import("./pages/TechniciansPage.jsx"));
const TechnicianDetailPage = lazy(() => import("./pages/TechnicianDetailPage.jsx"));

function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-neutral-600 mb-6">Page not found.</p>
      <a href="/" className="underline text-sm">Back to home</a>
    </main>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="text-neutral-400 text-sm">Loading…</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public pages share the App layout */}
          <Route element={<App />}>
            <Route index element={<Home />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="gallery" element={<GalleryPage />} />
            {/* Booking: general + per-tech deep link */}
            <Route path="book" element={<BookingPage />} />
            <Route path="book/:techId" element={<BookingPage />} />
            {/* Technicians */}
            <Route path="technicians" element={<TechniciansPage />} />
            <Route path="technicians/:techId" element={<TechnicianDetailPage />} />
            <Route path="availability" element={<Navigate to="/book" replace />} />
            <Route path="contact" element={<ContactPage />} />
          </Route>

          {/* Admin stands alone (it renders its own Navbar) */}
          <Route path="admin" element={<SiteSettingsProvider><Admin /></SiteSettingsProvider>} />

          {/* 404 fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>
);
