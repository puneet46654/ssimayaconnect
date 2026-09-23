# SSI Maya Connect

SSI Maya Connect is a full-stack event management, registration, scheduling, and booking platform built for SSI.

It serves two audiences:

- Admin portal: create, manage, and monitor events
- Public portal: browse events, complete registration, choose slots, and confirm bookings

The application is built with Next.js, React, TypeScript, Tailwind CSS, MongoDB, Mongoose, AWS S3, and Socket.IO.

---

## Project purpose

This project centralizes event operations into a single data-driven system. Administrators manage event content and schedules in one place, and the public interfaces fetch the latest data from MongoDB instead of relying on hardcoded values.

The platform is designed to support:

- event publishing and lifecycle management
- multi-day schedules and generated slots
- dynamic registration templates
- real availability and capacity tracking
- booking confirmation and ticket generation
- attendance reporting and admin dashboards

---

## What is already built

### Public user experience

- responsive event landing page and listing
- event detail screens with venue, date, and description
- event images stored and served from AWS S3
- dynamic registration templates by event
- multi-day event selection
- real slot availability based on database state
- remaining seats and fully booked slot handling
- booking confirmation flow
- QR code ticket display and confirmation UI

### Admin experience

- admin login and protected route handling
- admin dashboard and event management screens
- create, edit, delete event flows
- image upload and replacement workflows
- multi-day schedule configuration
- slot duration, gap, lunch break, and capacity settings
- event template selection
- attendance and reporting modules
- live refresh for admin screens using realtime updates

### Backend and platform logic

- MongoDB connection and Mongoose models
- event CRUD APIs
- schedule validation and slot generation
- capacity tracking for slots
- server-side booking validation
- secure admin session management
- booking confirmation email flow via Resend
- Socket.IO realtime change broadcasting

---

## Current status

The project is in an advanced implementation stage. The core event system, dynamic booking flow, and admin workflows are largely in place.

### Completed

- [x] Next.js application foundation
- [x] MongoDB and Mongoose integration
- [x] Event model and event APIs
- [x] AWS S3 image management
- [x] Admin authentication and protected routes
- [x] Event creation, edit, and delete flows
- [x] Multi-day scheduling and slot generation
- [x] Dynamic booking templates
- [x] Public event pages and booking flow
- [x] Real slot availability loading
- [x] Booking confirmation flow
- [x] QR ticket support
- [x] Attendance/status tracking
- [x] Admin reports dashboard
- [x] Realtime event refresh

### In progress / planned

- [ ] polished My Tickets experience
- [ ] advanced attendee management
- [ ] full QR check-in workflow
- [ ] CSV/Excel export
- [ ] deeper reporting and analytics
- [ ] production hardening and monitoring

---

## Technical stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- App Router
- Framer Motion
- QR code generation

### Backend

- Next.js API routes
- Node.js
- MongoDB
- Mongoose
- Socket.IO

### Storage and services

- AWS S3 for event images
- Resend for booking emails
- Redis support present for future integrations

---

## Core application flow

The product follows a clear data-driven architecture:

```text
Admin creates/updates event data
        ↓
MongoDB stores the system of record
        ↓
Public APIs read current data
        ↓
Users browse, register, and select slots
        ↓
Server validates availability and bookings
        ↓
Confirmation and ticketing complete the flow
```

This is important because the frontend is never treated as the final authority for slot availability or booking validity.

---

## Main domain models

### Event

Represents a top-level event with fields such as:

- eventName
- eventType
- bookingFormTemplate
- venue
- description
- imageUrl
- numberOfDays
- startDate
- endDate
- status

### DaySchedule

Represents one day within an event and includes:

- dayNumber
- date
- startTime
- endTime
- lunch configuration
- slot duration
- slot gap
- capacity
- sameAsDay1

### Slot

Represents one generated time slot and includes:

- eventId
- dayScheduleId
- startTime
- endTime
- capacity
- bookedCount

---

## Booking flow

The system follows this user journey:

```text
Landing page
  → Event listing
  → Event details
  → Registration form
  → Time-slot selection
  → Booking confirmation
  → Ticket / QR display
```

Main user routes:

- /events
- /events/[id]
- /events/[id]/book
- /events/[id]/book/slots
- /events/[id]/book/confirm

---

## Admin flow

Core admin areas are under the admin section:

- /admin/login
- /admin
- /admin/eventmanagement
- /admin/eventmanagement/new
- /admin/eventmanagement/[id]/edit
- /admin/reports
- /admin/bookings
- /admin/check-in

These screens are protected and rely on server-side validation before acting on data.

---

## Availability and booking safety

A key implementation principle is: never trust client-side capacity values.

The expected server-side flow is:

```text
Receive booking request
  → validate event
  → validate selected slot
  → check remaining capacity
  → reserve capacity atomically
  → create booking record
  → return confirmation
```

This prevents overbooking and ensures availability is based on the live database state.

---

## Project structure

```text
ssimayaconnect/
├── app/
│   ├── admin/
│   ├── api/
│   ├── events/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── ...
├── components/
│   ├── admin/
│   └── realtime/
├── lib/
│   ├── admin-auth.ts
│   ├── admin-server-auth.ts
│   ├── db.ts
│   ├── realtime.ts
│   ├── s3.ts
│   └── events/
├── models/
│   ├── Event.ts
│   ├── DaySchedule.ts
│   ├── Slot.ts
│   └── Booking.ts
├── public/
├── .env.local
├── next.config.ts
├── package.json
├── server.mjs
├── README.md
├── tsconfig.json
└── ...
```

---

## API overview

### Public APIs

- GET /api/events
- POST /api/events
- GET /api/events/[id]
- PUT /api/events/[id]
- DELETE /api/events/[id]
- GET /api/events/[id]/image
- GET /api/events/[id]/slots
- POST /api/bookings

### Admin APIs

- /api/admin/login
- /api/admin/logout
- /api/admin/dashboard
- /api/admin/reports
- /api/admin/bookings
- /api/admin/attendance

---

## Realtime updates

The project includes a realtime refresh layer using Socket.IO.

When a change is made to event data, the system can emit updates and refresh the relevant UI without needing a full manual reload. This is especially useful for admin screens and event management workflows.

---

## Environment setup

### Install dependencies

```bash
npm install
```

### Create environment file

Create `.env.local` in the project root with values similar to:

```env
MONGODB_URI=your_mongodb_connection_string

AWS_REGION=your_aws_region
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name

ADMIN_SESSION_SECRET=your_admin_session_secret
BOOKING_ACCESS_SECRET=your_booking_secret

RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=your_verified_sender_email
```

### Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### Production build

```bash
npm run build
npm run start
```

---

## Security and operational notes

The project should never store secrets in Git:

- .env
- .env.local
- AWS credentials
- MongoDB credentials
- API keys
- admin session secrets

Critical paths such as admin auth, event updates, and booking validation are handled on the server side.

---

## Design direction

The project follows a professional, clean, and mobile-friendly UI style:

- clear hierarchy and typography
- neutral backgrounds
- consistent spacing
- accessible form design
- strong action buttons
- responsive layouts for desktop and mobile

---

## Summary for AI or future contributors

SSI Maya Connect is a modern event management and booking platform designed to centralize event operations, attendee registrations, scheduling, and admin oversight in one system.

The most important context is:

- this is a Next.js event platform, not a static marketing site
- MongoDB is the source of truth for event data, schedules, and slot availability
- public booking pages fetch from the database and render according to event metadata
- admin users control the event lifecycle
- slot capacity and booking validity are enforced on the server
- the project is structured to grow into attendance, check-in, and reporting workflows

---

## Recommended next steps

1. complete the My Tickets experience
2. improve attendee management screens
3. finalize QR-based check-in workflow
4. expand reporting and export features
5. harden production configuration and monitoring

---

## AI-friendly handoff summary

If another AI system is asked to continue this project, it should know:

- this repo is a data-driven event booking and admin management application
- event content, schedules, and slots are managed dynamically through MongoDB
- admin and public interfaces share the same underlying event source of truth
- capacity and booking enforcement must happen on the backend
- the app already has the foundational pieces for a production-ready event management system

This README is intentionally concise, implementation-focused, and easy to scan so it can be understood quickly without wasting tokens.
