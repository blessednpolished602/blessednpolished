import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";                     // layout (no router inside)
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import GalleryPage from "./pages/GalleryPage.jsx";
import BookingPage from "./pages/BookingPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import "./index.css";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        {/* Public pages share the App layout good practice */}
        <Route element={<App />}>
          <Route index element={<Home />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="book" element={<BookingPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>

        {/* Admin stands alone (it renders its own Navbar) */}
        <Route path="admin" element={<Admin />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
