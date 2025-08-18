import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import Lightbox from "../components/Lightbox";

export default function GalleryPage() {
    const [images, setImages] = useState([]);
    const [activeIndex, setActiveIndex] = useState(null);

    useEffect(() => {
        const q = query(collection(db, "images"), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snap) =>
            setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        );
    }, []);

    return (
        <section className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="text-3xl font-bold mb-6">Gallery</h1>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((img, i) => (
                    <button
                        key={img.id}
                        onClick={() => setActiveIndex(i)}
                        className="group block rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition overflow-hidden"
                    >
                        <div className="aspect-[4/3] bg-transparent">
                            <img
                                src={img.url}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                        </div>
                    </button>
                ))}
            </div>

            {activeIndex != null && (
                <Lightbox
                    images={images}                // shared Lightbox reads .url
                    index={activeIndex}
                    onClose={() => setActiveIndex(null)}
                />
            )}
        </section>
    );
}
