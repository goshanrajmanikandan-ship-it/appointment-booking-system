# Calendra — 10/10 Frontend Edition

A polished, responsive appointment booking interface built with semantic HTML, modern CSS, and vanilla JavaScript.

## Run locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser.
3. For best results, run a local server using VS Code Live Server.

## Features
- Responsive workspace dashboard and mobile navigation
- Premium silver / porcelain / graphite visual system
- Light and dark themes with saved preference
- Appointment form with live summary and validation
- Date-aware time slots, past-time protection, duplicate slot checks
- Review-before-confirm booking dialog
- Appointment search, status filter, cancel flow, and CSV export
- LocalStorage persistence, empty states, accessible labels, keyboard shortcuts
- Reduced-motion support, live status announcements, focus-visible styles

## Keyboard shortcuts
- `Ctrl/Cmd + K`: Open appointments and focus search
- `Ctrl/Cmd + N`: Start a new appointment
- `Escape`: Close dialogs / mobile navigation

## Important limitation
This is a frontend-only demo. LocalStorage is specific to one browser profile and is not a secure multi-user database. A production system needs a backend API and database, server-side validation, atomic unique-slot enforcement, authentication/authorization where appropriate, and real notifications. Never rely on client-side duplicate checks to guarantee availability across multiple users/devices.

## Files
- `index.html` — semantic page structure
- `style.css` — responsive design system and components
- `script.js` — app state, validation, bookings, filtering, storage and CSV export
# appointment-booking-system
