import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Navbar() {
    const navigate = useNavigate();
    const loc = useLocation();
    const [isAuthed, setIsAuthed] = useState(false);

    useEffect(() => onAuthStateChanged(auth, u => setIsAuthed(!!u)), []);

    const goHomeAndScroll = (id) => {
        if (loc.pathname !== "/") {
            navigate("/");
            setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 0);
        } else {
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-black/5">
            <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
                <button onClick={() => goHomeAndScroll("hero")} className="text-left text-xl font-semibold tracking-tight">
                    Blessed <span className="text-[#ff9e0a]">N</span> Polished
                </button>

                <nav className="hidden sm:flex gap-6 text-sm text-neutral-700 items-center">
                    <button onClick={() => goHomeAndScroll("services")} className="hover:text-black">Services</button>
                    <button onClick={() => goHomeAndScroll("gallery")} className="hover:text-black">Gallery</button>
                    <Link to="/book" className="hover:text-black">Booking</Link>
                    <Link to="/contact" className="hover:text-black">Contact</Link>

                    {isAuthed && (
                        <>
                            <span className="mx-2 h-4 w-px bg-neutral-300" />
                            <Link to="/admin" className="text-neutral-600 hover:text-black">Admin</Link>
                            <button className="btn btn-ghost" onClick={() => signOut(auth)}>Sign out</button>
                        </>
                    )}
                </nav>

                <Link to="/book" className="btn btn-primary sm:ml-6">Book Now</Link>
            </div>
        </header>
    );
}
