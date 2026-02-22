import { useCallback, useEffect, useState } from "react";
import { db } from "../lib/firebase";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
} from "firebase/firestore";
import Lightbox from "../components/Lightbox";
import Skeleton from "../components/Skeleton";

const PAGE_SIZE = 24;

async function fetchPage(cursor = null) {
    const col = collection(db, "images");
    const constraints = [orderBy("createdAt", "desc"), limit(PAGE_SIZE)];
    if (cursor) constraints.push(startAfter(cursor));
    const snap = await getDocs(query(col, ...constraints));
    return {
        docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        lastDoc: snap.docs[snap.docs.length - 1] ?? null,
        hasMore: snap.docs.length === PAGE_SIZE,
    };
}

export default function GalleryPage() {
    const [images, setImages] = useState([]);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);

    // Initial load
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchPage().then(({ docs, lastDoc, hasMore }) => {
            if (cancelled) return;
            setImages(docs);
            setLastDoc(lastDoc);
            setHasMore(hasMore);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore || !lastDoc) return;
        setLoadingMore(true);
        const { docs, lastDoc: next, hasMore } = await fetchPage(lastDoc);
        setImages((prev) => [...prev, ...docs]);
        setLastDoc(next);
        setHasMore(hasMore);
        setLoadingMore(false);
    }, [lastDoc, loadingMore]);

    return (
        <section className="mx-auto max-w-6xl px-4 py-10">
            <h1 className="text-3xl font-bold mb-6">Gallery</h1>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
                    ))}
                </div>
            ) : images.length === 0 ? (
                <p className="text-neutral-500">No images yet.</p>
            ) : (
                <>
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
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </button>
                        ))}
                        {loadingMore && Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={`more-${i}`} className="aspect-[4/3] rounded-2xl" />
                        ))}
                    </div>

                    {hasMore && !loadingMore && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={loadMore}
                                className="px-6 py-2 rounded-full border border-black/20 text-sm font-medium hover:bg-black/5 transition"
                            >
                                Load more
                            </button>
                        </div>
                    )}
                </>
            )}

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
