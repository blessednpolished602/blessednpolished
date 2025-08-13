import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

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
                        className="group block rounded-2xl bg-white ring-1 ring-black/5
                       shadow-sm hover:shadow-xl hover:-translate-y-0.5
                       transition overflow-hidden"
                    >
                        <div className="aspect-[4/3] bg-neutral-100">
                            <img
                                src={img.url}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-contain p-1
                           transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                        </div>
                    </button>
                ))}
            </div>

            {activeIndex != null && (
                <Lightbox
                    images={images}
                    index={activeIndex}
                    onClose={() => setActiveIndex(null)}
                />
            )}
        </section>
    );
}

function Lightbox({ images, index, onClose }) {
    const [i, setI] = useState(index);

    // keep internal index in sync if user opens another thumb while open
    useEffect(() => setI(index), [index]);

    // keyboard nav + escape to close
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") setI((v) => (v + 1) % images.length);
            if (e.key === "ArrowLeft") setI((v) => (v - 1 + images.length) % images.length);
        };
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [images.length, onClose]);

    if (!images?.length) return null;

    const prev = (e) => { e.stopPropagation(); setI((v) => (v - 1 + images.length) % images.length); };
    const next = (e) => { e.stopPropagation(); setI((v) => (v + 1) % images.length); };
    const close = (e) => { e.stopPropagation(); onClose(); };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/30 backdrop-blur-sm md:backdrop-blur-md"
            onClick={onClose} // clicking the glass closes
        >
            {/* Close */}
            <button
                className="absolute top-4 right-4 text-white text-3xl"
                onClick={close}
                aria-label="Close"
            >
                ×
            </button>

            {/* Prev */}
            <button
                className="absolute left-4 md:left-8 text-white text-4xl"
                onClick={prev}
                aria-label="Previous"
            >
                ‹
            </button>

            {/* Image */}
            <div
                className="relative max-w-[92vw] max-h-[86vh]"
                onClick={(e) => e.stopPropagation()} // don't close when clicking image
            >
                <img
                    src={images[i]?.url}
                    alt=""
                    className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl shadow-2xl
                     ring-1 ring-white/20 bg-white/5"
                />
            </div>

            {/* Next */}
            <button
                className="absolute right-4 md:right-8 text-white text-4xl"
                onClick={next}
                aria-label="Next"
            >
                ›
            </button>
        </div>
    );
}
