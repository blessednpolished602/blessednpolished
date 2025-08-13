import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function App() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#f9d6d1] to-white">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
