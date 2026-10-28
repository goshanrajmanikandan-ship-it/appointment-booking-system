# Calendra Appointment Booking

## 1. Project overview

Calendra is a responsive, browser-only appointment scheduling workspace built with semantic HTML, CSS, and vanilla JavaScript. It stores appointment records in the current browser's LocalStorage. There is no server-side application.

## 2. Problem statement and objectives

The project provides a simple way for one person using one browser profile to create, review, find, export, and cancel appointments. It is a frontend demonstration, not a multi-user booking service. It does not provide server-backed identity, shared availability, or durable centralized records.

## 3. Features and functionalities

- Responsive overview, booking, and appointment-management views.
- Light and dark appearance preferences.
- Booking form validation and date-aware half-hour time slots.
- Review and confirmation before saving a booking.
- Duplicate-slot checks against bookings saved in the current browser.
- Appointment search, status filtering, cancellation confirmation, and CSV export.
- LocalStorage persistence, cross-tab storage event refresh, accessible form labels, live notifications, and keyboard shortcuts.
- Browser-side booking rules covered by Node's built-in test runner.

## 4. Technology stack

- HTML5 and CSS3; no frontend framework or runtime dependency.
- Vanilla JavaScript, including the testable business rules in `booking-core.js`.
- Browser LocalStorage for local appointment and theme preferences.
- Node.js 18 or newer and its built-in `node:test` runner for tests. Node is not required to open the website.

## 5. Project directory structure

```text
.
├── index.html                 # Accessible page structure and dialogs
├── style.css                  # Responsive design system and component styles
├── script.js                  # Browser UI, events, rendering, and persistence
├── booking-core.js            # Shared validation, date, storage, and CSV rules
├── package.json               # Node test and coverage scripts
└── test/
    └── booking-core.test.js   # Business-rule and persistence unit tests
```

## 6. System architecture

```text
Browser UI (index.html + style.css)
               |
       script.js (view state)
               |
       booking-core.js
               |
    Browser LocalStorage
```

The browser UI calls the shared core for validation, slot checks, cancellation state changes, CSV escaping, and LocalStorage record parsing. The application has no backend service, API client, database driver, authentication layer, or network booking workflow.

Records loaded from LocalStorage are checked against the booking field constraints before they are rendered or exported. Invalid records are ignored; malformed JSON or unavailable storage is surfaced as a friendly browser notification.

## 7. Installation and setup

1. Clone or download this repository.
2. Open `index.html` directly in a modern browser, or serve the project with the VS Code Live Server extension. Serving locally is recommended for consistent browser behavior.
3. To run tests, install Node.js 18 or newer. The project has no npm dependencies, so `npm install` is not required.

## 8. Environment variables

None. The frontend has no environment-specific credentials or configuration. Do not add secrets to browser code: anything delivered to a browser is public to that browser's user.

## 9. Running the application

Open `index.html` in a browser or start it with VS Code Live Server. Bookings and the theme preference are stored only in that browser profile. Clearing site data or switching browser/device profiles removes access to those records.

Keyboard shortcuts:

- `Ctrl/Cmd + K`: Open appointments and focus search.
- `Ctrl/Cmd + N`: Start a new appointment.
- `Escape`: Close a dialog or mobile navigation.

## 10. API documentation

There are no HTTP API endpoints in this project. All booking and management actions are local browser interactions; documenting HTTP methods, request bodies, response codes, or authentication would describe APIs that do not exist.

| Category | Existing endpoint |
| --- | --- |
| Authentication and user management | None; the app has no accounts or authentication. |
| Appointment creation and management | None; bookings are written to LocalStorage. |
| Availability and time-slot checking | None; availability is checked in the browser against locally stored bookings. |
| Appointment cancellation | None; cancellation updates the local browser record after confirmation. |
| Appointment history and details | None; history is rendered from local browser storage. |

There is no OpenAPI/Swagger definition because there is no HTTP API. A production multi-user deployment needs a backend API that performs authorization, validation, availability checks, and booking writes atomically.

## 11. Database schema

There is no database, database connection configuration, migration, or database initialization step. LocalStorage is a per-origin browser key/value store and does not support relational constraints, transactions, foreign keys, or unique indexes.

The application stores appointment objects as a JSON array under `calendra_appointments_v3`:

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `id` | string | Yes | Browser-generated appointment identifier. |
| `name` | string | Yes | Attendee name (2–80 characters at booking). |
| `email` | string | Yes | Attendee email (validated, maximum 120 characters). |
| `phone` | string | Yes | Optional phone number, stored as an empty string when omitted. |
| `title` | string | Yes | Appointment title (3–100 characters). |
| `date` | `YYYY-MM-DD` string | Yes | Local calendar date. |
| `time` | `HH:mm` string | Yes | One of the configured half-hour slots, from 09:00 through 17:00, excluding 13:00. |
| `notes` | string | Yes | Optional notes, up to 300 characters. |
| `status` | string | Yes | `upcoming`, `completed`, or `cancelled`. |
| `createdAt` | ISO timestamp string | Yes | Browser creation time. |
| `cancelledAt` | ISO timestamp string | No | Set when a booking is cancelled. |

Example using fictional data:

```json
{
  "id": "CAL-EXAMPLE-12345",
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "phone": "+1 555 010 1234",
  "title": "Project discussion",
  "date": "2030-05-16",
  "time": "10:30",
  "notes": "Bring the draft agenda.",
  "status": "upcoming",
  "createdAt": "2030-05-01T09:00:00.000Z"
}
```

The app checks for an existing active booking again immediately before saving and refreshes from LocalStorage on cross-tab storage events. However, LocalStorage has no atomic compare-and-set or unique-slot constraint; simultaneous writes in separate tabs/devices are not guaranteed to be race-free. This is not a suitable concurrency control mechanism for a production booking service. A backend database must enforce a unique active slot (or use an equivalent transaction/atomic reservation) and handle conflicts server-side.

## 12. Appointment booking workflow

1. Enter attendee details, choose a valid date, and select an available future time.
2. The browser validates required values, date/time boundaries, and duplicate local bookings.
3. Review the appointment and confirm it.
4. On confirmation, the app reloads the local booking list, validates slot availability again, and saves the updated list. If storage is unavailable or the slot has been taken in the current saved data, it reports the failure rather than showing a successful booking.
5. Find or cancel upcoming appointments in the appointments view. Cancellation requires confirmation and releases the slot in this browser.

## 13. Unit testing and integration testing

Run the JavaScript syntax check and unit tests with:

```sh
npm run check
npm test
```

The tests cover valid and invalid booking inputs, empty fields, field boundaries, malformed and past dates, same-day past slots, duplicate active bookings, cancelled-slot reuse, status calculation, cancellation, stored-record integrity, storage parsing/errors, CSV quoting, and spreadsheet-formula protection.

There are no backend endpoints or database to integration-test. The project does not currently have automated browser end-to-end tests; the booking confirmation and cancellation dialogs should be checked manually in a browser when changing UI event handling.

## 14. Test coverage instructions

Generate Node's built-in coverage report with:

```sh
npm run test:coverage
```

The command reports coverage for exercised JavaScript modules. Coverage is a measure of executed code, not a guarantee of correctness; no fixed coverage threshold is configured.

## 15. Error handling strategy

- Invalid form values are associated with their fields and prevent review/booking.
- LocalStorage read and write failures are logged with generic messages and surfaced with a friendly notification. A failed save does not update the in-memory list as if it succeeded.
- A stale or unavailable booking is rechecked at confirmation, and unexpected browser JavaScript errors show a non-technical retry message.
- CSV cell values are quoted and user-controlled values that could be interpreted as spreadsheet formulas are neutralized.
- No React Error Boundary or backend error middleware applies because this is not a React or server application.

## 16. Security considerations

- This app has no user accounts, authentication, authorization, server-side validation, or private cloud storage. It must not be used to store sensitive appointment information.
- LocalStorage is accessible to scripts running on the same origin and is not encrypted. Use trusted hosting and avoid loading untrusted scripts.
- Client-side validation and slot checks improve usability but cannot secure a multi-user booking service or prevent concurrent reservations.
- Rendered user values are HTML-escaped. CSV export neutralizes formula-like content.
- There are no API keys, credentials, or production connection strings in this project.

## 17. Troubleshooting common errors

- **Appointments are missing:** Confirm you are using the same browser profile and origin, and that site data has not been cleared.
- **A booking could not be saved:** Check browser storage permissions and available space; private browsing settings may restrict storage.
- **A time slot is unavailable:** Select a different future slot. The app may have detected a booking saved in another tab.
- **The page looks unstyled:** Confirm `style.css` is alongside `index.html`; try a local web server if the browser blocks local resources.
- **Tests do not run:** Check `node --version`; Node.js 18 or newer is required.

## 18. Known limitations

- One browser profile only; no shared bookings, accounts, synchronization, reminders, or server-side data recovery.
- No backend API, database, atomic booking constraint, or reliable cross-device/concurrent booking prevention.
- No automated browser end-to-end or accessibility audit suite.
- Date and time interpretation follows the user's local browser time zone; there is no business-hours or time-zone configuration.
- External Google Fonts require network access; system-font fallbacks are provided.

## 19. Future improvements

- Add a backend API and a database with server-side validation, authorization, atomic unique-slot enforcement, and migrations.
- Add authentication and ownership checks before exposing appointment details or cancellation.
- Add time-zone-aware availability, reminders, audit history, and configurable business hours.
- Add automated browser workflow/accessibility tests and a deployment/build pipeline.
