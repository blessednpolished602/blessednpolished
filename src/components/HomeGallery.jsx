// src/components/HomeGallery.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";

export default function HomeGallery() {
    const [all, setAll] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "images"), orderBy("createdAt", "desc"), limit(12));
        return onSnapshot(q, (snap) => setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    }, []);

    const items = useMemo(() => {
        const featured = all.filter((x) => x.featured);
        return (featured.length ? featured : all).slice(0, 6);
    }, [all]);

    if (!items.length) return null;

    return (
        <section id="gallery" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Gallery</h2>
                    <Link to="/gallery" className="text-sm underline">View full gallery</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                    {items.map((img) => (
                        <div key={img.id} className="group overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 shadow-soft">
                            <div className="aspect-[4/3] bg-neutral-100">
                                <img
                                    src={img.url}
                                    alt=""
                                    loading="lazy"
                                    className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-[1.02]"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
