import { useEffect, useRef, useState } from "react";
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
                        className="group block rounded-2xl
                       shadow-sm hover:shadow-xl hover:-translate-y-0.5
                       transition overflow-hidden"
                    >
                        <div className="aspect-[4/3] bg-transparent">
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
    const start = useRef({ x: 0, y: 0 });
    const [drag, setDrag] = useState({ x: 0, y: 0 });
    const [ms, setMs] = useState(0);
    const [animating, setAnimating] = useState(false);

    const THRESH_X = 60;
    const THRESH_Y = 70;
    const EASE = "cubic-bezier(.22,.61,.36,1)";

    // Lock page scroll (robust: freezes position) and key handlers
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") slide(+1);
            if (e.key === "ArrowLeft") slide(-1);
        };
        window.addEventListener("keydown", onKey);

        // freeze body scroll
        const html = document.documentElement;
        const prevHtmlOverflow = html.style.overflow;
        const prevBodyOverflow = document.body.style.overflow;
        const scrollY = window.scrollY;

        html.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";

        return () => {
            window.removeEventListener("keydown", onKey);

            // restore
            html.style.overflow = prevHtmlOverflow;
            document.body.style.overflow = prevBodyOverflow;
            const y = Math.abs(parseInt(document.body.style.top || "0", 10));
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.left = "";
            document.body.style.right = "";
            document.body.style.width = "";
            window.scrollTo(0, y);
        };
    }, [onClose]);

    function onStart(e) {
        if (animating) return;
        const t = e.touches ? e.touches[0] : e;
        start.current = { x: t.clientX, y: t.clientY };
        setMs(0);
        setDrag({ x: 0, y: 0 });
    }

    function onMove(e) {
        if (animating) return;
        const t = e.touches ? e.touches[0] : e;
        const dx = t.clientX - start.current.x;
        const dy = t.clientY - start.current.y;

        if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
        setDrag({ x: dx, y: dy });
    }

    function onEnd() {
        if (animating) return;
        const { x, y } = drag;

        if (Math.abs(y) > THRESH_Y && Math.abs(y) > Math.abs(x)) {
            setMs(180);
            onClose();
            return;
        }
        if (Math.abs(x) <= THRESH_X) {
            setMs(180);
            setDrag({ x: 0, y: 0 });
            return;
        }
        const dir = x < 0 ? +1 : -1;
        slide(dir);
    }

    function slide(dir) {
        if (animating) return;
        setAnimating(true);

        const W = (typeof window !== "undefined" ? window.innerWidth : 1000) * 1.1;

        setMs(260);
        setDrag({ x: dir * W, y: 0 });

        setTimeout(() => {
            setMs(0);
            setI((v) =>
                dir > 0 ? (v + 1) % images.length : (v - 1 + images.length) % images.length
            );
            setDrag({ x: -dir * W, y: 0 });

            requestAnimationFrame(() => {
                setMs(260);
                setDrag({ x: 0, y: 0 });
                setTimeout(() => setAnimating(false), 280);
            });
        }, 270);
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[11000] bg-black/70 backdrop-blur-sm flex items-center justify-center"
            style={{ touchAction: "none" }}
            onTouchStart={onStart}
            onTouchMove={onMove}
            onTouchEnd={onEnd}
            onMouseDown={onStart}
            onMouseMove={(e) => { if (e.buttons === 1) onMove(e); }}
            onMouseUp={onEnd}
        >
            {/* Close button (high contrast) */}
            <button
                className="absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-full bg-black/70 hover:bg-black text-white"
                onClick={onClose}
                aria-label="Close"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </button>

            {/* Prev/Next */}
            <button
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 grid place-items-center rounded-full bg-black/60 hover:bg-black text-white select-none"
                onClick={() => slide(-1)}
                aria-label="Previous"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            <img
                src={images[i].url}
                alt=""
                className="max-w-[92vw] max-h-[86vh] object-contain rounded-xl shadow-2xl select-none"
                draggable={false}
                style={{
                    transform: `translateX(${drag.x}px)`,
                    transition: `transform ${ms}ms ${EASE}`,
                }}
            />

            <button
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 grid place-items-center rounded-full bg-black/60 hover:bg-black text-white select-none"
                onClick={() => slide(+1)}
                aria-label="Next"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
        </div>
    );
}




