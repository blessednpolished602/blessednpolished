export default function Footer() {
    return (
        <footer className="border-t border-black/5">
            <div className="mx-auto max-w-6xl px-4 h-20 flex items-center justify-between text-sm text-neutral-700">
                <p>© {new Date().getFullYear()} Blessed N Polished</p>
                <a href="#contact" className="hover:text-black">Contact</a>
            </div>
        </footer>
    )
}
