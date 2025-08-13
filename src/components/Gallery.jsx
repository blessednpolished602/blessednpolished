// src/components/Gallery.jsx
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

export default function Gallery() {
    const [images, setImages] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "images"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    return (
        <section className="mx-auto max-w-6xl px-4 pb-24">
            <h2 className="text-2xl font-bold mb-6">Gallery</h2>

            {images.length === 0 ? (
                <p className="text-neutral-600">No images yet. Upload from the Admin page.</p>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img) => (
                        <img
                            key={img.id}
                            src={img.url}
                            alt=""
                            className="w-full h-64 object-cover rounded-2xl border shadow-soft"
                            loading="lazy"
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
