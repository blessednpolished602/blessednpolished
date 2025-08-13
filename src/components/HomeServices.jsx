// src/components/HomeServices.jsx
import { Link } from "react-router-dom";

const items = [
    {
        key: "bling",
        title: "Swarovski/Diamonds",
        desc: "Genuine Swarovski crystals hand-set — accent nails or full bling.",
    },
    {
        key: "xxl",
        title: "XXL Nail Art",
        desc: "Sculpted extra-long set with custom art, charms, foils & encapsulation.",
    },
    {
        key: "xxxl",
        title: "XXXL Extreme Length",
        desc: "Ultra-long statement nails with 3D/encapsulated design work.",
    },
];

export default function HomeServices() {
    return (
        <section id="services" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Signature Looks</h2>
                    <Link to="/services" className="text-sm underline">View all</Link>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    {items.map((s) => (
                        <div key={s.key} className="rounded-2xl bg-white ring-1 ring-black/5 shadow-soft p-5">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{s.title}</h3>
                                {s.badge && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-black text-white">
                                        {s.badge}
                                    </span>
                                )}
                            </div>
                            <p className="text-neutral-600 mt-2">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
