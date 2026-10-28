(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalendraCore = api;
})(globalThis, function () {
  "use strict";

  const SLOT_TIMES = Object.freeze([
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"
  ]);
  const STATUSES = new Set(["upcoming", "completed", "cancelled"]);
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_PATTERN = /^[+()\d\s.-]{7,20}$/;

  const pad = value => String(value).padStart(2, "0");

  function localISO(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function isPastSlot(date, time, now = new Date()) {
    if (!isValidDate(date) || !SLOT_TIMES.includes(time)) return true;
    return date < localISO(now) || (date === localISO(now) && time <= `${pad(now.getHours())}:${pad(now.getMinutes())}`);
  }

  function effectiveStatus(appointment, now = new Date()) {
    if (appointment.status === "cancelled") return "cancelled";
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return appointment.date < localISO(now) || (appointment.date === localISO(now) && appointment.time < currentTime)
      ? "completed"
      : "upcoming";
  }

  function isStoredAppointment(appointment) {
    const isISODateTime = value => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
    const validPhone = appointment && typeof appointment.phone === "string" &&
      (!appointment.phone || (PHONE_PATTERN.test(appointment.phone) && /\d/.test(appointment.phone)));
    return Boolean(
      appointment &&
      typeof appointment.id === "string" && appointment.id.length > 0 && appointment.id.length <= 80 &&
      typeof appointment.name === "string" && appointment.name.trim().length >= 2 && appointment.name.trim().length <= 80 &&
      typeof appointment.email === "string" && appointment.email.length <= 120 && EMAIL_PATTERN.test(appointment.email) &&
      validPhone &&
      typeof appointment.title === "string" && appointment.title.trim().length >= 3 && appointment.title.trim().length <= 100 &&
      isValidDate(appointment.date) &&
      SLOT_TIMES.includes(appointment.time) &&
      STATUSES.has(appointment.status) &&
      typeof appointment.notes === "string" && appointment.notes.length <= 300 &&
      isISODateTime(appointment.createdAt) &&
      (appointment.cancelledAt === undefined || isISODateTime(appointment.cancelledAt))
    );
  }

  function loadAppointments(storage, key) {
    const records = JSON.parse(storage.getItem(key) || "[]");
    return Array.isArray(records) ? records.filter(isStoredAppointment) : [];
  }

  function saveAppointments(storage, key, appointments) {
    storage.setItem(key, JSON.stringify(appointments));
  }

  function validateAppointment(fields, appointments = [], now = new Date()) {
    const name = String(fields.name ?? "").trim();
    const email = String(fields.email ?? "").trim();
    const phone = String(fields.phone ?? "").trim();
    const title = String(fields.title ?? "").trim();
    const date = String(fields.date ?? "");
    const time = String(fields.time ?? "");
    const errors = {};
    const emailOk = EMAIL_PATTERN.test(email);
    const phoneOk = !phone || (PHONE_PATTERN.test(phone) && /\d/.test(phone));

    if (name.length < 2 || name.length > 80) errors.name = "Enter your full name (2–80 characters).";
    if (!emailOk || email.length > 120) errors.email = "Enter a valid email address.";
    if (!phoneOk) errors.phone = "Enter a valid phone number or leave it blank.";
    if (title.length < 3 || title.length > 100) errors.title = "Enter an appointment title (3–100 characters).";
    if (!isValidDate(date)) errors.date = "Choose a valid appointment date.";
    else if (date < localISO(now)) errors.date = "Choose today or a future date.";
    if (!SLOT_TIMES.includes(time)) errors.time = "Choose an available time slot.";
    else if (isPastSlot(date, time, now)) errors.time = "That time has passed. Choose another slot.";
    else if (appointments.some(appointment =>
      appointment.date === date &&
      appointment.time === time &&
      effectiveStatus(appointment, now) === "upcoming"
    )) errors.time = "That slot is already booked. Choose another time.";
    if (String(fields.notes ?? "").length > 300) errors.notes = "Notes must be 300 characters or fewer.";

    return errors;
  }

  function cancelAppointment(appointments, id, now = new Date()) {
    let found = false;
    const updated = appointments.map(appointment => {
      if (appointment.id !== id) return appointment;
      found = true;
      return { ...appointment, status: "cancelled", cancelledAt: now.toISOString() };
    });
    return found ? updated : null;
  }

  function toCSV(headers, rows) {
    const cell = value => {
      const text = String(value ?? "");
      const safe = /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    return [headers, ...rows].map(row => row.map(cell).join(",")).join("\r\n");
  }

  return {
    SLOT_TIMES,
    cancelAppointment,
    effectiveStatus,
    isPastSlot,
    isValidDate,
    loadAppointments,
    localISO,
    saveAppointments,
    toCSV,
    validateAppointment
  };
});
