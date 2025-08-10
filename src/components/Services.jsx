const services = [
    { title: 'Classic Manicure', desc: 'Shape, cuticle care, buff, and polish.' },
    { title: 'Gel Overlay', desc: 'Durable gel for strength and shine.' },
    { title: 'Custom Nail Art', desc: 'Hand-painted designs tailored to you.' },
]

export default function Services() {
    return (
        <section id="services" className="mx-auto max-w-6xl px-4 pb-24">
            <h2 className="text-2xl font-bold mb-6">Featured Services</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((s) => (
                    <article key={s.title} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-soft">
                        <h3 className="font-semibold">{s.title}</h3>
                        <p className="text-sm text-neutral-700 mt-1">{s.desc}</p>
                        <button className="btn btn-ghost mt-4">See details</button>
                    </article>
                ))}
            </div>
        </section>
    )
}
