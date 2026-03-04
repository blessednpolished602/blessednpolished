// src/pages/BookingPage.jsx
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db, functions } from "../lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { trackEvent } from "../lib/analytics";
import { minToTimeString, lockedSlots } from "../lib/timeUtils";

// ── Module-level helpers ───────────────────────────────────────────────────────

const DAY_ABBR    = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const COOLDOWN_KEY = "bnp_booking_cooldown";
const COOLDOWN_MS  = 60_000;

function pad(n) { return String(n).padStart(2, "0"); }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr()   { return toDateStr(new Date()); }

/** Returns cells array: null = empty padding, number = day-of-month */
function buildCells(year, month) {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
}

/** True if slots contains at least one valid startMin for durationMin */
function hasValidStart(slots, durationMin) {
  const set = new Set(slots);
  return (slots || []).some(s => lockedSlots(s, durationMin).every(r => set.has(r)));
}

/**
 * From an array of availability data objects, return all startMin values where
 * at least one tech has every required consecutive slot.
 */
function getValidStarts(availDocs, durationMin) {
  const allMins = new Set(availDocs.flatMap(d => d.slots || []));
  return [...allMins]
    .filter(startMin => {
      const required = lockedSlots(startMin, durationMin);
      return availDocs.some(d => {
        const ts = new Set(d.slots || []);
        return required.every(s => ts.has(s));
      });
    })
    .sort((a, b) => a - b);
}

function canBookNow() {
  try {
    const ts = localStorage.getItem(COOLDOWN_KEY);
    return !ts || Date.now() - parseInt(ts, 10) > COOLDOWN_MS;
  } catch { return true; }
}

/**
 * Return { startMin, endMin } for the weekday of dateStr, or null if closed.
 * Uses hours.byDay[dow] if present, falls back to hours.default.
 */
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
function getHoursForDate(hours, dateStr) {
  if (!hours) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dow = DOW_KEYS[new Date(y, mo - 1, d).getDay()];
  const override = hours.byDay?.[dow];
  if (override === null) return null;           // explicitly closed
  return override ?? hours.default ?? null;     // custom | default | unset
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { techId: urlTechId } = useParams();

  // ── Flow state ─────────────────────────────────────────────────────────────
  const [step,          setStep]          = useState(1);
  const [service,       setService]       = useState(null);  // {id, name, durationMin, price}
  const [tech,          setTech]          = useState(null);  // {id, name}
  const [date,          setDate]          = useState(null);  // "YYYY-MM-DD"
  const [startMin,      setStartMin]      = useState(null);
  const [client,        setClient]        = useState({ name: "", email: "", phone: "", notes: "" });
  const [honeypot,      setHoneypot]      = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [siteSettings,  setSiteSettings]  = useState(null);

  // ── Fetch site settings (hours, timezone, etc.) ─────────────────────────────
  useEffect(() => {
    getDoc(doc(db, "site", "settings"))
      .then(d => { if (d.exists()) setSiteSettings(d.data()); })
      .catch(() => {});
  }, []);

  // ── Step 1: Services ────────────────────────────────────────────────────────
  const [services, setServices] = useState(null);
  useEffect(() => {
    getDocs(collection(db, "signatureLooks"))
      .then(snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        setServices(list);
      })
      .catch(() => setServices([]));
  }, []);

  // ── URL tech pre-load (/book/:techId skips Step 2) ─────────────────────────
  useEffect(() => {
    if (!urlTechId) return;
    getDoc(doc(db, "technicians", urlTechId))
      .then(d => { if (d.exists()) setTech({ id: d.id, name: d.data().name }); })
      .catch(() => {});
  }, [urlTechId]);

  // ── Step 2: Technicians ─────────────────────────────────────────────────────
  const [techs, setTechs] = useState(null);
  useEffect(() => {
    if (step !== 2 || techs !== null) return;
    getDocs(query(collection(db, "technicians"), where("active", "==", true)))
      .then(snap => setTechs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setTechs([]));
  }, [step, techs]);

  // ── Step 3: Availability + blocked days for current view month ─────────────
  const today = new Date();
  const [viewYear,   setViewYear]   = useState(today.getFullYear());
  const [viewMonth,  setViewMonth]  = useState(today.getMonth());
  const [availMap,   setAvailMap]   = useState(null); // { [docId]: data }
  const [blockedSet, setBlockedSet] = useState(null); // Set<docId>

  useEffect(() => {
    if (step !== 3) return;
    setAvailMap(null);
    setBlockedSet(null);

    const start = `${viewYear}-${pad(viewMonth + 1)}-01`;
    const end   = toDateStr(new Date(viewYear, viewMonth + 1, 0));

    Promise.all([
      getDocs(query(collection(db, "availability"), where("date", ">=", start), where("date", "<=", end))),
      getDocs(query(collection(db, "blockedDays"),  where("date", ">=", start), where("date", "<=", end))),
    ]).then(([availSnap, blockedSnap]) => {
      const am = {};
      availSnap.docs.forEach(d => { am[d.id] = d.data(); });
      setAvailMap(am);
      setBlockedSet(new Set(blockedSnap.docs.map(d => d.id)));
    }).catch(() => {
      setAvailMap({});
      setBlockedSet(new Set());
    });
  }, [step, viewYear, viewMonth]);

  function isDateEnabled(year, month, day) {
    const ds = `${year}-${pad(month + 1)}-${pad(day)}`;
    if (ds < todayStr() || !availMap || !blockedSet) return false;
    if (blockedSet.has(`all_${ds}`)) return false;

    // Disable days marked closed in business hours
    if (siteSettings?.hours && getHoursForDate(siteSettings.hours, ds) === null) return false;

    const dur = service?.durationMin || 60;

    if (tech?.id !== "any") {
      if (blockedSet.has(`${tech.id}_${ds}`)) return false;
      const avail = availMap[`${tech.id}_${ds}`];
      return avail ? hasValidStart(avail.slots || [], dur) : false;
    }

    // "Any available": at least one non-blocked tech has a valid start
    return Object.values(availMap).some(d =>
      d.date === ds &&
      !blockedSet.has(`${d.techId}_${ds}`) &&
      hasValidStart(d.slots || [], dur)
    );
  }

  function prevMonth() {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  // ── Step 4: Valid start times for selected date ─────────────────────────────
  const [timeSlots, setTimeSlots] = useState(null);
  useEffect(() => {
    if (step !== 4 || !date) return;
    setTimeSlots(null);
    getDocs(query(collection(db, "availability"), where("date", "==", date)))
      .then(snap => {
        const docs = snap.docs
          .map(d => d.data())
          .filter(d => tech?.id === "any" || d.techId === tech?.id);
        const dur = service?.durationMin || 60;
        let starts = getValidStarts(docs, dur);
        // Filter to within business hours for that weekday
        if (siteSettings?.hours && date) {
          const h = getHoursForDate(siteSettings.hours, date);
          if (h) starts = starts.filter(m => m >= h.startMin && m + dur <= h.endMin);
        }
        setTimeSlots(starts);
      })
      .catch(() => setTimeSlots([]));
  }, [step, date, tech, service, siteSettings]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (honeypot) return; // silent drop — bot detected
    if (!canBookNow()) { setError("Please wait a moment before submitting again."); return; }

    setError(null);
    setSubmitting(true);
    try {
      const createBooking = httpsCallable(functions, "createBooking");
      const result = await createBooking({
        techId:      tech.id,
        date,
        startMin,
        serviceId:   service.id,
        serviceName: service.name,
        durationMin: service.durationMin || 60,
        client: {
          name:  client.name.trim(),
          email: client.email.trim() || undefined,
          phone: client.phone.trim() || undefined,
          notes: client.notes.trim() || undefined,
        },
      });

      localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
      trackEvent("booking_confirmed", { service: service.name, tech: tech.name });
      setBookingResult(result.data);
    } catch (err) {
      const code = err?.code    ?? "";
      const msg  = err?.message ?? "";

      if (code === "functions/aborted" || msg === "SLOT_TAKEN") {
        setError("That time was just taken by another booking. Please pick a different slot.");
        setStep(4); setStartMin(null);
      } else if (code === "functions/not-found" && msg === "NO_AVAILABILITY") {
        setError("No availability for that selection. Please try another date.");
        setStep(3); setDate(null); setStartMin(null);
      } else if (code === "functions/resource-exhausted") {
        setError("All technicians are booked for that time. Please pick another slot.");
        setStep(4); setStartMin(null);
      } else if (code === "functions/failed-precondition") {
        setError("That day is no longer available. Please pick another date.");
        setStep(3); setDate(null); setStartMin(null);
      } else if (code === "functions/invalid-argument") {
        setError(msg || "Please check your information and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Back navigation ─────────────────────────────────────────────────────────
  function goBack() {
    setError(null);
    if      (step === 2) { setStep(1); }
    else if (step === 3) { setStep(urlTechId && tech ? 1 : 2); }
    else if (step === 4) { setStep(3); setDate(null); setStartMin(null); }
    else if (step === 5) { setStep(4); setStartMin(null); }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (bookingResult) {
    return (
      <main className="min-h-screen">
        <Helmet><title>Booking Confirmed | Blessed N Polished</title></Helmet>
        <section className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="text-5xl mb-4">💅</div>
          <h1 className="text-2xl font-bold">You&rsquo;re booked!</h1>
          <p className="mt-2 text-neutral-600">Your appointment is confirmed. We&rsquo;ll see you soon.</p>
          <div className="mt-6 rounded-2xl border border-neutral-200 p-5 text-left space-y-2 text-sm">
            <p><span className="font-medium">Service:</span> {service.name}</p>
            <p><span className="font-medium">With:</span> {bookingResult.techName}</p>
            <p><span className="font-medium">Date:</span> {date}</p>
            <p><span className="font-medium">Time:</span> {minToTimeString(startMin)}</p>
            <p><span className="font-medium">Duration:</span> {service.durationMin || 60} min</p>
            {client.email && <p><span className="font-medium">Email:</span> {client.email}</p>}
          </div>
          <p className="mt-3 text-xs text-neutral-400">Booking ID: {bookingResult.bookingId}</p>
          <Link to="/" className="mt-6 inline-block btn btn-ghost">Back to Home</Link>
        </section>
      </main>
    );
  }

  // ── Shared step progress bar ────────────────────────────────────────────────
  const STEP_LABELS = ["Service", "Technician", "Date", "Time", "Info"];

  return (
    <main className="min-h-screen">
      <Helmet>
        <title>Book an Appointment | Blessed N Polished</title>
        <meta name="description" content="Book a custom nail appointment at Blessed N Polished in Buckeye, AZ." />
      </Helmet>

      <section className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Book an Appointment</h1>
        <p className="mt-1 text-sm text-neutral-500">Pay in person at your visit.</p>

        {/* Progress bar */}
        <div className="mt-6 flex items-center">
          {STEP_LABELS.map((label, i) => {
            const n      = i + 1;
            const done   = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 shrink-0 ${active ? "text-black font-medium" : done ? "text-neutral-400" : "text-neutral-300"}`}>
                  <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${active ? "bg-black text-white" : done ? "bg-neutral-400 text-white" : "border border-neutral-200 text-neutral-300"}`}>
                    {done ? "✓" : n}
                  </span>
                  <span className="text-xs hidden sm:inline">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-neutral-200 mx-1.5" />}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6">

          {/* ── Step 1: Pick service ────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Choose a service</h2>
              {services === null ? (
                <p className="text-sm text-neutral-400">Loading…</p>
              ) : services.length === 0 ? (
                <p className="text-sm text-neutral-500">No services available right now.</p>
              ) : (
                <div className="grid gap-2">
                  {services.map(svc => (
                    <button
                      key={svc.id}
                      onClick={() => { setService(svc); setStep(urlTechId && tech ? 3 : 2); }}
                      className="text-left rounded-2xl border border-neutral-200 p-4 hover:border-black/30 hover:bg-neutral-50 transition"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-medium">{svc.name}</span>
                        {svc.price && <span className="text-sm text-neutral-500 shrink-0">{svc.price}</span>}
                      </div>
                      {(svc.durationMin || svc.description) && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {svc.durationMin && <span>{svc.durationMin} min</span>}
                          {svc.durationMin && svc.description && " · "}
                          {svc.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Pick technician ─────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Choose a technician</h2>
              <div className="grid gap-2">
                <button
                  onClick={() => { setTech({ id: "any", name: "Any available" }); setStep(3); }}
                  className="text-left rounded-2xl border border-neutral-200 p-4 hover:border-black/30 hover:bg-neutral-50 transition"
                >
                  <p className="font-medium">Any available</p>
                  <p className="text-xs text-neutral-500 mt-0.5">We&rsquo;ll assign the best match for your time</p>
                </button>

                {techs === null ? (
                  <p className="text-sm text-neutral-400 p-2">Loading technicians…</p>
                ) : techs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTech({ id: t.id, name: t.name }); setStep(3); }}
                    className="text-left rounded-2xl border border-neutral-200 p-4 hover:border-black/30 hover:bg-neutral-50 transition flex items-center gap-3"
                  >
                    {t.avatarUrl && (
                      <img src={t.avatarUrl} alt={t.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    )}
                    <div>
                      <p className="font-medium">{t.name}</p>
                      {t.role && <p className="text-xs text-neutral-500">{t.role}</p>}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={goBack} className="mt-4 text-sm underline text-neutral-500">← Back</button>
            </div>
          )}

          {/* ── Step 3: Pick date ───────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">Choose a date</h2>
              <p className="text-xs text-neutral-500 mb-4">
                {service?.name} · {tech?.name}
                {urlTechId && tech && (
                  <> · <button onClick={() => { setTech(null); setStep(2); }} className="underline">Change technician</button></>
                )}
              </p>

              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={prevMonth}
                  disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
                  className="w-8 h-8 rounded-lg border border-neutral-200 text-lg flex items-center justify-center disabled:opacity-30 hover:bg-neutral-50 transition"
                  aria-label="Previous month"
                >‹</button>
                <span className="font-medium text-sm">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                <button
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg border border-neutral-200 text-lg flex items-center justify-center hover:bg-neutral-50 transition"
                  aria-label="Next month"
                >›</button>
              </div>

              {/* Day-of-week header */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_ABBR.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-neutral-400 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              {availMap === null ? (
                <div className="py-10 text-center text-sm text-neutral-400">Loading availability…</div>
              ) : (
                <div className="grid grid-cols-7 gap-y-1">
                  {buildCells(viewYear, viewMonth).map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const ds      = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                    const enabled = isDateEnabled(viewYear, viewMonth, day);
                    const selected= date === ds;
                    return (
                      <button
                        key={ds}
                        disabled={!enabled}
                        onClick={() => { setDate(ds); setStartMin(null); setStep(4); }}
                        className={[
                          "mx-auto w-9 h-9 rounded-full text-sm font-medium transition",
                          selected              ? "bg-black text-white"                   : "",
                          enabled && !selected  ? "hover:bg-neutral-100"                  : "",
                          !enabled              ? "text-neutral-300 cursor-not-allowed"    : "cursor-pointer",
                        ].join(" ")}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              )}

              <button onClick={goBack} className="mt-6 text-sm underline text-neutral-500">← Back</button>
            </div>
          )}

          {/* ── Step 4: Pick time ───────────────────────────────────────── */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold mb-1">Choose a time</h2>
              <p className="text-xs text-neutral-500 mb-4">{date} · {tech?.name} · {service?.name}</p>

              {timeSlots === null ? (
                <p className="text-sm text-neutral-400">Loading…</p>
              ) : timeSlots.length === 0 ? (
                <div>
                  <p className="text-sm text-neutral-500">No available times for this date. Please go back and choose another.</p>
                  <button onClick={goBack} className="mt-4 text-sm underline text-neutral-500">← Back</button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {timeSlots.map(m => (
                      <button
                        key={m}
                        onClick={() => { setStartMin(m); setStep(5); }}
                        className={[
                          "px-4 py-2 rounded-2xl border text-sm font-medium transition",
                          startMin === m
                            ? "bg-black text-white border-black"
                            : "border-neutral-200 hover:border-black/40 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        {minToTimeString(m)}
                      </button>
                    ))}
                  </div>
                  <button onClick={goBack} className="mt-6 text-sm underline text-neutral-500">← Back</button>
                </>
              )}
            </div>
          )}

          {/* ── Step 5: Info + submit ───────────────────────────────────── */}
          {step === 5 && (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Summary aside */}
              <div className="md:w-52 shrink-0 rounded-2xl bg-neutral-50 p-4 text-sm space-y-2">
                <p className="font-semibold mb-1">Your appointment</p>
                <p><span className="font-medium">Service</span><br /><span className="text-neutral-600">{service?.name}</span></p>
                <p><span className="font-medium">With</span><br /><span className="text-neutral-600">{tech?.name}</span></p>
                <p><span className="font-medium">Date</span><br /><span className="text-neutral-600">{date}</span></p>
                <p><span className="font-medium">Time</span><br /><span className="text-neutral-600">{minToTimeString(startMin)}</span></p>
                <p><span className="font-medium">Duration</span><br /><span className="text-neutral-600">{service?.durationMin || 60} min</span></p>
                {service?.price && <p><span className="font-medium">Price</span><br /><span className="text-neutral-600">{service.price}</span></p>}
                <p className="text-xs text-neutral-400 pt-1">Pay in person at your visit.</p>
              </div>

              {/* Contact form */}
              <form onSubmit={handleSubmit} className="flex-1 space-y-3">
                {/* Honeypot — hidden from real users, bots fill it */}
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

                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="bk-name">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="bk-name"
                    type="text"
                    required
                    maxLength={200}
                    value={client.name}
                    onChange={e => setClient(c => ({ ...c, name: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="bk-email">Email</label>
                  <input
                    id="bk-email"
                    type="email"
                    maxLength={200}
                    value={client.email}
                    onChange={e => setClient(c => ({ ...c, email: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="bk-phone">
                    Phone <span className="text-neutral-400 font-normal text-xs">(email or phone required)</span>
                  </label>
                  <input
                    id="bk-phone"
                    type="tel"
                    maxLength={30}
                    value={client.phone}
                    onChange={e => setClient(c => ({ ...c, phone: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition"
                    placeholder="623-555-0100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="bk-notes">Notes</label>
                  <textarea
                    id="bk-notes"
                    rows={3}
                    maxLength={500}
                    value={client.notes}
                    onChange={e => setClient(c => ({ ...c, notes: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-black/40 transition resize-none"
                    placeholder="Design ideas, color preferences, reference links, etc."
                  />
                </div>

                {/* Inline validation hint */}
                {client.name.trim() && !client.email.trim() && !client.phone.trim() && (
                  <p className="text-xs text-red-500">Please provide at least an email or phone number.</p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting || !client.name.trim() || (!client.email.trim() && !client.phone.trim())}
                    className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Booking…" : "Confirm Booking"}
                  </button>
                  <button type="button" onClick={goBack} className="text-sm underline text-neutral-500">
                    ← Back
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
