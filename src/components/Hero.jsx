export default function Hero({ onBook }) {
    return (
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900">
                Nail Art • Luxe Care • <span className="text-[#ff9e0a]">Clean Aesthetic</span>
            </h1>
            <p className="mt-5 text-lg text-neutral-700 max-w-2xl mx-auto">
                Premium nail services with a gentle touch. Modern designs, healthy nails, spotless hygiene.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
                <a href="#services" className="btn btn-primary">Explore Services</a>
                <button className="btn btn-ghost" onClick={onBook}>Book Now</button>
            </div>
        </section>
    )
}
