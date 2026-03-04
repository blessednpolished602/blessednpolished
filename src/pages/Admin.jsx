// src/pages/Admin.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

import { auth, db, storage, functions } from "../lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import {
    addDoc,
    collection,
    getDocs,
    serverTimestamp,
    onSnapshot,
    orderBy,
    query,
    deleteDoc,
    doc,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";

import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "firebase/storage";

import useSiteSettings from "../hooks/useSiteSettings";
import AdminCalendarView from "../components/admin/AdminCalendarView";
import MediaLibraryModal from "../components/MediaLibraryModal";
import Footer from "../components/Footer";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { minToTimeString } from "../lib/timeUtils";

// ── Hours helpers (shared by BusinessHoursEditor + ScheduleTab) ───────────────
const DAYS      = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SLOT_MIN  = 30;

/** "HH:MM" from minutes — for <input type="time"> */
function minToTimeInput(min) {
    return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
}

/** minutes from "HH:MM" string */
function timeInputToMin(s) {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
}

/**
 * Get hours for a YYYY-MM-DD date string from site/settings hours object.
 * Returns null if closed, or { startMin, endMin }.
 */
function hoursForDay(hours, dateStr) {
    if (!hours) return null;
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dow = DAYS[new Date(y, mo - 1, d).getDay()];
    const override = hours.byDay?.[dow];
    if (override === null) return null;          // explicitly closed
    return override ?? hours.default ?? null;    // custom | default | unset
}

/** All startMin values in [startMin, endMin) stepping by slotSize */
function genSlots(startMin, endMin, slotSize = SLOT_MIN) {
    const out = [];
    for (let m = startMin; m < endMin; m += slotSize) out.push(m);
    return out;
}

/** Today as "YYYY-MM-DD" (local time) */
function adminTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}



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
        <div className="min-h-dvh w-full overflow-x-clip bg-gradient-to-b from-[#f9d6d1] to-white">
            <Navbar />
            <div className="mx-auto max-w-6xl p-6 space-y-10">
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
                <BusinessHoursEditor />
                <AdminCalendarView />
                <ScheduleTab />
                <BookingsTab />
                <SignatureLooksEditor />
                <TechniciansManager />
                <GalleryUploader />
                <GalleryManager />
            </div>
            <Footer />
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
        <div className="min-h-dvh w-full overflow-x-clip bg-gradient-to-b from-[#f9d6d1] to-white">
            <Navbar />
            <main className="min-h-[calc(100vh-8rem)] grid place-items-center p-6">
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
            </main>
            <Footer />
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
                <div className="w-full max-h-80 rounded overflow-hidden bg-neutral-100">
                    <img src={s.heroImage} alt="" className="w-full h-full object-contain max-h-80" />
                </div>
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
    const [editing, setEditing] = useState(null);
    const [savingCatId, setSavingCatId] = useState(null);

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

    async function updateCategory(img, category) {
        try {
            setSavingCatId(img.id);
            await updateDoc(doc(db, "images", img.id), {
                category,
                updatedAt: serverTimestamp(),
            });
        } finally {
            setSavingCatId(null);
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
                        {/* uniform tiles; no cropping */}
                        <div className="aspect-[4/3] bg-neutral-100">
                            <img
                                src={img.url}
                                alt={img.alt || ""}
                                loading="lazy"
                                className="w-full h-full object-contain p-1"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 text-sm gap-2">
                            <div className="flex items-center gap-2">
                                <label className="text-neutral-600">Category:</label>
                                <select
                                    className="border rounded-md px-2 py-1"
                                    value={img.category || "general"}
                                    onChange={(e) => updateCategory(img, e.target.value)}
                                >
                                    <option value="general">General</option>
                                    <option value="nails">Nails</option>
                                    <option value="designs">Designs</option>
                                </select>
                                {savingCatId === img.id && (
                                    <span className="text-neutral-500">Saving…</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button className="btn btn-ghost" onClick={() => setEditing(img)}>
                                    Edit
                                </button>
                                <button className="btn btn-ghost" onClick={() => remove(img)}>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <EditImageModal image={editing} onClose={() => setEditing(null)} />
            )}
        </section>
    );
}


/* ===================== Edit Image Modal ===================== */

function EditImageModal({ image, onClose }) {
    const [category, setCategory] = useState(image.category || "general");
    const [caption, setCaption] = useState(image.caption || "");
    const [featured, setFeatured] = useState(image.featured ?? false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    async function save() {
        setSaving(true);
        setErr("");
        try {
            await updateDoc(doc(db, "images", image.id), {
                category,
                caption,
                featured,
                updatedAt: serverTimestamp(),
            });
            onClose();
        } catch (e) {
            console.error(e);
            setErr("Couldn't save. Try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-soft w-full max-w-md p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Edit Image</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100"
                        aria-label="Close"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {/* Preview */}
                <div className="aspect-[4/3] bg-neutral-100 rounded-xl overflow-hidden">
                    <img
                        src={image.url}
                        alt={image.caption || ""}
                        className="w-full h-full object-contain p-1"
                    />
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select
                        className="border rounded-lg px-3 py-2 w-full"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="general">General</option>
                        <option value="nails">Nails</option>
                        <option value="designs">Designs</option>
                    </select>
                </div>

                {/* Caption */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Caption <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <input
                        className="border rounded-lg px-3 py-2 w-full"
                        placeholder="e.g. Swarovski full set"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                    />
                </div>

                {/* Featured */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={featured}
                        onChange={(e) => setFeatured(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <div>
                        <span className="text-sm font-medium">Featured</span>
                        <p className="text-xs text-neutral-500">Shown first in the home gallery</p>
                    </div>
                </label>

                {err && <p className="text-sm text-red-600">{err}</p>}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={save} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ===================== Signature Looks Editor ===================== */

function SignatureLooksEditor() {
    const [looks, setLooks] = useState([]);
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [file, setFile] = useState(null);
    const [picked, setPicked] = useState(null);
    const [showLib, setShowLib] = useState(false);
    const [uploadPct, setUploadPct] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "signatureLooks"), orderBy("order", "asc"), orderBy("createdAt", "asc"));
        return onSnapshot(q, (snap) => setLooks(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    }, []);

    function nextOrder() {
        if (!looks.length) return 1;
        return Math.max(...looks.map((l) => l.order ?? 0)) + 1;
    }

    async function addLook(e) {
        e.preventDefault();
        if (!title.trim()) return alert("Title is required");
        if (!file && !picked) return alert("Pick an image");

        setBusy(true);
        try {
            let imgUrl, path, name, size, source;

            if (file) {
                const p = `signature/${Date.now()}_${file.name}`;
                const r = ref(storage, p);
                const task = uploadBytesResumable(r, file);

                await new Promise((resolve, reject) => {
                    task.on(
                        "state_changed",
                        (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                        reject,
                        resolve
                    );
                });

                imgUrl = await getDownloadURL(task.snapshot.ref);
                path = p;
                name = file.name.toLowerCase();
                size = file.size;
                source = "upload";
            } else if (picked) {
                imgUrl = picked.url;
                path = picked.path || null;
                name = picked.name || "";
                size = picked.size || 0;
                source = "library";
            }

            await addDoc(collection(db, "signatureLooks"), {
                title: title.trim(),
                desc: desc.trim(),
                imgUrl,
                path,
                name,
                size,
                source,
                order: nextOrder(),
                enabled: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setTitle(""); setDesc(""); setFile(null); setPicked(null);
        } finally {
            setBusy(false);
            setUploadPct(null);
        }
    }

    async function move(id, dir) {
        // dir: -1 up, +1 down
        const idx = looks.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= looks.length) return;

        const a = looks[idx], b = looks[swapIdx];
        await Promise.all([
            updateDoc(doc(db, "signatureLooks", a.id), { order: (b.order ?? 0), updatedAt: serverTimestamp() }),
            updateDoc(doc(db, "signatureLooks", b.id), { order: (a.order ?? 0), updatedAt: serverTimestamp() }),
        ]);
    }

    async function removeLook(look) {
        const ok = confirm("Delete this card?");
        if (!ok) return;
        try {
            await deleteDoc(doc(db, "signatureLooks", look.id));
            if (look.path) await deleteObject(ref(storage, look.path)).catch(() => { });
        } catch (e) {
            console.error(e);
            alert("Couldn’t delete.");
        }
    }

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-4">
            <h2 className="font-semibold">Signature Looks</h2>

            {/* Add new */}
            <form className="grid md:grid-cols-3 gap-3 items-start" onSubmit={addLook}>
                <div className="md:col-span-2 grid gap-3">
                    <input
                        className="border rounded-lg px-3 py-2 w-full"
                        placeholder="Title (e.g., Swarovski/Diamonds)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <input
                        className="border rounded-lg px-3 py-2 w-full"
                        placeholder="Description"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                        <button type="button" className="btn btn-ghost" onClick={() => setShowLib(true)}>
                            Choose from Library
                        </button>
                        {picked && <img src={picked.url} alt="" className="h-12 rounded" />}
                    </div>
                    {uploadPct != null && <ProgressBar value={uploadPct} />}
                </div>
                <div className="md:pl-3">
                    <button className="btn btn-primary w-full md:w-auto" disabled={busy}>
                        {busy ? (uploadPct != null ? `Uploading ${uploadPct}%…` : "Adding…") : "Add Card"}
                    </button>
                </div>
            </form>

            {/* List / edit */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {looks.map((l, i) => (
                    <LookCardEditor
                        key={l.id}
                        look={l}
                        index={i}
                        total={looks.length}
                        onMoveUp={() => move(l.id, -1)}
                        onMoveDown={() => move(l.id, +1)}
                        onDelete={() => removeLook(l)}
                    />
                ))}
            </div>

            <MediaLibraryModal open={showLib} onClose={() => setShowLib(false)} onSelect={setPicked} />
        </section>
    );
}

function LookCardEditor({ look, index, total, onMoveUp, onMoveDown, onDelete }) {
    const [title, setTitle] = useState(look.title || "");
    const [desc, setDesc] = useState(look.desc || "");
    const [enabled, setEnabled] = useState(look.enabled !== false);

    const [file, setFile] = useState(null);
    const [picked, setPicked] = useState(null);
    const [showLib, setShowLib] = useState(false);
    const [uploadPct, setUploadPct] = useState(null);
    const [busy, setBusy] = useState(false);
    const [deleteOld, setDeleteOld] = useState(true);

    useEffect(() => {
        setTitle(look.title || "");
        setDesc(look.desc || "");
        setEnabled(look.enabled !== false);
        setFile(null); setPicked(null); setUploadPct(null);
    }, [look.id]);

    async function save() {
        setBusy(true);
        try {
            let imgUrl = look.imgUrl, path = look.path, name = look.name, size = look.size, source = look.source;

            if (file || picked) {
                if (file) {
                    const p = `signature/${Date.now()}_${file.name}`;
                    const r = ref(storage, p);
                    const task = uploadBytesResumable(r, file);
                    await new Promise((resolve, reject) => {
                        task.on(
                            "state_changed",
                            (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                            reject,
                            resolve
                        );
                    });
                    imgUrl = await getDownloadURL(task.snapshot.ref);
                    path = p; name = file.name.toLowerCase(); size = file.size; source = "upload";
                } else if (picked) {
                    imgUrl = picked.url; path = picked.path || null; name = picked.name || name; size = picked.size || size; source = "library";
                }
                if (deleteOld && look.path && look.path !== path) {
                    await deleteObject(ref(storage, look.path)).catch(() => { });
                }
            }

            await updateDoc(doc(db, "signatureLooks", look.id), {
                title: title.trim(),
                desc: desc.trim(),
                imgUrl,
                path,
                name,
                size,
                source,
                enabled,
                updatedAt: serverTimestamp(),
            });
        } finally {
            setBusy(false);
            setUploadPct(null);
        }
    }

    return (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-soft">
            <div className="relative aspect-[16/9] bg-neutral-100">
                <img src={file ? URL.createObjectURL(file) : picked?.url || look.imgUrl}
                    alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>

            <div className="p-3 space-y-2 text-sm">
                <input className="w-full border rounded-lg px-3 py-2"
                    value={title} onChange={(e) => setTitle(e.target.value)} />
                <input className="w-full border rounded-lg px-3 py-2"
                    value={desc} onChange={(e) => setDesc(e.target.value)} />

                <div className="flex flex-wrap items-center gap-2">
                    <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    <button type="button" className="btn btn-ghost" onClick={() => setShowLib(true)}>Choose from Library</button>
                    {(file || picked) && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={deleteOld} onChange={(e) => setDeleteOld(e.target.checked)} />
                            <span>Delete old file</span>
                        </label>
                    )}
                </div>

                {uploadPct != null && <ProgressBar value={uploadPct} />}

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button className="btn btn-ghost" onClick={onMoveUp} disabled={index === 0}>↑</button>
                        <button className="btn btn-ghost" onClick={onMoveDown} disabled={index === total - 1}>↓</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                            <span>Visible</span>
                        </label>
                        <button className="btn btn-ghost" onClick={onDelete}>Delete</button>
                        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                    </div>
                </div>
            </div>

            <MediaLibraryModal open={showLib} onClose={() => setShowLib(false)} onSelect={setPicked} />
        </div>
    );
}

/* ===================== Technicians Manager ===================== */


function slugify(s = "") {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .replace(/(^_|_$)/g, "")
        .trim();
}

function TechniciansManager() {
    const [techs, setTechs] = useState([]);
    const [adding, setAdding] = useState(false);
    const [newTech, setNewTech] = useState({
        id: "",
        name: "",
        role: "Nail Artist",
        bio: "",
        instagram: "",
        facebook: "",
        tiktok: "",
        email: "/contact",
        tags: "",
    });

    useEffect(() => {
        const q = query(collection(db, "technicians"), orderBy("name", "asc"));
        return onSnapshot(q, (snap) =>
            setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
    }, []);

    async function addTech(e) {
        e.preventDefault();
        if (!newTech.name.trim()) return alert("Name is required");
        const id = newTech.id.trim() || slugify(newTech.name);
        setAdding(true);
        try {
            await setDoc(doc(db, "technicians", id), {
                name: newTech.name.trim(),
                role: newTech.role.trim(),
                bio: newTech.bio.trim(),
                tags: newTech.tags
                    ? newTech.tags.split(",").map(t => t.trim()).filter(Boolean)
                    : [],
                avatarUrl: "", // will set after upload
                socials: {
                    instagram: newTech.instagram || "",
                    facebook: newTech.facebook || "",
                    tiktok: newTech.tiktok || "",
                    email: newTech.email || "/contact",
                },
                squareStaffId: "",
                gallery: [],
                enabled: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            }, { merge: true });

            setNewTech({
                id: "",
                name: "",
                role: "Nail Artist",
                bio: "",
                instagram: "",
                facebook: "",
                tiktok: "",
                email: "/contact",
                tags: "",
            });
        } finally {
            setAdding(false);
        }
    }

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-4">
            <h2 className="font-semibold">Technicians</h2>

            {/* Create new */}
            <form className="grid md:grid-cols-3 gap-3 items-start" onSubmit={addTech}>
                <div className="grid gap-3 md:col-span-2">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <input className="border rounded-lg px-3 py-2" placeholder="Tech ID (optional)"
                            value={newTech.id}
                            onChange={(e) => setNewTech(t => ({ ...t, id: e.target.value }))} />
                        <input className="border rounded-lg px-3 py-2" placeholder="Name *"
                            value={newTech.name}
                            onChange={(e) => setNewTech(t => ({ ...t, name: e.target.value }))} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <input className="border rounded-lg px-3 py-2" placeholder="Role"
                            value={newTech.role}
                            onChange={(e) => setNewTech(t => ({ ...t, role: e.target.value }))} />
                        <input className="border rounded-lg px-3 py-2" placeholder="Tags (comma separated)"
                            value={newTech.tags}
                            onChange={(e) => setNewTech(t => ({ ...t, tags: e.target.value }))} />
                    </div>
                    <textarea className="border rounded-lg px-3 py-2" placeholder="Bio"
                        value={newTech.bio}
                        onChange={(e) => setNewTech(t => ({ ...t, bio: e.target.value }))} />
                    <div className="grid sm:grid-cols-4 gap-3">
                        <input className="border rounded-lg px-3 py-2" placeholder="Instagram URL"
                            value={newTech.instagram}
                            onChange={(e) => setNewTech(t => ({ ...t, instagram: e.target.value }))} />
                        <input className="border rounded-lg px-3 py-2" placeholder="Facebook URL"
                            value={newTech.facebook}
                            onChange={(e) => setNewTech(t => ({ ...t, facebook: e.target.value }))} />
                        <input className="border rounded-lg px-3 py-2" placeholder="TikTok URL"
                            value={newTech.tiktok}
                            onChange={(e) => setNewTech(t => ({ ...t, tiktok: e.target.value }))} />
                        <input className="border rounded-lg px-3 py-2" placeholder="Email or /contact"
                            value={newTech.email}
                            onChange={(e) => setNewTech(t => ({ ...t, email: e.target.value }))} />
                    </div>
                </div>
                <div className="md:pl-3">
                    <button className="btn btn-primary w-full md:w-auto" disabled={adding}>
                        {adding ? "Adding…" : "Add Technician"}
                    </button>
                </div>
            </form>

            {/* List / edit */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {techs.map(t => <TechEditorCard key={t.id} tech={t} />)}
            </div>
        </section>
    );
}

function TechEditorCard({ tech }) {
    const [name, setName] = useState(tech.name || "");
    const [role, setRole] = useState(tech.role || "");
    const [bio, setBio] = useState(tech.bio || "");
    const [enabled, setEnabled] = useState(tech.enabled !== false);
    const [tags, setTags] = useState(tech.tags?.join(", ") || "");
    const [socials, setSocials] = useState({
        instagram: tech.socials?.instagram || "",
        facebook: tech.socials?.facebook || "",
        tiktok: tech.socials?.tiktok || "",
        email: tech.socials?.email || "/contact",
    });
    const [staffId, setStaffId] = useState(tech.squareStaffId || "");
    const [avatarFile, setAvatarFile] = useState(null);
    const [uploadPct, setUploadPct] = useState(null);
    const [saving, setSaving] = useState(false);
    const [addingImg, setAddingImg] = useState(false);
    const [galleryFile, setGalleryFile] = useState(null);
    const [galleryPct, setGalleryPct] = useState(null);

    useEffect(() => {
        setName(tech.name || "");
        setRole(tech.role || "");
        setBio(tech.bio || "");
        setEnabled(tech.enabled !== false);
        setTags(tech.tags?.join(", ") || "");
        setSocials({
            instagram: tech.socials?.instagram || "",
            facebook: tech.socials?.facebook || "",
            tiktok: tech.socials?.tiktok || "",
            email: tech.socials?.email || "/contact",
        });
        setStaffId(tech.squareStaffId || "");
        setAvatarFile(null);
        setUploadPct(null);
    }, [tech.id]);

    async function save() {
        setSaving(true);
        try {
            let avatarUrl = tech.avatarUrl || "";

            if (avatarFile) {
                const ext = avatarFile.name.split(".").pop();
                const p = `avatars/${tech.id}_${Date.now()}.${ext}`;
                const r = ref(storage, p);
                const task = uploadBytesResumable(r, avatarFile);
                await new Promise((resolve, reject) => {
                    task.on(
                        "state_changed",
                        (s) => setUploadPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
                        reject,
                        resolve
                    );
                });
                avatarUrl = await getDownloadURL(task.snapshot.ref);
            }

            await updateDoc(doc(db, "technicians", tech.id), {
                name: name.trim(),
                role: role.trim(),
                bio: bio.trim(),
                tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
                socials,
                squareStaffId: staffId.trim(),
                avatarUrl,
                enabled,
                updatedAt: serverTimestamp(),
            });
        } finally {
            setSaving(false);
            setUploadPct(null);
            setAvatarFile(null);
        }
    }

    async function remove() {
        if (!confirm(`Delete ${tech.name}?`)) return;
        await deleteDoc(doc(db, "technicians", tech.id));
    }

    // Add a photo to gallery[] (array of URLs)
    async function addToGallery(e) {
        e.preventDefault();
        if (!galleryFile) return;
        setAddingImg(true);
        try {
            const _ext = galleryFile.name.split(".").pop();
            const p = `portfolios/${tech.id}/${Date.now()}_${galleryFile.name}`;
            const r = ref(storage, p);
            const task = uploadBytesResumable(r, galleryFile);
            await new Promise((resolve, reject) => {
                task.on(
                    "state_changed",
                    (s) => setGalleryPct(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
                    reject,
                    resolve
                );
            });
            const url = await getDownloadURL(task.snapshot.ref);
            await updateDoc(doc(db, "technicians", tech.id), {
                gallery: arrayUnion(url),
                updatedAt: serverTimestamp(),
            });
            setGalleryFile(null);
        } finally {
            setAddingImg(false);
            setGalleryPct(null);
        }
    }

    async function removeFromGallery(url) {
        if (!confirm("Remove image from gallery?")) return;
        await updateDoc(doc(db, "technicians", tech.id), {
            gallery: arrayRemove(url),
            updatedAt: serverTimestamp(),
        });
    }

    return (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-soft">
            {/* Avatar */}
            <div className="relative aspect-[4/3] bg-neutral-100">
                <img
                    src={avatarFile ? URL.createObjectURL(avatarFile) : tech.avatarUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                />
            </div>

            <div className="p-4 space-y-3 text-sm">
                <div className="grid sm:grid-cols-2 gap-2">
                    <input className="border rounded-lg px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
                <textarea className="border rounded-lg px-3 py-2" value={bio} onChange={(e) => setBio(e.target.value)} />
                <input className="border rounded-lg px-3 py-2" placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />

                {/* Socials */}
                <div className="grid sm:grid-cols-2 gap-2">
                    <input className="border rounded-lg px-3 py-2" placeholder="Instagram URL"
                        value={socials.instagram} onChange={(e) => setSocials(s => ({ ...s, instagram: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2" placeholder="Facebook URL"
                        value={socials.facebook} onChange={(e) => setSocials(s => ({ ...s, facebook: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2" placeholder="TikTok URL"
                        value={socials.tiktok} onChange={(e) => setSocials(s => ({ ...s, tiktok: e.target.value }))} />
                    <input className="border rounded-lg px-3 py-2" placeholder="Email or /contact"
                        value={socials.email} onChange={(e) => setSocials(s => ({ ...s, email: e.target.value }))} />
                </div>

                {/* Square staff id */}
                <input className="border rounded-lg px-3 py-2" placeholder="Square staff ID (optional)"
                    value={staffId} onChange={(e) => setStaffId(e.target.value)} />

                {/* Avatar upload */}
                <div className="flex flex-wrap items-center gap-3">
                    <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                    {uploadPct != null && <ProgressBar value={uploadPct} />}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                        <span>Visible</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <button className="btn btn-ghost" onClick={remove}>Delete</button>
                        <button className="btn btn-primary" onClick={save} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>

                {/* Gallery quick add */}
                <div className="mt-3 border-t pt-3">
                    <h4 className="font-medium mb-2">Portfolio</h4>
                    <form className="flex flex-wrap items-center gap-3" onSubmit={addToGallery}>
                        <input type="file" accept="image/*" onChange={(e) => setGalleryFile(e.target.files?.[0] || null)} />
                        <button className="btn btn-ghost" disabled={!galleryFile || addingImg}>
                            {addingImg ? (galleryPct != null ? `Uploading ${galleryPct}%…` : "Adding…") : "Add to Gallery"}
                        </button>
                    </form>
                    {galleryPct != null && <ProgressBar value={galleryPct} />}

                    {Array.isArray(tech.gallery) && tech.gallery.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                            {tech.gallery.map((u, i) => (
                                <div key={i} className="relative">
                                    <img src={u} alt="" className="aspect-square w-full object-cover rounded-lg" />
                                    <button type="button" onClick={() => removeFromGallery(u)}
                                        className="absolute top-1 right-1 text-xs bg-white/90 rounded px-2 py-1">
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ===================== Business Hours Editor ===================== */

function BusinessHoursEditor() {
    const settings = useSiteSettings();
    const slotSize = settings?.slotSizeMin ?? SLOT_MIN;

    const [dflt, setDflt] = useState({ startMin: 480, endMin: 1200 });
    const [byDay, setByDay] = useState(() =>
        Object.fromEntries(DAYS.map(d => [d, { closed: false, startMin: 480, endMin: 1200 }]))
    );
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (settings === undefined) return; // still loading
        const h = settings?.hours;
        if (!h) return;
        if (h.default) setDflt(h.default);
        const merged = {};
        DAYS.forEach(d => {
            const o = h.byDay?.[d];
            if (o === null) {
                merged[d] = { closed: true, startMin: h.default?.startMin ?? 480, endMin: h.default?.endMin ?? 1200 };
            } else if (o) {
                merged[d] = { closed: false, startMin: o.startMin, endMin: o.endMin };
            } else {
                merged[d] = { closed: false, startMin: h.default?.startMin ?? 480, endMin: h.default?.endMin ?? 1200 };
            }
        });
        setByDay(merged);
    }, [settings]);

    function setDayField(day, field, value) {
        setByDay(b => ({ ...b, [day]: { ...b[day], [field]: value } }));
    }

    function validate() {
        if (dflt.endMin <= dflt.startMin) return "Default: close time must be after open time";
        if (dflt.startMin % slotSize !== 0 || dflt.endMin % slotSize !== 0)
            return `Default: times must be multiples of ${slotSize} min`;
        for (const d of DAYS) {
            const row = byDay[d];
            if (row.closed) continue;
            if (row.endMin <= row.startMin) return `${DAY_LABELS[DAYS.indexOf(d)]}: close must be after open`;
            if (row.startMin % slotSize !== 0 || row.endMin % slotSize !== 0)
                return `${DAY_LABELS[DAYS.indexOf(d)]}: times must be multiples of ${slotSize} min`;
        }
        return null;
    }

    async function save() {
        const e = validate();
        if (e) { setErr(e); return; }
        setErr(null);
        setSaving(true);
        try {
            const byDayData = {};
            DAYS.forEach(d => {
                const row = byDay[d];
                byDayData[d] = row.closed ? null : { startMin: row.startMin, endMin: row.endMin };
            });
            await setDoc(doc(db, "site", "settings"), {
                hours: { default: dflt, byDay: byDayData },
                updatedAt: serverTimestamp(),
            }, { merge: true });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-4">
            <h2 className="font-semibold">Business Hours</h2>

            {/* Default hours */}
            <div>
                <p className="text-xs text-neutral-500 mb-2">Default hours (applies to any day not overridden below)</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="w-24 font-medium">Default</span>
                    <input
                        type="time" step={slotSize * 60}
                        value={minToTimeInput(dflt.startMin)}
                        onChange={e => setDflt(d => ({ ...d, startMin: timeInputToMin(e.target.value) }))}
                        className="border rounded-lg px-2 py-1"
                    />
                    <span className="text-neutral-400">to</span>
                    <input
                        type="time" step={slotSize * 60}
                        value={minToTimeInput(dflt.endMin)}
                        onChange={e => setDflt(d => ({ ...d, endMin: timeInputToMin(e.target.value) }))}
                        className="border rounded-lg px-2 py-1"
                    />
                </div>
            </div>

            {/* Per-day overrides */}
            <div className="space-y-2">
                {DAYS.map((day, i) => {
                    const row = byDay[day];
                    return (
                        <div key={day} className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="w-24">{DAY_LABELS[i]}</span>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={row.closed}
                                    onChange={e => setDayField(day, "closed", e.target.checked)}
                                />
                                <span className="text-neutral-500">Closed</span>
                            </label>
                            {!row.closed && (
                                <>
                                    <input
                                        type="time" step={slotSize * 60}
                                        value={minToTimeInput(row.startMin)}
                                        onChange={e => setDayField(day, "startMin", timeInputToMin(e.target.value))}
                                        className="border rounded-lg px-2 py-1"
                                    />
                                    <span className="text-neutral-400">to</span>
                                    <input
                                        type="time" step={slotSize * 60}
                                        value={minToTimeInput(row.endMin)}
                                        onChange={e => setDayField(day, "endMin", timeInputToMin(e.target.value))}
                                        className="border rounded-lg px-2 py-1"
                                    />
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex items-center gap-3">
                <button className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save Hours"}
                </button>
                {saved && <span className="text-sm text-green-600">Saved!</span>}
            </div>
        </section>
    );
}

/* ===================== Schedule Tab ===================== */

function ScheduleTab() {
    const settings = useSiteSettings();
    const slotSize = settings?.slotSizeMin ?? SLOT_MIN;

    const [selDate, setSelDate]   = useState(adminTodayStr());
    const [techs,   setTechs]     = useState([]);
    const [availMap, setAvailMap] = useState({});       // techId → availability data
    const [blocked, setBlocked]   = useState(new Set()); // Set of blocked techIds (or "all")
    const [locks,   setLocks]     = useState({});        // "techId_startMin" → bookingId
    const [loading, setLoading]   = useState(false);
    const [saving,  setSaving]    = useState(false);
    const [saved,   setSaved]     = useState(false);

    // Load active technicians once
    useEffect(() => {
        getDocs(query(collection(db, "technicians"), where("active", "==", true)))
            .then(snap => setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    // Reload availability, blocked days, and slot locks when date changes
    useEffect(() => {
        if (!selDate) return;
        setLoading(true);
        setAvailMap({});
        setBlocked(new Set());
        setLocks({});
        Promise.all([
            getDocs(query(collection(db, "availability"), where("date", "==", selDate))),
            getDocs(query(collection(db, "blockedDays"),  where("date", "==", selDate))),
            getDocs(query(collection(db, "slotLocks"),    where("date", "==", selDate))),
        ]).then(([availSnap, blockSnap, lockSnap]) => {
            const am = {};
            availSnap.docs.forEach(d => { am[d.data().techId] = d.data(); });
            setAvailMap(am);

            const bs = new Set();
            blockSnap.docs.forEach(d => bs.add(d.data().techId));
            setBlocked(bs);

            const lm = {};
            lockSnap.docs.forEach(d => {
                const { techId, startMin, bookingId } = d.data();
                lm[`${techId}_${startMin}`] = bookingId;
            });
            setLocks(lm);
        }).finally(() => setLoading(false));
    }, [selDate]);

    const hours    = selDate ? hoursForDay(settings?.hours, selDate) : undefined;
    const isClosed = hours === null;
    const daySlots = hours ? genSlots(hours.startMin, hours.endMin, slotSize) : [];

    function toggleSlot(techId, slotMin) {
        if (locks[`${techId}_${slotMin}`]) return; // booked — cannot toggle
        setAvailMap(prev => {
            const current = prev[techId]?.slots ?? [];
            const has = current.includes(slotMin);
            return {
                ...prev,
                [techId]: {
                    ...(prev[techId] ?? {}),
                    techId,
                    slots: has
                        ? current.filter(s => s !== slotMin)
                        : [...current, slotMin].sort((a, b) => a - b),
                },
            };
        });
    }

    async function saveDay() {
        if (!selDate) return;
        setSaving(true);
        try {
            await Promise.all(techs.map(tech => {
                const slots = availMap[tech.id]?.slots ?? [];
                if (slots.length > 0) {
                    return setDoc(doc(db, "availability", `${tech.id}_${selDate}`), {
                        techId:      tech.id,
                        techName:    tech.name,
                        date:        selDate,
                        timezone:    "America/Phoenix",
                        slotSizeMin: slotSize,
                        slots,
                        updatedAt:   serverTimestamp(),
                    }, { merge: false });
                } else {
                    return deleteDoc(doc(db, "availability", `${tech.id}_${selDate}`)).catch(() => {});
                }
            }));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-4">
            <h2 className="font-semibold">Schedule</h2>

            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="date"
                    value={selDate}
                    min={adminTodayStr()}
                    onChange={e => setSelDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm"
                />
                {isClosed && (
                    <span className="text-sm text-neutral-500 italic">Closed (per Business Hours)</span>
                )}
            </div>

            {loading && <p className="text-sm text-neutral-400">Loading…</p>}

            {!loading && selDate && !isClosed && hours && (
                <>
                    {techs.length === 0 ? (
                        <p className="text-sm text-neutral-400">No active technicians.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="text-xs border-collapse">
                                <thead>
                                    <tr>
                                        <th className="text-left px-2 py-1 font-medium text-sm min-w-[6rem]">Tech</th>
                                        {daySlots.map(s => (
                                            <th key={s} className="px-0.5 py-1 font-normal text-neutral-400 text-center whitespace-nowrap">
                                                {minToTimeString(s)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {techs.map(tech => {
                                        const isBlocked = blocked.has("all") || blocked.has(tech.id);
                                        const slots = availMap[tech.id]?.slots ?? [];
                                        return (
                                            <tr key={tech.id} className="border-t border-neutral-100">
                                                <td className="px-2 py-1 font-medium whitespace-nowrap">{tech.name}</td>
                                                {isBlocked ? (
                                                    <td colSpan={daySlots.length} className="px-2 py-1 text-neutral-400 italic text-center">
                                                        Day blocked
                                                    </td>
                                                ) : daySlots.map(s => {
                                                    const isAvail  = slots.includes(s);
                                                    const isLocked = !!locks[`${tech.id}_${s}`];
                                                    return (
                                                        <td key={s} className="px-0.5 py-0.5">
                                                            <button
                                                                onClick={() => toggleSlot(tech.id, s)}
                                                                disabled={isLocked}
                                                                title={
                                                                    isLocked ? "Booked — cancel booking to free this slot"
                                                                    : isAvail ? "Open — click to close"
                                                                    : "Closed — click to open"
                                                                }
                                                                className={[
                                                                    "w-10 h-7 rounded text-xs font-medium transition",
                                                                    isLocked  ? "bg-red-100 text-red-600 cursor-not-allowed"
                                                                    : isAvail ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                                                                    :           "bg-neutral-100 text-neutral-300 hover:bg-neutral-200 cursor-pointer",
                                                                ].join(" ")}
                                                            >
                                                                {isLocked ? "🔒" : isAvail ? "✓" : ""}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                        <button className="btn btn-primary" onClick={saveDay} disabled={saving}>
                            {saving ? "Saving…" : "Save Day"}
                        </button>
                        {saved && <span className="text-sm text-green-600">Saved!</span>}
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-4 h-4 rounded bg-green-100" /> Available
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-4 h-4 rounded bg-neutral-100" /> Closed
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-4 h-4 rounded bg-red-100" /> Booked
                            </span>
                        </div>
                    </div>
                </>
            )}

            {!loading && selDate && !isClosed && !hours && settings !== undefined && (
                <p className="text-sm text-neutral-400">Set business hours above to enable the schedule grid.</p>
            )}
        </section>
    );
}

/* ===================== Bookings Tab ===================== */

const cancelBookingFn = httpsCallable(functions, "cancelBooking");

function dateStrPlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function BookingsTab() {
    const [bookings,  setBookings]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [techs,     setTechs]     = useState([]);
    const [filterTech,   setFilterTech]   = useState("all");
    const [filterStatus, setFilterStatus] = useState("confirmed");
    const [search,    setSearch]    = useState("");
    const [dateFrom,  setDateFrom]  = useState(adminTodayStr());
    const [dateTo,    setDateTo]    = useState(dateStrPlus(30));
    const [cancelling, setCancelling] = useState(null); // bookingId being cancelled

    // Load technician list for filter dropdown
    useEffect(() => {
        getDocs(query(collection(db, "technicians"), orderBy("name", "asc")))
            .then(snap => setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    // Load bookings whenever filters change
    useEffect(() => {
        setLoading(true);
        let q = query(
            collection(db, "bookings"),
            where("date", ">=", dateFrom),
            where("date", "<=", dateTo),
            orderBy("date", "asc"),
            orderBy("startMin", "asc")
        );
        getDocs(q)
            .then(snap => {
                setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            })
            .catch(err => {
                console.error("Failed to load bookings:", err);
                setBookings([]);
            })
            .finally(() => setLoading(false));
    }, [dateFrom, dateTo]);

    async function handleCancel(booking) {
        if (!confirm(`Cancel booking for ${booking.name} on ${booking.date} at ${minToTimeString(booking.startMin)}?`)) return;
        setCancelling(booking.id);
        try {
            await cancelBookingFn({ bookingId: booking.id });
            // Refresh list
            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "cancelled" } : b));
        } catch (err) {
            console.error("Cancel failed:", err);
            alert("Failed to cancel: " + (err.message || "Unknown error"));
        } finally {
            setCancelling(null);
        }
    }

    // Client-side filters: techId, status, search
    const q = search.toLowerCase();
    const visible = bookings.filter(b => {
        if (filterTech !== "all" && b.techId !== filterTech) return false;
        if (filterStatus !== "all" && b.status !== filterStatus) return false;
        if (q) {
            const hay = `${b.name} ${b.email || ""} ${b.phone || ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });

    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-4">
            <h2 className="font-semibold">Bookings</h2>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 text-sm">
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Technician</label>
                    <select
                        value={filterTech}
                        onChange={e => setFilterTech(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    >
                        <option value="all">All techs</option>
                        {techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-500">Status</label>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    >
                        <option value="all">All</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[12rem]">
                    <label className="text-xs text-neutral-500">Search name / email / phone</label>
                    <input
                        type="text"
                        placeholder="Search…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="border rounded-lg px-3 py-2"
                    />
                </div>
            </div>

            {loading && <p className="text-sm text-neutral-400">Loading…</p>}

            {!loading && visible.length === 0 && (
                <p className="text-sm text-neutral-400">No bookings found.</p>
            )}

            {!loading && visible.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                                <th className="py-2 pr-4 font-medium">Date</th>
                                <th className="py-2 pr-4 font-medium">Time</th>
                                <th className="py-2 pr-4 font-medium">Tech</th>
                                <th className="py-2 pr-4 font-medium">Service</th>
                                <th className="py-2 pr-4 font-medium">Client</th>
                                <th className="py-2 pr-4 font-medium">Contact</th>
                                <th className="py-2 pr-4 font-medium">Notes</th>
                                <th className="py-2 pr-4 font-medium">Status</th>
                                <th className="py-2 font-medium" />
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(b => (
                                <tr key={b.id} className={[
                                    "border-t border-neutral-100 align-top",
                                    b.status === "cancelled" ? "opacity-50" : "",
                                ].join(" ")}>
                                    <td className="py-2 pr-4 whitespace-nowrap">{b.date}</td>
                                    <td className="py-2 pr-4 whitespace-nowrap">
                                        {minToTimeString(b.startMin)}
                                        <span className="text-neutral-400 text-xs ml-1">({b.durationMin}m)</span>
                                    </td>
                                    <td className="py-2 pr-4 whitespace-nowrap">{b.techName || b.techId}</td>
                                    <td className="py-2 pr-4">{b.serviceName}</td>
                                    <td className="py-2 pr-4 whitespace-nowrap">{b.name}</td>
                                    <td className="py-2 pr-4 text-xs whitespace-nowrap">
                                        {b.email && <div>{b.email}</div>}
                                        {b.phone && <div>{b.phone}</div>}
                                    </td>
                                    <td className="py-2 pr-4 text-xs max-w-[10rem] break-words">{b.notes || "—"}</td>
                                    <td className="py-2 pr-4 whitespace-nowrap">
                                        <span className={[
                                            "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                                            b.status === "confirmed"
                                                ? "bg-green-100 text-green-700"
                                                : "bg-neutral-100 text-neutral-500",
                                        ].join(" ")}>
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="py-2">
                                        {b.status === "confirmed" && (
                                            <button
                                                className="btn btn-ghost text-xs text-red-600 hover:bg-red-50"
                                                onClick={() => handleCancel(b)}
                                                disabled={cancelling === b.id}
                                            >
                                                {cancelling === b.id ? "Cancelling…" : "Cancel"}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="text-xs text-neutral-400 mt-2">{visible.length} booking{visible.length !== 1 ? "s" : ""}</p>
                </div>
            )}
        </section>
    );
}
