// src/components/Navbar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import SocialLinks from "./SocialLinks"

export default function Navbar() {
    const navigate = useNavigate();
    const loc = useLocation();
    const [isAuthed, setIsAuthed] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => onAuthStateChanged(auth, (u) => setIsAuthed(!!u)), []);
    useEffect(() => setOpen(false), [loc.pathname]);

    // lock body scroll & Esc to close
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = open ? "hidden" : "";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open]);

    const goHomeAndScroll = (id) => {
        const scrollTo = () =>
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        if (loc.pathname !== "/") {
            navigate("/");
            setTimeout(scrollTo, 0);
        } else {
            scrollTo();
        }
    };

    return (
        <>
            <header className="sticky top-0 z-[200] backdrop-blur bg-white/70 border-b border-black/5">
                <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
                    {/* Brand */}
                    <button
                        onClick={() => goHomeAndScroll("hero")}
                        className="text-left text-xl font-semibold tracking-tight"
                    >
                        Blessed <span className="text-[#ff9e0a]">N</span> Polished
                    </button>

                    {/* Desktop nav */}
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

                    {/* Right: CTA + burger */}
                    <div className="flex items-center gap-2">
                        <Link to="/book" className="hidden sm:inline-flex btn btn-primary sm:ml-6">
                            Book Now
                        </Link>
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-black/10"
                            aria-label="Open menu"
                            aria-controls="mobile-drawer"
                            aria-expanded={open}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* PORTAL: overlay + drawer mounted to <body> to escape stacking contexts */}
            {createPortal(
                <>
                    {/* Overlay */}
                    <div
                        className={`fixed inset-0 z-[10000] bg-black/70 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"
                            }`}
                        onClick={() => setOpen(false)}
                        aria-hidden={!open}
                    />

                    {/* Drawer (solid gradient) */}
                    <aside
                        id="mobile-drawer"
                        className={`fixed right-0 top-0 bottom-0 z-[10010] w-[86%] max-w-sm shadow-2xl ring-1 ring-black/10
                        transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"
                            }`}
                        role="dialog"
                        aria-modal="true"
                        style={{ background: "linear-gradient(to bottom, #f9d6d1 0%, #ffffff 100%)" }}
                    >
                        <div className="flex flex-col h-full">
                            <div className="h-16 px-4 border-b border-black/10 bg-white flex items-center justify-between">
                                <span className="font-semibold">Menu</span>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-black/10 bg-white"
                                    aria-label="Close menu"
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>

                            <nav className="p-4 space-y-3">
                                {(() => {
                                    const itemBase =
                                        `block w-full text-left px-4 py-3 rounded-xl text-base font-medium
       text-neutral-900 bg-white hover:bg-neutral-50
       transition translate-x-4 opacity-0`;

                                    return (
                                        <>
                                            <button
                                                onClick={() => { goHomeAndScroll("services"); setOpen(false); }}
                                                className={`${itemBase} ${open ? "translate-x-0 opacity-100" : ""}`}
                                                style={{ transitionDelay: open ? "0ms" : "0ms" }}
                                            >
                                                Services
                                            </button>

                                            <button
                                                onClick={() => { goHomeAndScroll("gallery"); setOpen(false); }}
                                                className={`${itemBase} ${open ? "translate-x-0 opacity-100" : ""}`}
                                                style={{ transitionDelay: open ? "40ms" : "0ms" }}
                                            >
                                                Gallery
                                            </button>

                                            <Link
                                                to="/book"
                                                onClick={() => setOpen(false)}
                                                className={`${itemBase} ${open ? "translate-x-0 opacity-100" : ""}`}
                                                style={{ transitionDelay: open ? "80ms" : "0ms" }}
                                            >
                                                Booking
                                            </Link>

                                            <Link
                                                to="/contact"
                                                onClick={() => setOpen(false)}
                                                className={`${itemBase} ${open ? "translate-x-0 opacity-100" : ""}`}
                                                style={{ transitionDelay: open ? "120ms" : "0ms" }}
                                            >
                                                Contact
                                            </Link>

                                            {isAuthed && (
                                                <>
                                                    <Link
                                                        to="/admin"
                                                        onClick={() => setOpen(false)}
                                                        className={`${itemBase} ${open ? "translate-x-0 opacity-100" : ""}`}
                                                        style={{ transitionDelay: open ? "160ms" : "0ms" }}
                                                    >
                                                        Admin
                                                    </Link>

                                                    <button
                                                        onClick={() => { setOpen(false); signOut(auth); }}
                                                        className={`${itemBase} ${open ? "translate-x-0 opacity-100" : ""}`}
                                                        style={{ transitionDelay: open ? "200ms" : "0ms" }}
                                                    >
                                                        Sign out
                                                    </button>
                                                </>
                                            )}

                                            <Link
                                                to="/book"
                                                onClick={() => setOpen(false)}
                                                className="mt-2 btn btn-primary w-full justify-center"
                                            >
                                                Book Now
                                            </Link>

                                            {/* social icons */}
                                            <div className="pt-4 flex justify-center">
                                                <SocialLinks size={24} gap={18} monochrome={true} />
                                            </div>
                                        </>
                                    );
                                })()}
                            </nav>
                        </div>
                    </aside>
                </>,
                document.body
            )}
        </>
    );
}
