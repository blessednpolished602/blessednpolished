/**
 * Convert a minutes-from-midnight integer to a human-readable time string.
 * 540 → "9:00 AM"  |  570 → "9:30 AM"  |  780 → "1:00 PM"
 */
export function minToTimeString(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Return all 30-min slot startMin values a booking occupies.
 * lockedSlots(540, 60) → [540, 570]
 * lockedSlots(540, 90) → [540, 570, 600]
 */
export function lockedSlots(startMin, durationMin, slotSizeMin = 30) {
  const count = Math.ceil(durationMin / slotSizeMin);
  return Array.from({ length: count }, (_, i) => startMin + i * slotSizeMin);
}
