"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../booking-core.js");

const now = new Date(2030, 4, 15, 10, 0);
const validBooking = overrides => ({
  name: "Alex Morgan",
  email: "alex@example.com",
  phone: "+91 98765 43210",
  title: "Project discussion",
  date: "2030-05-16",
  time: "10:30",
  notes: "",
  ...overrides
});
const savedBooking = overrides => ({
  id: "CAL-1",
  ...validBooking(),
  status: "upcoming",
  createdAt: "2030-05-01T09:00:00.000Z",
  ...overrides
});

test("accepts valid booking details and the first/last available slot", () => {
  assert.deepEqual(validateAppointment(validBooking({ time: SLOT_TIMES[0] }), [], now), {});
  assert.deepEqual(validateAppointment(validBooking({ time: SLOT_TIMES.at(-1) }), [], now), {});
});

test("reports all required-field and malformed-input errors", () => {
  const errors = validateAppointment(validBooking({
    name: "",
    email: "not-an-email",
    phone: "abc",
    title: " ",
    date: "2030-02-30",
    time: "25:99",
    notes: "x".repeat(301)
  }), [], now);
  assert.deepEqual(Object.keys(errors).sort(), ["date", "email", "name", "notes", "phone", "time", "title"]);
});

test("enforces field boundaries and optional phone numbers", () => {
  assert.deepEqual(validateAppointment(validBooking({ name: "  AB  ", phone: "" }), [], now), {});
  assert.ok(validateAppointment(validBooking({ name: "A" }), [], now).name);
  assert.ok(validateAppointment(validBooking({ title: "Hi" }), [], now).title);
  assert.ok(validateAppointment(validBooking({ name: "N".repeat(81) }), [], now).name);
  assert.ok(validateAppointment(validBooking({ email: `${"a".repeat(115)}@example.com` }), [], now).email);
});

test("rejects dates before today and invalid calendar dates", () => {
  assert.equal(isValidDate("2030-02-30"), false);
  assert.equal(isValidDate("2030-02-28"), true);
  assert.ok(validateAppointment(validBooking({ date: "2030-05-14" }), [], now).date);
  assert.ok(validateAppointment(validBooking({ date: "" }), [], now).date);
});

test("rejects same-day slots at or before the current minute", () => {
  assert.equal(isPastSlot("2030-05-15", "10:00", now), true);
  assert.equal(isPastSlot("2030-05-15", "10:30", now), false);
  assert.ok(validateAppointment(validBooking({ date: "2030-05-15", time: "10:00" }), [], now).time);
});

test("prevents duplicate active bookings but allows cancelled bookings", () => {
  const existing = savedBooking({ date: "2030-05-16", time: "10:30" });
  assert.ok(validateAppointment(validBooking(), [existing], now).time);
  assert.deepEqual(validateAppointment(validBooking(), [{ ...existing, status: "cancelled" }], now), {});
});

test("computes completed and cancelled statuses without mutating the appointment", () => {
  const appointment = savedBooking({ date: "2030-05-14" });
  assert.equal(effectiveStatus(appointment, now), "completed");
  assert.equal(effectiveStatus({ ...appointment, status: "cancelled" }, now), "cancelled");
  assert.equal(appointment.status, "upcoming");
});

test("cancels the requested appointment and leaves unrelated records untouched", () => {
  const first = savedBooking();
  const second = savedBooking({ id: "CAL-2" });
  const cancelled = cancelAppointment([first, second], first.id, now);
  assert.equal(cancelled[0].status, "cancelled");
  assert.equal(cancelled[0].cancelledAt, now.toISOString());
  assert.equal(cancelled[1], second);
  assert.equal(cancelAppointment([second], "missing", now), null);
});

test("loads only valid stored records and treats an empty store as no bookings", () => {
  const storage = { getItem: () => JSON.stringify([savedBooking(), { id: "bad" }]) };
  assert.deepEqual(loadAppointments(storage, "records"), [savedBooking()]);
  assert.deepEqual(loadAppointments({ getItem: () => null }, "records"), []);
  assert.throws(() => loadAppointments({ getItem: () => "{" }, "records"), SyntaxError);
});

test("propagates storage write failures so the UI can report them", () => {
  const error = new Error("storage disabled");
  assert.throws(() => saveAppointments({ setItem: () => { throw error; } }, "records", []), error);
});

test("exports quoted CSV and neutralizes spreadsheet formulas", () => {
  assert.equal(
    toCSV(["Title", "Notes"], [["=1+1", 'Said "hello", today']]),
    '"Title","Notes"\r\n"\'=1+1","Said ""hello"", today"'
  );
});

test("formats local calendar dates without converting time zones", () => {
  assert.equal(localISO(new Date(2030, 0, 2, 23, 59)), "2030-01-02");
});
