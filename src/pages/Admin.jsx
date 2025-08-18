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
    updateDoc,
} from "firebase/firestore";

import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from "firebase/storage";

import useSiteSettings from "../hooks/useSiteSettings";
import MediaLibraryModal from "../components/MediaLibraryModal";
import { arrayUnion, arrayRemove } from "firebase/firestore";



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
            <SignatureLooksEditor />
            <TechniciansManager />
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
            const ext = galleryFile.name.split(".").pop();
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

