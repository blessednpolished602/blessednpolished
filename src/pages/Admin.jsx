// src/pages/Admin.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

import { auth, db, storage } from "../lib/firebase";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import {
    addDoc,
    collection,
    serverTimestamp,
    onSnapshot,
    orderBy,
    query,
    deleteDoc,
    doc,
    setDoc,
} from "firebase/firestore";

import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "firebase/storage";

import useSiteSettings from "../hooks/useSiteSettings";
import MediaLibraryModal from "../components/MediaLibraryModal";



function ProgressBar({ value }) {
    if (value == null) return null;
    return (
        <div className="mt-2 w-full">
            <div className="h-2 w-full bg-neutral-200 rounded">
                <div
                    className="h-2 bg-black rounded transition-[width] duration-200"
                    style={{ width: `${Math.max(2, value)}%` }} // min 2% so it's visible
                />
            </div>
            <div className="text-xs mt-1 text-neutral-600">{value}%</div>
        </div>
    );
}


/* ===================== Admin Root ===================== */

export default function Admin() {
    const [user, setUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoadingAuth(false);
        });
        return unsub;
    }, []);

    if (loadingAuth) return null; // or a spinner
    if (!user) return <LoginForm />;

    return (
        <div className="mx-auto max-w-6xl p-6 space-y-10">
            <Navbar />
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Admin</h1>
                <div className="flex items-center gap-3">
                    <Link to="/" className="text-sm underline">View Site</Link>
                    <button className="btn btn-ghost" onClick={() => signOut(auth)}>
                        Sign out
                    </button>
                </div>
            </header>

            <HeroEditor />
            <GalleryUploader />
            <GalleryManager />
        </div>
    );
}

/* ===================== Login ===================== */

function LoginForm() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [err, setErr] = useState("");

    async function login(e) {
        e.preventDefault();
        setErr("");
        try {
            await signInWithEmailAndPassword(auth, form.email, form.password);
            navigate("/admin", { replace: true });
        } catch (e) {
            setErr(e.message || "Login failed");
        }
    }

    return (
        <div className="min-h-screen grid place-items-center p-6">
            <form
                onSubmit={login}
                className="w-full max-w-sm bg-white p-6 rounded-2xl border shadow-soft space-y-3"
            >
                <h2 className="text-lg font-semibold">Admin Login</h2>
                <input
                    className="w-full border rounded-lg px-3 py-2"
                    type="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <input
                    className="w-full border rounded-lg px-3 py-2"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                    }
                />
                {err && <p className="text-sm text-red-600">{err}</p>}
                <button className="btn btn-primary w-full">Sign In</button>
            </form>
        </div>
    );
}

/* ===================== Hero Editor ===================== */

function HeroEditor() {
    const s = useSiteSettings();

    const [file, setFile] = useState(null);
    const [picked, setPicked] = useState(null);
    const [showLib, setShowLib] = useState(false);

    const [headline, setHeadline] = useState("");
    const [sub, setSub] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploadPct, setUploadPct] = useState(null);

    useEffect(() => {
        setHeadline(s?.heroHeadline || "");
        setSub(s?.heroSub || "");
    }, [s]);

    async function save(e) {
        e.preventDefault();
        setSaving(true);
        try {
            let heroImage;

            if (file) {
                const path = `assets/hero/${Date.now()}_${file.name}`;
                const r = ref(storage, path);
                const task = uploadBytesResumable(r, file);

                await new Promise((resolve, reject) => {
                    task.on(
                        "state_changed",
                        (snap) => {
                            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                            setUploadPct(pct);
                        },
                        reject,
                        resolve
                    );
                });

                heroImage = await getDownloadURL(task.snapshot.ref);
            } else if (picked) {
                heroImage = picked.url; // reuse existing media
            }

            await setDoc(
                doc(db, "site", "settings"),
                {
                    ...(heroImage ? { heroImage } : {}),
                    heroHeadline: headline,
                    heroSub: sub,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            setFile(null);
            setPicked(null);
        } finally {
            setSaving(false);
            setUploadPct(null);
        }
    }

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-3">
            <h2 className="font-semibold">Hero Content</h2>

            {s?.heroImage && (
                <img src={s.heroImage} alt="" className="h-28 w-full object-cover rounded" />
            )}

            <div className="flex items-center gap-2">
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button type="button" className="btn btn-ghost" onClick={() => setShowLib(true)}>
                    Choose from Library
                </button>
            </div>

            {picked && <img src={picked.url} alt="" className="h-20 rounded" />}

            <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
            />
            <input
                className="border rounded-lg px-3 py-2 w-full"
                placeholder="Subheadline"
                value={sub}
                onChange={(e) => setSub(e.target.value)}
            />

            <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? (uploadPct != null ? `Uploading ${uploadPct}%…` : "Saving…") : "Save"}
            </button>

            <ProgressBar value={uploadPct} />

            <MediaLibraryModal open={showLib} onClose={() => setShowLib(false)} onSelect={setPicked} />
        </section>
    );
}


/* ===================== Gallery Uploader ===================== */

function GalleryUploader() {
    const [file, setFile] = useState(null);
    const [picked, setPicked] = useState(null);
    const [showLib, setShowLib] = useState(false);
    const [category, setCategory] = useState("general");
    const [busy, setBusy] = useState(false);
    const [uploadPct, setUploadPct] = useState(null);

    async function upload(e) {
        e.preventDefault();
        if (!file && !picked) return;

        setBusy(true);
        try {
            let url, path, name, size;

            if (file) {
                const p = `gallery/${Date.now()}_${file.name}`;
                const r = ref(storage, p);
                const task = uploadBytesResumable(r, file);

                await new Promise((resolve, reject) => {
                    task.on(
                        "state_changed",
                        (snap) => {
                            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                            setUploadPct(pct);
                        },
                        reject,
                        resolve
                    );
                });

                url = await getDownloadURL(task.snapshot.ref);
                path = p;
                name = file.name.toLowerCase();
                size = file.size;
            } else {
                // reuse existing media from library (no upload progress needed)
                url = picked.url;
                path = picked.path;
                name = picked.name || "";
                size = picked.size || 0;
            }

            await addDoc(collection(db, "images"), {
                url,
                path,
                category,
                name,
                size,
                createdAt: serverTimestamp(),
                source: file ? "upload" : "library",
            });

            setFile(null);
            setPicked(null);
        } finally {
            setBusy(false);
            setUploadPct(null);
        }
    }

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft">
            <h2 className="font-semibold mb-3">Upload to Gallery</h2>
            <form className="flex flex-wrap items-center gap-3" onSubmit={upload}>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <button type="button" className="btn btn-ghost" onClick={() => setShowLib(true)}>
                    Choose from Library
                </button>
                <select
                    className="border rounded-lg px-3 py-2"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="general">General</option>
                    <option value="nails">Nails</option>
                    <option value="designs">Designs</option>
                </select>
                <button className="btn btn-primary" disabled={(!file && !picked) || busy}>
                    {busy ? (uploadPct != null ? `Uploading ${uploadPct}%…` : "Adding…") : "Add"}
                </button>
            </form>

            <ProgressBar value={uploadPct} />

            {picked && (
                <div className="mt-3">
                    <img src={picked.url} alt="" className="h-24 rounded" />
                </div>
            )}

            <MediaLibraryModal open={showLib} onClose={() => setShowLib(false)} onSelect={setPicked} />
        </section>
    );
}


/* ===================== Gallery Manager ===================== */

function GalleryManager() {
    const [images, setImages] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "images"), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snap) =>
            setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        );
    }, []);

    async function remove(img) {
        const ok = confirm("Delete this image?");
        if (!ok) return;

        try {
            await deleteObject(ref(storage, img.path)).catch(() => { });
            await deleteDoc(doc(db, "images", img.id));
        } catch (e) {
            console.error(e);
            alert("Couldn’t delete. Try again.");
        }
    }

    return (
        <section>
            <h2 className="font-semibold mb-3">Manage Gallery</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((img) => (
                    <div
                        key={img.id}
                        className="bg-white border rounded-2xl overflow-hidden shadow-soft"
                    >
                        {/* keeps uniform tiles; no cropping */}
                        <div className="aspect-[4/3] bg-neutral-100">
                            <img
                                src={img.url}
                                alt=""
                                loading="lazy"
                                className="w-full h-full object-contain p-1"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 text-sm">
                            <span className="text-neutral-600">
                                {img.category || "general"}
                            </span>
                            <button className="btn btn-ghost" onClick={() => remove(img)}>
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

        </section>
    );
}
