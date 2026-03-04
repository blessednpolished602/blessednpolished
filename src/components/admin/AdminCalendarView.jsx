// src/components/admin/AdminCalendarView.jsx
import { useEffect, useState } from "react";
import {
    collection, getDocs, query, where,
    setDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../lib/firebase";
import { minToTimeString } from "../../lib/timeUtils";
import useSiteSettings from "../../hooks/useSiteSettings";

// ── Constants & helpers ────────────────────────────────────────────────────────

const DAYS_KEY    = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DOW_SHORT   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_NARROW  = ["S",   "M",   "T",   "W",   "T",   "F",   "S"  ];
const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
];
const SLOT_MIN = 30;

function pad(n) { return String(n).padStart(2, "0"); }

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/**
 * null      → explicitly closed
 * undefined → not configured / no default set
 * {startMin,endMin} → open
 */
function hoursForDay(hours, dateStr) {
    if (!hours || !dateStr) return undefined;
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dow      = DAYS_KEY[new Date(y, mo - 1, d).getDay()];
    const override = hours.byDay?.[dow];
    if (override === null)      return null;
    if (override !== undefined) return override;
    return hours.default ?? undefined;
}

function genSlots(startMin, endMin, slotSize = SLOT_MIN) {
    const out = [];
    for (let m = startMin; m < endMin; m += slotSize) out.push(m);
    return out;
}

function chipCls(active) {
    return [
        "px-2.5 py-1 rounded-full text-xs font-medium transition",
        active ? "bg-black text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
    ].join(" ");
}

const cancelFn = httpsCallable(functions, "cancelBooking");

// ── MobileBottomSheet ─────────────────────────────────────────────────────────

function MobileBottomSheet({ onClose, children }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                aria-hidden="true"
                className={[
                    "absolute inset-0 bg-black/40 transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0",
                ].join(" ")}
                onClick={onClose}
            />
            {/* Sheet */}
            <div
                className={[
                    "absolute bottom-0 inset-x-0 bg-white rounded-t-2xl",
                    "max-h-[85vh] overflow-y-auto p-4 space-y-3 shadow-2xl",
                    "transition-transform duration-300",
                    visible ? "translate-y-0" : "translate-y-full",
                ].join(" ")}
            >
                {children}
            </div>
        </div>
    );
}

// ── DrawerContent ─────────────────────────────────────────────────────────────

function DrawerContent({
    selDate, onClose, autoFocusClose,
    drawerTech, setDrawerTech, techs, drawerTechs,
    isDayClosed, daySlots, dayLocks,
    isBlockedForDrawer, handleBlockToggle,
    localAvail, toggleSlot,
    dayLoading, dayBooks, monthBlocked,
    saving, saved, saveDay,
    handleCancel, cancelling,
}) {
    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{selDate}</p>
                <button
                    onClick={onClose}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={autoFocusClose}
                    className="w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100 text-neutral-500"
                    aria-label="Close drawer"
                >✕</button>
            </div>

            {/* Tech filter chips */}
            <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setDrawerTech("all")} className={chipCls(drawerTech === "all")}>
                    All
                </button>
                {techs.map(t => (
                    <button key={t.id} onClick={() => setDrawerTech(t.id)} className={chipCls(drawerTech === t.id)}>
                        {t.name}
                    </button>
                ))}
            </div>

            {isDayClosed ? (
                <p className="text-sm text-neutral-400 italic">Closed (per Business Hours)</p>
            ) : (
                <>
                    {/* Block toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                        <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={isBlockedForDrawer}
                            onChange={handleBlockToggle}
                        />
                        <span>
                            {drawerTech === "all"
                                ? "Block entire day (all techs)"
                                : `Block day for ${techs.find(t => t.id === drawerTech)?.name ?? drawerTech}`}
                        </span>
                    </label>

                    {dayLoading && <p className="text-xs text-neutral-400">Loading…</p>}

                    {!dayLoading && drawerTechs.map(tech => {
                        const isTechBlocked = monthBlocked.has(`all_${selDate}`) ||
                            monthBlocked.has(`${tech.id}_${selDate}`);
                        const techSlots      = localAvail[tech.id] ?? [];
                        const confirmedBooks = dayBooks.filter(
                            b => b.techId === tech.id && b.status === "confirmed"
                        );

                        return (
                            <div key={tech.id} className="border-t pt-3 space-y-2">
                                <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                                    {tech.name}
                                </p>

                                {isTechBlocked ? (
                                    <p className="text-xs text-neutral-400 italic">Day blocked</p>
                                ) : daySlots.length === 0 ? (
                                    <p className="text-xs text-neutral-400">
                                        Set business hours to enable scheduling.
                                    </p>
                                ) : (
                                    /* 2-col on mobile, 3-col on sm, flex-wrap on lg+ */
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-1">
                                        {daySlots.map(s => {
                                            const isAvail  = techSlots.includes(s);
                                            const isLocked = dayLocks.has(`${tech.id}_${s}`);
                                            return (
                                                <button
                                                    key={s}
                                                    onClick={() => toggleSlot(tech.id, s)}
                                                    disabled={isLocked}
                                                    title={
                                                        isLocked  ? "Booked — cancel to free slot"
                                                        : isAvail ? "Open — click to close"
                                                        :           "Closed — click to open"
                                                    }
                                                    className={[
                                                        "min-h-[44px] rounded text-xs font-mono transition",
                                                        "flex items-center justify-center px-1.5",
                                                        isLocked  ? "bg-red-100 text-red-600 cursor-not-allowed"
                                                        : isAvail ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                                                        :           "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 cursor-pointer",
                                                    ].join(" ")}
                                                >
                                                    {isLocked ? "🔒 " : ""}{minToTimeString(s)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Confirmed bookings — stacked cards */}
                                {confirmedBooks.length > 0 && (
                                    <div className="space-y-1.5">
                                        {confirmedBooks.map(b => (
                                            <div
                                                key={b.id}
                                                className="rounded-lg bg-neutral-50 px-3 py-2 text-xs flex items-start gap-2"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium">
                                                        {minToTimeString(b.startMin)} · {b.name}
                                                    </div>
                                                    {b.serviceName && (
                                                        <div className="text-neutral-400 truncate">{b.serviceName}</div>
                                                    )}
                                                    {(b.email || b.phone) && (
                                                        <div className="text-neutral-400">{b.email || b.phone}</div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleCancel(b)}
                                                    disabled={cancelling === b.id}
                                                    className="text-red-500 hover:text-red-700 flex-shrink-0 font-medium"
                                                    title="Cancel booking"
                                                >
                                                    {cancelling === b.id ? "…" : "✕"}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Save button */}
                    {!dayLoading && !monthBlocked.has(`all_${selDate}`) && daySlots.length > 0 && (
                        <div className="flex items-center gap-3 border-t pt-3">
                            <button className="btn btn-primary" onClick={saveDay} disabled={saving}>
                                {saving ? "Saving…" : "Save Day"}
                            </button>
                            {saved && <span className="text-xs text-green-600">Saved!</span>}
                        </div>
                    )}
                </>
            )}
        </>
    );
}

// ── AdminCalendarView ─────────────────────────────────────────────────────────

export default function AdminCalendarView() {
    const settings = useSiteSettings();
    const slotSize = settings?.slotSizeMin ?? SLOT_MIN;

    const now = new Date();
    const [viewYear,  setViewYear]  = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

    const [techs, setTechs] = useState([]);

    // Month-level data (fetched once per month view)
    const [monthAvail,   setMonthAvail]   = useState({}); // "techId_date" → slots[]
    const [monthBlocked, setMonthBlocked] = useState(new Set()); // "techId_date" | "all_date"
    const [monthLocks,   setMonthLocks]   = useState({}); // date → Set("techId_startMin")
    const [monthLoading, setMonthLoading] = useState(false);

    // Drawer state
    const [selDate,    setSelDate]    = useState(null);
    const [drawerTech, setDrawerTech] = useState("all");
    const [dayBooks,   setDayBooks]   = useState([]);
    const [dayLoading, setDayLoading] = useState(false);
    const [localAvail, setLocalAvail] = useState({}); // techId → slots[] (local edits)
    const [saving,     setSaving]     = useState(false);
    const [saved,      setSaved]      = useState(false);
    const [cancelling, setCancelling] = useState(null);

    // ── Load technicians once ─────────────────────────────────────────────────
    useEffect(() => {
        getDocs(collection(db, "technicians")).then(snap =>
            setTechs(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(t => t.enabled !== false)
                    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
            )
        );
    }, []);

    // ── Load month data (availability + blockedDays + slotLocks) ─────────────
    useEffect(() => {
        const daysInM = new Date(viewYear, viewMonth + 1, 0).getDate();
        const first = fmtDate(viewYear, viewMonth, 1);
        const last  = fmtDate(viewYear, viewMonth, daysInM);

        setMonthLoading(true);
        Promise.all([
            getDocs(query(collection(db, "availability"),
                where("date", ">=", first), where("date", "<=", last))),
            getDocs(query(collection(db, "blockedDays"),
                where("date", ">=", first), where("date", "<=", last))),
            getDocs(query(collection(db, "slotLocks"),
                where("date", ">=", first), where("date", "<=", last))),
        ]).then(([availSnap, blockSnap, lockSnap]) => {
            const am = {};
            availSnap.docs.forEach(d => {
                const { techId, date, slots } = d.data();
                am[`${techId}_${date}`] = slots ?? [];
            });
            setMonthAvail(am);

            const bs = new Set();
            blockSnap.docs.forEach(d => {
                const { techId, date } = d.data();
                bs.add(`${techId}_${date}`);
            });
            setMonthBlocked(bs);

            const lm = {};
            lockSnap.docs.forEach(d => {
                const { techId, date, startMin } = d.data();
                if (!lm[date]) lm[date] = new Set();
                lm[date].add(`${techId}_${startMin}`);
            });
            setMonthLocks(lm);
        }).finally(() => setMonthLoading(false));
    }, [viewYear, viewMonth]);

    // ── Load bookings for selected day ────────────────────────────────────────
    useEffect(() => {
        if (!selDate) return;
        setDayLoading(true);
        getDocs(query(collection(db, "bookings"), where("date", "==", selDate)))
            .then(snap => setDayBooks(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
            .catch(() => setDayBooks([]))
            .finally(() => setDayLoading(false));
    }, [selDate]);

    // ── Sync localAvail when date / month data / techs change ─────────────────
    useEffect(() => {
        if (!selDate || techs.length === 0) return;
        const la = {};
        techs.forEach(t => { la[t.id] = [...(monthAvail[`${t.id}_${selDate}`] ?? [])]; });
        setLocalAvail(la);
        setSaved(false);
    }, [selDate, monthAvail, techs]);

    // ── Month navigation ──────────────────────────────────────────────────────
    function prevMonth() {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    }

    // ── Day status dot ────────────────────────────────────────────────────────
    function getDayStatus(ds) {
        if (ds < todayStr()) return "past";
        if (settings !== undefined && settings?.hours) {
            const h = hoursForDay(settings.hours, ds);
            if (h === null) return "closed";
        }
        if (monthBlocked.has(`all_${ds}`)) return "blocked";
        const dl = monthLocks[ds] ?? new Set();
        let hasAvail = false, hasOpen = false;
        for (const t of techs) {
            if (monthBlocked.has(`${t.id}_${ds}`)) continue;
            const slots = monthAvail[`${t.id}_${ds}`];
            if (!slots || slots.length === 0) continue;
            hasAvail = true;
            for (const s of slots) {
                if (!dl.has(`${t.id}_${s}`)) { hasOpen = true; break; }
            }
            if (hasOpen) break;
        }
        if (!hasAvail) return "gray";
        return hasOpen ? "green" : "red";
    }

    // ── Slot toggle ───────────────────────────────────────────────────────────
    function toggleSlot(techId, slotMin) {
        const dl = monthLocks[selDate] ?? new Set();
        if (dl.has(`${techId}_${slotMin}`)) return;
        setSaved(false);
        setLocalAvail(prev => {
            const cur = prev[techId] ?? [];
            const has = cur.includes(slotMin);
            return {
                ...prev,
                [techId]: has
                    ? cur.filter(s => s !== slotMin)
                    : [...cur, slotMin].sort((a, b) => a - b),
            };
        });
    }

    // ── Save day availability ─────────────────────────────────────────────────
    async function saveDay() {
        if (!selDate) return;
        setSaving(true);
        const techList = drawerTech === "all" ? techs : techs.filter(t => t.id === drawerTech);
        try {
            await Promise.all(techList.map(tech => {
                const slots = localAvail[tech.id] ?? [];
                return slots.length > 0
                    ? setDoc(doc(db, "availability", `${tech.id}_${selDate}`), {
                        techId: tech.id, techName: tech.name,
                        date: selDate, timezone: "America/Phoenix",
                        slotSizeMin: slotSize, slots,
                        updatedAt: serverTimestamp(),
                    }, { merge: false })
                    : deleteDoc(doc(db, "availability", `${tech.id}_${selDate}`)).catch(() => {});
            }));

            // Optimistically update month map
            setMonthAvail(prev => {
                const next = { ...prev };
                techList.forEach(tech => {
                    const slots = localAvail[tech.id] ?? [];
                    const k = `${tech.id}_${selDate}`;
                    if (slots.length > 0) next[k] = slots;
                    else delete next[k];
                });
                return next;
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally {
            setSaving(false);
        }
    }

    // ── Block / unblock day ───────────────────────────────────────────────────
    async function handleBlockToggle() {
        if (!selDate) return;
        const key      = drawerTech === "all" ? "all" : drawerTech;
        const blockKey = `${key}_${selDate}`;
        const isBlocked = monthBlocked.has(blockKey);
        try {
            if (isBlocked) {
                await deleteDoc(doc(db, "blockedDays", blockKey));
                setMonthBlocked(prev => { const n = new Set(prev); n.delete(blockKey); return n; });
            } else {
                await setDoc(doc(db, "blockedDays", blockKey), {
                    techId: key, date: selDate, createdAt: serverTimestamp(),
                });
                setMonthBlocked(prev => new Set([...prev, blockKey]));
            }
        } catch (err) {
            alert("Failed to toggle block: " + (err.message || err));
        }
    }

    // ── Cancel booking ────────────────────────────────────────────────────────
    async function handleCancel(booking) {
        if (!confirm(`Cancel booking for ${booking.name} at ${minToTimeString(booking.startMin)}?`)) return;
        setCancelling(booking.id);
        try {
            await cancelFn({ bookingId: booking.id });
            setDayBooks(prev =>
                prev.map(b => b.id === booking.id ? { ...b, status: "cancelled" } : b)
            );
            // Refresh slot locks for this day
            const lockSnap = await getDocs(
                query(collection(db, "slotLocks"), where("date", "==", selDate))
            );
            const fresh = new Set();
            lockSnap.docs.forEach(d => {
                const { techId, startMin } = d.data();
                fresh.add(`${techId}_${startMin}`);
            });
            setMonthLocks(prev => ({ ...prev, [selDate]: fresh }));
        } catch (err) {
            alert("Failed to cancel: " + (err.message || "Unknown error"));
        } finally {
            setCancelling(null);
        }
    }

    // ── Derived values ────────────────────────────────────────────────────────
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDow    = new Date(viewYear, viewMonth, 1).getDay();

    const rawDayHours    = selDate && settings?.hours ? hoursForDay(settings.hours, selDate) : undefined;
    const isDayClosed    = rawDayHours === null;
    const daySlots       = rawDayHours ? genSlots(rawDayHours.startMin, rawDayHours.endMin, slotSize) : [];
    const dayLocks       = selDate ? (monthLocks[selDate] ?? new Set()) : new Set();
    const drawerTechs    = drawerTech === "all" ? techs : techs.filter(t => t.id === drawerTech);
    const isBlockedForDrawer = !!selDate && (
        monthBlocked.has(`all_${selDate}`) ||
        (drawerTech !== "all" && monthBlocked.has(`${drawerTech}_${selDate}`))
    );

    const DOT_COLOR = {
        past: "bg-neutral-200", closed: "bg-neutral-200",
        blocked: "bg-neutral-200", gray: "bg-neutral-200",
        green: "bg-green-400", red: "bg-red-400",
    };

    // Shared props passed to both desktop and mobile drawer instances
    const drawerProps = {
        selDate, onClose: () => setSelDate(null),
        drawerTech, setDrawerTech, techs, drawerTechs,
        isDayClosed, daySlots, dayLocks,
        isBlockedForDrawer, handleBlockToggle,
        localAvail, toggleSlot,
        dayLoading, dayBooks, monthBlocked,
        saving, saved, saveDay,
        handleCancel, cancelling,
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <section className="bg-white border rounded-2xl p-4 shadow-soft space-y-4">
            <h2 className="font-semibold">Calendar View</h2>

            <div className="lg:flex lg:gap-6 lg:items-start">

                {/* ── Month calendar ── */}
                <div className="min-w-0 lg:flex-1">

                    {/* Navigation */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            className="btn btn-ghost px-2 py-1 text-xl leading-none"
                            onClick={prevMonth}
                            aria-label="Previous month"
                        >‹</button>
                        <h3 className="font-semibold text-sm sm:text-base">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </h3>
                        <button
                            className="btn btn-ghost px-2 py-1 text-xl leading-none"
                            onClick={nextMonth}
                            aria-label="Next month"
                        >›</button>
                    </div>

                    {monthLoading ? (
                        <p className="text-sm text-neutral-400 py-10 text-center">Loading…</p>
                    ) : (
                        <div className="grid grid-cols-7 gap-px bg-neutral-100 rounded-xl overflow-hidden border border-neutral-100">
                            {/* Day-of-week headers */}
                            {DOW_SHORT.map((d, i) => (
                                <div key={i} className="bg-white text-center text-xs font-medium text-neutral-400 py-2">
                                    <span className="hidden sm:inline">{d}</span>
                                    <span className="sm:hidden">{DOW_NARROW[i]}</span>
                                </div>
                            ))}

                            {/* Leading empty cells */}
                            {Array.from({ length: firstDow }, (_, i) => (
                                <div key={`pad-${i}`} className="bg-white aspect-square" />
                            ))}

                            {/* Date cells — aspect-square ensures ≥44px tap target at any viewport */}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                                const day    = i + 1;
                                const ds     = fmtDate(viewYear, viewMonth, day);
                                const status = getDayStatus(ds);
                                const isPast = status === "past";
                                const isSel  = ds === selDate;

                                return (
                                    <button
                                        key={ds}
                                        onClick={() => {
                                            if (!isPast) { setSelDate(ds); setDrawerTech("all"); }
                                        }}
                                        disabled={isPast}
                                        className={[
                                            "bg-white aspect-square flex flex-col items-center justify-center gap-0.5",
                                            "transition focus:outline-none",
                                            isPast ? "opacity-40 cursor-default" : "hover:bg-neutral-50 cursor-pointer",
                                            isSel  ? "ring-2 ring-inset ring-black" : "",
                                        ].join(" ")}
                                    >
                                        <span className={`text-xs sm:text-sm leading-none ${isSel ? "font-bold" : ""}`}>
                                            {day}
                                        </span>
                                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${DOT_COLOR[status] ?? "bg-neutral-200"}`} />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-neutral-500">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-400" /> Open
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400" /> Fully booked
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-neutral-200" /> Unavailable
                        </span>
                    </div>
                </div>

                {/* ── Desktop drawer — static right panel (lg+) ── */}
                {selDate && (
                    <div className="hidden lg:block w-[420px] flex-shrink-0 border rounded-xl p-4 space-y-3 max-h-[80vh] overflow-y-auto">
                        <DrawerContent {...drawerProps} autoFocusClose={false} />
                    </div>
                )}
            </div>

            {/* ── Mobile bottom-sheet drawer (< lg) ── */}
            {selDate && (
                <MobileBottomSheet onClose={() => setSelDate(null)}>
                    <DrawerContent {...drawerProps} autoFocusClose={true} />
                </MobileBottomSheet>
            )}
        </section>
    );
}
