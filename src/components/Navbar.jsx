export default function Navbar({ onBook }) {
    return (
        <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-black/5">
            <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
                <a href="#" className="text-xl font-semibold tracking-tight">
                    Blessed <span className="text-[#ff9e0a]">N</span> Polished
                </a>
                <nav className="hidden sm:flex gap-6 text-sm text-neutral-700">
                    <a href="#services" className="hover:text-black">Services</a>
                    <a href="#gallery" className="hover:text-black">Gallery</a>
                    <a href="#contact" className="hover:text-black">Contact</a>
                </nav>
                <button className="btn btn-primary sm:ml-6" onClick={onBook}>
                    Book Now
                </button>
            </div>
        </header>
    )
}
