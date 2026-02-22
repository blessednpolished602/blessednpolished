// src/components/HomeGallery.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import Skeleton from "./Skeleton";

export default function HomeGallery() {
    const [all, setAll] = useState(null); // null = loading

    useEffect(() => {
        let cancelled = false;
        getDocs(query(collection(db, "images"), orderBy("createdAt", "desc"), limit(12)))
            .then((snap) => {
                if (cancelled) return;
                setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
        return () => { cancelled = true; };
    }, []);

    const items = useMemo(() => {
        if (!all) return [];
        const featured = all.filter((x) => x.featured);
        return (featured.length ? featured : all).slice(0, 6);
    }, [all]);

    // Loaded but no images — render nothing
    if (all !== null && !items.length) return null;

    // Still loading — show skeleton section
    if (all === null) {
        return (
            <section id="gallery" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
                <div className="mx-auto max-w-6xl px-4">
                    <div className="mb-6">
                        <Skeleton className="h-8 w-28 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section id="gallery" className="py-12 md:py-16 scroll-mt-24 bg-transparent">
            <div className="mx-auto max-w-6xl px-4">
                <div className="flex items-end justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold">Gallery</h2>
                    <Link to="/gallery" className="text-sm underline">View full gallery</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                    {items.map((img) => (
                        <div key={img.id} className="group overflow-hidden rounded-2xl">
                            <div className="aspect-[4/3] bg-transparent">
                                <img
                                    src={img.url}
                                    alt=""
                                    loading="lazy"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
