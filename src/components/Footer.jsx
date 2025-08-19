import SocialLinks from "./SocialLinks";

export default function Footer() {
    return (
        <footer className="border-t border-black/5">
            <div className="mx-auto max-w-6xl px-4 h-20 flex items-center justify-between text-sm text-neutral-700">
                <p>© {new Date().getFullYear()} Blessed N Polished</p>
                <SocialLinks className="justify-center" size={22} gap="gap-5" brand={false} />
            </div>
        </footer>
    )
}
