// src/components/Gallery.jsx
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Skeleton from "./Skeleton";

export default function Gallery() {
    const [images, setImages] = useState(null); // null = loading

    useEffect(() => {
        let cancelled = false;
        getDocs(query(collection(db, "images"), orderBy("createdAt", "desc")))
            .then((snap) => {
                if (cancelled) return;
                setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            });
        return () => { cancelled = true; };
    }, []);

    return (
        <section className="mx-auto max-w-6xl px-4 pb-24">
            <h2 className="text-2xl font-bold mb-6">Gallery</h2>

            {images === null ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-square rounded-2xl" />
                    ))}
                </div>
            ) : images.length === 0 ? (
                <p className="text-neutral-600">No images yet. Upload from the Admin page.</p>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img) => (
                        <div key={img.id} className="aspect-square rounded-2xl border shadow-soft overflow-hidden bg-neutral-50">
                            <img
                                src={img.url}
                                alt=""
                                className="w-full h-full object-contain"
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
