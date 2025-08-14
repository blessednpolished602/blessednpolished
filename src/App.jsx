import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-gradient-to-b from-[#f9d6d1] to-white">
      <Navbar />
      <main className="w-full overflow-x-clip">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
