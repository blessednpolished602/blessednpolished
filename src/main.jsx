import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import GalleryPage from "./pages/GalleryPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";      // now supports /book and /book/:techId
import ContactPage from "./pages/ContactPage.jsx";

// NEW
import TechniciansPage from "./pages/TechniciansPage.jsx";
import TechnicianDetailPage from "./pages/TechnicianDetailPage.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
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
            <Route path="contact" element={<ContactPage />} />
          </Route>

          {/* Admin stands alone (it renders its own Navbar) */}
          <Route path="admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
