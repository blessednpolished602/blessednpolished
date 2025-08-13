// src/components/MediaLibraryModal.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { ref, listAll, getDownloadURL, getMetadata } from "firebase/storage";

export default function MediaLibraryModal({ open, onClose, onSelect }) {
    const [imagesFS, setImagesFS] = useState([]);      // from Firestore
    const [imagesST, setImagesST] = useState([]);      // from Storage
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [cat, setCat] = useState("all");

    // Load Firestore library
    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, "images"), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snap) =>
            setImagesFS(
                snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            )
        );
    }, [open]);

    // Load Storage folders (hero + gallery) so existing files show up
    useEffect(() => {
        if (!open) return;
        let canceled = false;
        async function fetchFolder(path, category) {
            try {
                const res = await listAll(ref(storage, path));
                const items = await Promise.all(
                    res.items.map(async (item) => {
                        const [url, meta] = await Promise.all([
                            getDownloadURL(item),
                            getMetadata(item).catch(() => null),
                        ]);
                        return {
                            id: `st:${item.fullPath}`,
                            url,
                            path: item.fullPath,
                            category,
                            name: item.name.toLowerCase(),
                            size: meta?.size ?? null,
                            createdAt: meta?.timeCreated ? Date.parse(meta.timeCreated) : 0,
                        };
                    })
                );
                return items;
            } catch {
                return [];
            }
        }

        (async () => {
            setLoading(true);
            const [hero, gallery] = await Promise.all([
                fetchFolder("assets/hero", "hero"),
                fetchFolder("gallery", "general"),
            ]);
            if (!canceled) {
                setImagesST([...hero, ...gallery]);
                setLoading(false);
            }
        })();

        return () => { canceled = true; };
    }, [open]);

    // Merge & dedupe by storage path (FS docs will win)
    const images = useMemo(() => {
        const map = new Map();
        for (const it of imagesST) map.set(it.path, it);
        for (const it of imagesFS) map.set(it.path || it.url, { ...it }); // FS may not have path for old docs
        const arr = [...map.values()];
        arr.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        return arr;
    }, [imagesFS, imagesST]);

    const filtered = images.filter((i) => {
        const inCat = cat === "all" || (i.category || "general") === cat;
        const term = search.trim().toLowerCase();
        const inSearch =
            !term ||
            i.name?.includes(term) ||
            i.path?.toLowerCase().includes(term);
        return inCat && inSearch;
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center">
            <div className="bg-white rounded-2xl p-4 w-[min(900px,100%)]">
                <div className="flex gap-2 mb-3">
                    <input
                        className="border rounded px-3 py-2 flex-1"
                        placeholder="Search name…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="border rounded px-3 py-2"
                        value={cat}
                        onChange={(e) => setCat(e.target.value)}
                    >
                        <option value="all">All</option>
                        <option value="hero">Hero</option>
                        <option value="general">General</option>
                        <option value="nails">Nails</option>
                        <option value="designs">Designs</option>
                    </select>
                </div>

                {loading ? (
                    <p className="text-sm text-neutral-600 p-4">Loading media…</p>
                ) : filtered.length === 0 ? (
                    <p className="text-sm text-neutral-600 p-4">No media found.</p>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] overflow-auto">
                        {filtered.map((img) => (
                            <button
                                key={img.id}
                                className="border rounded overflow-hidden hover:ring-2 hover:ring-black"
                                onClick={() => {
                                    onSelect(img);
                                    onClose();
                                }}
                            >
                                <img src={img.url} className="w-full h-24 object-cover" />
                                <div className="px-2 py-1 text-[11px] text-neutral-600 truncate">
                                    {(img.category || "general").toUpperCase()}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-3 text-right">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
