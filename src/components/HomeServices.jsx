// src/components/HomeServices.jsx
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

const FALLBACK = [
    { key: "bling", title: "Swarovski/Diamonds", desc: "Genuine Swarovski crystals hand-set — accent nails or full bling." },
    { key: "xxl", title: "XXL Nail Art", desc: "Sculpted extra-long set with custom art, charms, foils & encapsulation." },
    { key: "xxxl", title: "XXXL Extreme Length", desc: "Ultra-long statement nails with 3D/encapsulated design work." },
];

export default function HomeServices({ showViewAll }) {
    const { pathname } = useLocation();
    // default behavior: hide the link on /services, show elsewhere
    const showLink = showViewAll ?? pathname !== "/services";

    const [items, setItems] = useState(null);

    useEffect(() => {
        const col = collection(db, "signatureLooks");
        let cancelled = false;

        const apply = (snap) => {
            if (cancelled) return;
            const docs = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((x) => x.enabled !== false);
            setItems(docs.length ? docs : null);
        };

        // Try composite index (order + createdAt); fall back if still building
        getDocs(query(col, orderBy("order", "asc"), orderBy("createdAt", "asc")))
            .then(apply)
            .catch((err) => {
                if (cancelled) return;
                if (err?.code === "failed-precondition") {
                    getDocs(query(col, orderBy("order", "asc"))).then(apply).catch(console.error);
                } else {
                    console.error(err);
                }
            });

        return () => { cancelled = true; };
    }, []);

    const list = items ?? FALLBACK;

    return (
        <section id="services" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Signature Looks</h2>
                    {showLink && (
                        <Link to="/services" className="text-sm underline">
                            View all
                        </Link>
                    )}
                </div>

                {/* Responsive: 1-col on xs, 2-col on sm, 3-col on md+. Cap width on tiny screens */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                    {list.map((s, idx) => (
                        <div
                            key={s.id || s.key || idx}
                            className="group w-full max-w-[420px] sm:max-w-none mx-auto rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl"
                            style={{ background: "linear-gradient(to bottom, #f9d6d1 0%, #ffffff 100%)" }}
                        >
                            {s.imgUrl && (
                                <div className="relative aspect-[16/9] sm:aspect-[4/3]">
                                    <img
                                        src={s.imgUrl}
                                        alt={s.alt || ""}
                                        loading="lazy"
                                        className="absolute inset-0 h-full w-full object-contain"
                                    />
                                    <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
                                </div>
                            )}
                            <div className="p-5">
                                <h3 className="font-semibold">{s.title}</h3>
                                <p className="text-neutral-600 mt-2">{s.desc}</p>
                            </div>
                        </div>

                    ))}
                </div>
            </div>
        </section>
    );
}
