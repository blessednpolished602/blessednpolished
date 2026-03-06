// src/pages/AvailabilityPage.jsx
// PUBLIC availability calendar — reads only: site/settings, technicians,
// availability, blockedDays. Booking via createBooking callable only.
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { minToTimeString } from "../lib/timeUtils";
import useSiteSettings from "../hooks/useSiteSettings";

// ── Constants & helpers ────────────────────────────────────────────────────────

const DAYS_KEY   = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DOW_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_NARROW = ["S",   "M",   "T",   "W",   "T",   "F",   "S"  ];
const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
];

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(y, mo, d) { return `${y}-${pad(mo + 1)}-${pad(d)}`; }
function todayStr() {
    const d = new Date();
    return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
}

function hoursForDay(hours, dateStr) {
    if (!hours || !dateStr) return undefined;
    const [y, mo, d] = dateStr.split("-").map(Number);
    const dow      = DAYS_KEY[new Date(y, mo - 1, d).getDay()];
    const override = hours.byDay?.[dow];
    if (override === null)      return null;
    if (override !== undefined) return override;
    return hours.default ?? undefined;
}

function chipCls(active) {
    return [
        "px-2.5 py-1 rounded-full text-xs font-medium transition",
        active ? "bg-black text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
    ].join(" ");
}

const createBookingFn = httpsCallable(functions, "createBooking");

// ── MobileBottomSheet ─────────────────────────────────────────────────────────

function MobileBottomSheet({ onClose, children }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div
                aria-hidden="true"
                className={[
                    "absolute inset-0 bg-black/40 transition-opacity duration-300",
                    visible ? "opacity-100" : "opacity-0",
                ].join(" ")}
                onClick={onClose}
            />
            <div
                className={[
                    "absolute bottom-0 inset-x-0 bg-white rounded-t-2xl",
                    "max-h-[85vh] overflow-y-auto p-4 space-y-4 shadow-2xl",
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
    drawerTech, setDrawerTech, techs,
    slotsForDrawer, isDayClosed, isBlocked,
    services, refreshDayAvail,
    onBookingSuccess,
}) {
    const [bookStep,    setBookStep]    = useState("slots"); // "slots" | "form"
    const [selSlot,     setSelSlot]     = useState(null);
    const [selService,  setSelService]  = useState(null);
    const [client,      setClient]      = useState({ name: "", email: "", phone: "", notes: "" });
    const [honeypot,    setHoneypot]    = useState("");
    const [submitting,  setSubmitting]  = useState(false);
    const [error,       setError]       = useState(null);

    // Reset to slot picker when the date changes
    useEffect(() => {
        setBookStep("slots");
        setSelSlot(null);
        setSelService(null);
        setClient({ name: "", email: "", phone: "", notes: "" });
        setError(null);
    }, [selDate]);

    function handleSelectSlot(s) {
        setSelSlot(s);
        setBookStep("form");
        setError(null);
    }

    function handleChangeSlot() {
        setSelSlot(null);
        setBookStep("slots");
        setError(null);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (honeypot) return;
        if (!selSlot || !selService) return;

        const techId   = drawerTech === "all" ? "any" : drawerTech;
        const techName = drawerTech !== "all"
            ? (techs.find(t => t.id === drawerTech)?.name ?? drawerTech)
            : "Any available";

        setError(null);
        setSubmitting(true);
        try {
            const result = await createBookingFn({
                techId,
                date: selDate,
                startMin: selSlot,
                serviceId: selService.id,
                serviceName: selService.name,
                durationMin: selService.durationMin || 60,
                client: {
                    name:  client.name.trim(),
                    email: client.email.trim()  || undefined,
                    phone: client.phone.trim()  || undefined,
                    notes: client.notes.trim()  || undefined,
                },
            });
            onBookingSuccess({
                bookingId:  result.data.bookingId,
                techName:   result.data.techName || techName,
                date:       selDate,
                startMin:   selSlot,
                service:    selService,
                client,
            });
        } catch (err) {
            const code = err?.code ?? "";
            const msg  = err?.message ?? "";
            if (
                code === "functions/aborted" ||
                msg  === "SLOT_TAKEN" ||
                code.includes("failed-precondition")
            ) {
                setError("That time was just taken. Pick another.");
                setSelSlot(null);
                setBookStep("slots");
                refreshDayAvail(selDate);
            } else if (code === "functions/not-found" || msg === "NO_AVAILABILITY") {
                setError("No availability for that day.");
                setBookStep("slots");
                refreshDayAvail(selDate);
            } else {
                setError(err?.message || "Something went wrong. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    }

    const fmtDateDisplay = selDate
        ? new Date(selDate + "T00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })
        : "";

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{fmtDateDisplay}</p>
                <button
                    onClick={onClose}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={autoFocusClose}
                    className="w-8 h-8 grid place-items-center rounded-full hover:bg-neutral-100 text-neutral-500"
                    aria-label="Close"
                >✕</button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            {isDayClosed ? (
                <p className="text-sm text-neutral-400 italic">Closed today</p>
            ) : isBlocked ? (
                <p className="text-sm text-neutral-400 italic">Not available today</p>
            ) : bookStep === "slots" ? (
                <>
                    {/* Tech filter chips */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setDrawerTech("all")}
                            className={chipCls(drawerTech === "all")}
                        >All</button>
                        {techs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setDrawerTech(t.id)}
                                className={chipCls(drawerTech === t.id)}
                            >{t.name}</button>
                        ))}
                    </div>

                    {/* Time slots */}
                    {slotsForDrawer.length === 0 ? (
                        <p className="text-sm text-neutral-400">No available times for this day.</p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-1.5">
                            {slotsForDrawer.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleSelectSlot(s)}
                                    className="min-h-[44px] rounded-xl border border-neutral-200 text-sm font-medium hover:border-black/40 hover:bg-neutral-50 transition px-2"
                                >
                                    {minToTimeString(s)}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* ── Booking form ── */
                <form onSubmit={handleSubmit} className="space-y-3">

                    {/* Selected time badge + change link */}
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-black text-white text-xs px-3 py-1 font-medium">
                            {minToTimeString(selSlot)}
                        </span>
                        <button
                            type="button"
                            onClick={handleChangeSlot}
                            className="text-xs text-neutral-500 underline"
                        >Change</button>
                    </div>

                    {/* Service picker */}
                    <div>
                        <p className="text-xs font-medium text-neutral-700 mb-1.5">Service</p>
                        {services === null ? (
                            <p className="text-xs text-neutral-400">Loading…</p>
                        ) : (
                            <div className="grid gap-1.5">
                                {services.map(svc => (
                                    <button
                                        key={svc.id}
                                        type="button"
                                        onClick={() => setSelService(svc)}
                                        className={[
                                            "text-left rounded-xl border px-3 py-2 text-sm transition",
                                            selService?.id === svc.id
                                                ? "border-black bg-neutral-50 font-medium"
                                                : "border-neutral-200 hover:border-black/30",
                                        ].join(" ")}
                                    >
                                        <div className="flex justify-between items-center gap-2">
                                            <span>{svc.name}</span>
                                            {svc.price && (
                                                <span className="text-xs text-neutral-500 shrink-0">{svc.price}</span>
                                            )}
                                        </div>
                                        {svc.durationMin && (
                                            <p className="text-xs text-neutral-400 mt-0.5">{svc.durationMin} min</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Honeypot — hidden from real users */}
                    <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        aria-hidden="true"
                        autoComplete="off"
                        className="sr-only"
                        value={honeypot}
                        onChange={e => setHoneypot(e.target.value)}
                    />

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={200}
                            value={client.name}
                            onChange={e => setClient(c => ({ ...c, name: e.target.value }))}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition"
                            placeholder="Your name"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
                        <input
                            type="email"
                            maxLength={200}
                            value={client.email}
                            onChange={e => setClient(c => ({ ...c, email: e.target.value }))}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition"
                            placeholder="your@email.com"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                            Phone{" "}
                            <span className="text-neutral-400 font-normal">(email or phone required)</span>
                        </label>
                        <input
                            type="tel"
                            maxLength={30}
                            value={client.phone}
                            onChange={e => setClient(c => ({ ...c, phone: e.target.value }))}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition"
                            placeholder="623-555-0100"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
                        <textarea
                            rows={2}
                            maxLength={500}
                            value={client.notes}
                            onChange={e => setClient(c => ({ ...c, notes: e.target.value }))}
                            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition resize-none"
                            placeholder="Design ideas, color preferences, reference links…"
                        />
                    </div>

                    {client.name.trim() && !client.email.trim() && !client.phone.trim() && (
                        <p className="text-xs text-red-500">Please provide at least an email or phone.</p>
                    )}

                    <button
                        type="submit"
                        disabled={
                            submitting ||
                            !selService ||
                            !client.name.trim() ||
                            (!client.email.trim() && !client.phone.trim())
                        }
                        className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Booking…" : "Confirm Booking"}
                    </button>
                </form>
            )}
        </>
    );
}

// ── AvailabilityPage ──────────────────────────────────────────────────────────

export default function AvailabilityPage() {
    const settings = useSiteSettings();

    const now = new Date();
    const [viewYear,  setViewYear]  = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());

    const [techs,        setTechs]        = useState([]);
    const [services,     setServices]     = useState(null);
    const [monthAvail,   setMonthAvail]   = useState({}); // "techId_date" → slots[]
    const [monthBlocked, setMonthBlocked] = useState(new Set()); // "techId_date" | "all_date"
    const [monthLoading, setMonthLoading] = useState(false);

    const [selDate,       setSelDate]       = useState(null);
    const [drawerTech,    setDrawerTech]    = useState("all");
    const [bookingResult, setBookingResult] = useState(null);

    // ── Load techs + services once ─────────────────────────────────────────────
    useEffect(() => {
        getDocs(collection(db, "technicians")).then(snap =>
            setTechs(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(t => t.enabled !== false)
                    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
            )
        );

        getDocs(collection(db, "signatureLooks"))
            .then(snap =>
                setServices(
                    snap.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                )
            )
            .catch(() => setServices([]));
    }, []);

    // ── Load month availability + blocked days ─────────────────────────────────
    useEffect(() => {
        const daysInM = new Date(viewYear, viewMonth + 1, 0).getDate();
        const first   = fmtDate(viewYear, viewMonth, 1);
        const last    = fmtDate(viewYear, viewMonth, daysInM);

        setMonthLoading(true);
        Promise.all([
            getDocs(query(collection(db, "availability"),
                where("date", ">=", first), where("date", "<=", last))),
            getDocs(query(collection(db, "blockedDays"),
                where("date", ">=", first), where("date", "<=", last))),
        ]).then(([availSnap, blockSnap]) => {
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
        }).finally(() => setMonthLoading(false));
    }, [viewYear, viewMonth]);

    // ── Refresh single day after SLOT_TAKEN ───────────────────────────────────
    async function refreshDayAvail(date) {
        try {
            const snap = await getDocs(
                query(collection(db, "availability"), where("date", "==", date))
            );
            setMonthAvail(prev => {
                const next = { ...prev };
                // Remove stale entries for this date
                for (const key of Object.keys(next)) {
                    if (key.endsWith(`_${date}`)) delete next[key];
                }
                snap.docs.forEach(d => {
                    const { techId, date: ds, slots } = d.data();
                    next[`${techId}_${ds}`] = slots ?? [];
                });
                return next;
            });
        } catch { /* silently ignore — stale data is OK */ }
    }

    // ── Month navigation ──────────────────────────────────────────────────────
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    function prevMonth() {
        if (isCurrentMonth) return;
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
        if (settings?.hours) {
            const h = hoursForDay(settings.hours, ds);
            if (h === null) return "closed";
        }
        if (monthBlocked.has(`all_${ds}`)) return "blocked";

        for (const key of Object.keys(monthAvail)) {
            if (!key.endsWith(`_${ds}`)) continue;
            const techId = key.slice(0, -(ds.length + 1));
            if (monthBlocked.has(`${techId}_${ds}`)) continue;
            if ((monthAvail[key] ?? []).length > 0) return "green";
        }
        return "gray";
    }

    // ── Slots for selected day / tech ─────────────────────────────────────────
    const slotsForDrawer = (() => {
        if (!selDate) return [];
        const hours = settings?.hours ? hoursForDay(settings.hours, selDate) : undefined;

        let raw;
        if (drawerTech === "all") {
            const union = new Set();
            for (const tech of techs) {
                if (monthBlocked.has(`${tech.id}_${selDate}`)) continue;
                (monthAvail[`${tech.id}_${selDate}`] ?? []).forEach(s => union.add(s));
            }
            raw = [...union].sort((a, b) => a - b);
        } else {
            raw = monthBlocked.has(`${drawerTech}_${selDate}`)
                ? []
                : [...(monthAvail[`${drawerTech}_${selDate}`] ?? [])].sort((a, b) => a - b);
        }

        // Trim to business hours window
        if (hours?.startMin !== undefined) {
            raw = raw.filter(s => s >= hours.startMin && s < hours.endMin);
        }
        return raw;
    })();

    // ── Derived ───────────────────────────────────────────────────────────────
    const isDayClosed  = !!selDate && settings?.hours && hoursForDay(settings.hours, selDate) === null;
    const isBlocked    = !!selDate && monthBlocked.has(`all_${selDate}`);
    const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDow     = new Date(viewYear, viewMonth, 1).getDay();

    const DOT_COLOR = {
        past: "bg-neutral-200", closed: "bg-neutral-200",
        blocked: "bg-neutral-200", gray: "bg-neutral-200",
        green: "bg-green-400",
    };

    function closeDrawer() {
        setSelDate(null);
        setDrawerTech("all");
    }

    const drawerProps = {
        selDate, onClose: closeDrawer,
        drawerTech, setDrawerTech, techs,
        slotsForDrawer, isDayClosed, isBlocked,
        services, refreshDayAvail,
        onBookingSuccess: setBookingResult,
    };

    // ── Success screen ────────────────────────────────────────────────────────
    if (bookingResult) {
        return (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
                <Helmet><title>Booking Confirmed | Blessed N Polished</title></Helmet>
                <div className="text-5xl mb-4">💅</div>
                <h1 className="text-2xl font-bold">You&rsquo;re booked!</h1>
                <p className="mt-2 text-neutral-600">Your appointment is confirmed. We&rsquo;ll see you soon.</p>
                <div className="mt-6 rounded-2xl border border-neutral-200 p-5 text-left space-y-2 text-sm">
                    <p><span className="font-medium">Service:</span> {bookingResult.service.name}</p>
                    <p><span className="font-medium">With:</span> {bookingResult.techName}</p>
                    <p><span className="font-medium">Date:</span> {bookingResult.date}</p>
                    <p><span className="font-medium">Time:</span> {minToTimeString(bookingResult.startMin)}</p>
                    <p><span className="font-medium">Duration:</span> {bookingResult.service.durationMin || 60} min</p>
                    {bookingResult.client.email && (
                        <p><span className="font-medium">Email:</span> {bookingResult.client.email}</p>
                    )}
                </div>
                <p className="mt-3 text-xs text-neutral-400">Booking ID: {bookingResult.bookingId}</p>
                <button
                    onClick={() => { setBookingResult(null); closeDrawer(); }}
                    className="mt-6 btn btn-ghost"
                >
                    Book another
                </button>
            </div>
        );
    }

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <Helmet>
                <title>Availability | Blessed N Polished</title>
                <meta name="description" content="Check availability and book a nail appointment at Blessed N Polished in Buckeye, AZ." />
            </Helmet>

            <h1 className="text-3xl font-bold tracking-tight">Book an Appointment</h1>
            <p className="mt-1 text-sm text-neutral-500 mb-6">Select a date to see available times.</p>

            <div className="lg:flex lg:gap-6 lg:items-start">

                {/* ── Month calendar ── */}
                <div className="min-w-0 lg:flex-1 bg-white border rounded-2xl p-4 shadow-soft">

                    {/* Navigation */}
                    <div className="flex items-center justify-between mb-3">
                        <button
                            onClick={prevMonth}
                            disabled={isCurrentMonth}
                            className="btn btn-ghost px-2 py-1 text-xl leading-none disabled:opacity-30"
                            aria-label="Previous month"
                        >‹</button>
                        <h2 className="font-semibold text-sm sm:text-base">
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </h2>
                        <button
                            onClick={nextMonth}
                            className="btn btn-ghost px-2 py-1 text-xl leading-none"
                            aria-label="Next month"
                        >›</button>
                    </div>

                    {monthLoading ? (
                        <p className="text-sm text-neutral-400 py-10 text-center">Loading…</p>
                    ) : (
                        <div className="grid grid-cols-7 gap-px bg-neutral-100 rounded-xl overflow-hidden border border-neutral-100">

                            {/* DOW headers */}
                            {DOW_SHORT.map((d, i) => (
                                <div key={i} className="bg-white text-center text-xs font-medium text-neutral-400 py-2">
                                    <span className="hidden sm:inline">{d}</span>
                                    <span className="sm:hidden">{DOW_NARROW[i]}</span>
                                </div>
                            ))}

                            {/* Leading padding */}
                            {Array.from({ length: firstDow }, (_, i) => (
                                <div key={`pad-${i}`} className="bg-white aspect-square" />
                            ))}

                            {/* Day cells */}
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
                            <span className="w-2 h-2 rounded-full bg-green-400" /> Available
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-neutral-200" /> Unavailable
                        </span>
                    </div>
                </div>

                {/* ── Desktop drawer — static right panel (lg+) ── */}
                {selDate && (
                    <div className="hidden lg:block w-[420px] flex-shrink-0 bg-white border rounded-2xl p-4 space-y-4 max-h-[80vh] overflow-y-auto shadow-soft">
                        <DrawerContent {...drawerProps} autoFocusClose={false} />
                    </div>
                )}
            </div>

            {/* ── Mobile bottom-sheet (< lg) ── */}
            {selDate && (
                <MobileBottomSheet onClose={closeDrawer}>
                    <DrawerContent {...drawerProps} autoFocusClose={true} />
                </MobileBottomSheet>
            )}
        </div>
    );
}
