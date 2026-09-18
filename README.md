# SSI Maya Connect

SSI Maya Connect is a modern, responsive **event management, registration, scheduling, and booking platform** developed for SSI.

The application provides two major experiences:

- **Admin Portal** — Create, edit, manage, schedule, and monitor events.
- **User Portal** — Discover events, view event information, complete registration forms, select available dates/time slots, and complete bookings.

The platform is built using **Next.js, React, TypeScript, Tailwind CSS, MongoDB, Mongoose, and AWS S3**.

---

 Features

### User Portal

- Responsive landing page
- Event discovery
- Live events
- Upcoming events
- Conference events
- Mantram events
- Event details page
- Dynamic event images
- Event venue information
- Event dates
- Event descriptions
- Dynamic registration templates
- Practitioner / Institutional registration
- Mantram registration
- Faculty / Delegate selection
- International country selector
- Country flags
- International calling codes
- Searchable country dropdown
- State / Province selection
- Mobile responsive registration forms
- Multi-day event selection
- Dynamic time-slot selection
- Real database-backed slot availability
- Remaining seat display
- Fully booked slot handling

---

 Admin Portal

The Admin Portal allows administrators to manage events and booking configuration.

### Admin Features

- Admin authentication
- Protected admin routes
- Responsive admin dashboard
- Desktop sidebar
- Mobile navigation drawer
- Logout confirmation
- Event management
- Create event
- Edit event
- Delete event
- Upload event image
- Update event image
- Event type selection
- Booking form template selection
- Multi-day scheduling
- Slot duration configuration
- Slot gap configuration
- Lunch break configuration
- Booking capacity configuration
- Event filtering
- Event status management
- Responsive event cards

---

 Technology Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
Next.js App Router
Next.js Image
```

## Backend

```text
Next.js Route Handlers
Node.js
MongoDB
Mongoose
```

## Storage

```text
AWS S3
```

AWS S3 is used to store event images.

---

 Project Structure

```text
ssimayaconnect/
│
├── app/
│
│   ├── admin/
│   │   │
│   │   ├── eventmanagement/
│   │   │   │
│   │   │   ├── [id]/
│   │   │   │   └── edit/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── page.tsx
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx
│   │   │
│   │   ├── layout.tsx
│   │   └── loading.tsx
│   │
│   ├── api/
│   │   │
│   │   ├── events/
│   │   │   │
│   │   │   ├── [id]/
│   │   │   │   │
│   │   │   │   ├── image/
│   │   │   │   │   └── route.ts
│   │   │   │   │
│   │   │   │   ├── slots/
│   │   │   │   │   └── route.ts
│   │   │   │   │
│   │   │   │   └── route.ts
│   │   │   │
│   │   │   └── route.ts
│   │   │
│   │   └── location/
│   │       └── ...
│   │
│   ├── events/
│   │   │
│   │   ├── [id]/
│   │   │   │
│   │   │   ├── book/
│   │   │   │   │
│   │   │   │   ├── slots/
│   │   │   │   │   └── page.tsx
│   │   │   │   │
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── page.tsx
│   │   │
│   │   └── page.tsx
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   │
│   ├── admin/
│   │   └── Sidebar.tsx
│   │
│   └── realtime/
│       └── RealtimeProvider.tsx
│
├── lib/
│   ├── admin-auth.ts
│   ├── db.ts
│   ├── s3.ts
│   │
│   └── events/
│       ├── slots.ts
│       └── status.ts
│
├── models/
│   ├── Event.ts
│   ├── DaySchedule.ts
│   └── Slot.ts
│
├── public/
│   └── logos/
│       └── ssilogo.png
│
├── package.json
├── .env.local
└── README.md
```

---

 Event Management

The application supports multiple event types.

```ts
type EventType =
  | 'conference'
  | 'mantram'
  | 'event';
```

Administrators can configure each event independently.

An event contains information such as:

```ts
eventName
eventType
bookingFormTemplate
venue
description
imageUrl
numberOfDays
startDate
endDate
status
createdAt
updatedAt
```

---

 Event Status

Supported event statuses are:

```ts
type EventStatus =
  | 'LIVE'
  | 'COMPLETED'
  | 'UPCOMING';
```

These statuses are used throughout both the admin and public interfaces.

---

 Dynamic Booking Templates

Each event can have its own registration form.

The selected template is stored in:

```ts
bookingFormTemplate
```

Available template values currently include:

```ts
type BookingFormTemplate =
  | 'practitioner-institutional'
  | 'template-2'
  | 'template-3';
```

Example:

```text
Event
   ↓
bookingFormTemplate
   ↓
Booking Page
   ↓
Template Selector
   ↓
Correct Registration Form
```

This means administrators can change the registration form for an event without modifying the public booking page.

---

 Practitioner / Institutional Registration

The practitioner/institutional registration form can collect:

```text
Faculty / Delegate
Title
Full Name
Specialty / Department
Mobile Number
Email Address
Hospital Name
Country
State / Province
City / Town
```

The form also supports international users.

---

 Country & Phone System

The booking forms include dynamic country information.

Supported functionality includes:

- Country name
- Country ISO code
- Country flag
- International calling code
- Country search
- Calling-code search
- State / Province loading

Example:

```text
India
IN
+91
```

The user can search by:

```text
India
IN
+91
```

---

 Multi-Day Event Scheduling

Events can run for multiple days.

Each event can contain individual day schedules.

Example:

```text
Event
│
├── Day 1
│   ├── Start Time
│   ├── End Time
│   ├── Lunch Break
│   ├── Slot Duration
│   ├── Slot Gap
│   └── Capacity
│
├── Day 2
│   ├── Start Time
│   ├── End Time
│   └── Slots
│
└── Day 3
    ├── Start Time
    ├── End Time
    └── Slots
```

---

# ⏱ DaySchedule

A DaySchedule stores scheduling configuration for one event day.

Important fields include:

```ts
eventId
dayNumber
date
startTime
endTime
lunchEnabled
lunchStart
lunchEnd
slotDuration
slotGap
capacity
sameAsDay1
```

Example:

```text
Day 1

Start:
09:00 AM

End:
05:00 PM

Slot Duration:
30 Minutes

Gap:
10 Minutes

Lunch:
01:00 PM - 02:00 PM

Capacity:
20
```

---

 Time Slots

Slots are generated from event schedules.

A slot contains values such as:

```ts
eventId
dayScheduleId
startTime
endTime
capacity
bookedCount
```

Availability can be calculated using:

```ts
const remaining =
  Math.max(
    capacity - bookedCount,
    0
  );
```

Example:

```text
09:00 - 09:30
Capacity: 20
Booked: 15
5 left
```

When:

```ts
remaining <= 0
```

the slot is displayed as:

```text
BOOKED
```

and cannot be selected.

---

 Booking Flow

The intended booking journey is:

```text
Landing Page
      ↓
Event List
      ↓
Event Details
      ↓
Book Tickets
      ↓
Registration Form
      ↓
Continue to Time Slots
      ↓
Select Event Date
      ↓
Select Available Time Slot
      ↓
Confirm Booking
      ↓
Booking Confirmation
```

---

 Registration Form Flow

The booking form is available at:

```text
/events/[id]/book
```

The page loads the selected event.

It then reads:

```ts
bookingFormTemplate
```

and renders the correct registration form.

For example:

```text
practitioner-institutional
        ↓
Practitioner / Institutional Form
```

```text
template-2
        ↓
Mantram Form
```

---

 Continue To Time Slots

After completing the registration form, the user continues to time-slot selection.

The form details can temporarily be stored in:

```ts
sessionStorage
```

using an event-specific key:

```ts
`ssi-booking-details:${eventId}`
```

The user is then redirected to:

```text
/events/[id]/book/slots
```

---

 Time Slot Selection Page

The slot page loads actual event schedules and slots from the database.

The frontend should not generate fake availability.

The data comes from:

```http
GET /api/events/[id]/slots
```

The API returns information including:

```text
Event
Event Days
DaySchedule IDs
Slot IDs
Start Time
End Time
Capacity
Booked Count
Remaining Capacity
Availability
```

---

 Date Selection

For multi-day events, users can choose an event date.

Example:

```text
Select Date

┌────────┐ ┌────────┐ ┌────────┐
│  FRI   │ │  SAT   │ │  SUN   │
│   18   │ │   19   │ │   20   │
│  JUL   │ │  JUL   │ │  JUL   │
└────────┘ └────────┘ └────────┘
```

Selecting a date displays only the slots belonging to that day.

---

 Slot Availability

Example:

```text
Available Time Slots

09:00 - 09:30      5 left
09:30 - 10:00      3 left
10:00 - 10:30      2 left

11:00 - 11:30      BOOKED
11:30 - 12:00      BOOKED
```

Booked slots are disabled.

Available slots can be selected before proceeding to final confirmation.

---

 Event Images

Event images are stored using AWS S3.

The event stores an image reference:

```ts
imageUrl
```

The application can serve the image through:

```http
GET /api/events/[id]/image
```

This route:

1. Connects to MongoDB.
2. Finds the event.
3. Reads the event image reference.
4. Downloads the image from S3.
5. Returns the image to the browser.

Caching is controlled so updated event images can appear correctly after administrators change them.

---

 Event Editing

Administrators can edit an event from:

```text
/admin/eventmanagement/[id]/edit
```

Editable information includes:

```text
Event Name
Event Type
Booking Form Template
Venue
Description
Event Image
Number of Days
Start Date
End Date
Daily Schedule
Slot Duration
Slot Gap
Lunch Break
Capacity
```

The event update request uses:

```http
PUT /api/events/[id]
```

The updated registration template is stored in MongoDB and then used by the public booking page.

---

 Event Creation

New events can be created from:

```text
/admin/eventmanagement/new
```

The general flow is:

```text
Create Event
     ↓
Basic Information
     ↓
Choose Event Type
     ↓
Choose Booking Template
     ↓
Upload Image
     ↓
Choose Number of Days
     ↓
Configure Schedule
     ↓
Configure Slots
     ↓
Configure Capacity
     ↓
Save Event
```

---

 Admin Authentication

Protected admin routes verify the administrator session before rendering.

Authentication helpers are located in:

```text
lib/admin-auth.ts
```

If the administrator is not authenticated, protected routes redirect to:

```text
/admin/login
```

---

 Responsive Admin Layout

The admin interface supports desktop, tablet, and mobile screens.

Desktop:

```text
┌───────────────┬───────────────────────────────┐
│               │                               │
│    Sidebar    │         Main Content          │
│               │                               │
│               │                               │
└───────────────┴───────────────────────────────┘
```

Mobile:

```text
┌───────────────────────────────┐
│ SSI Maya Connect             │
├───────────────────────────────┤
│                               │
│         Main Content          │
│                               │
└───────────────────────────────┘
```

The mobile navigation can use a slide-in drawer rather than keeping the desktop sidebar visible.

---

 UI / UX Direction

The interface follows a clean and professional design direction.

The goal is to avoid overly decorative or artificial-looking dashboard designs.

Design principles include:

```text
Clean typography
Neutral backgrounds
SSI brand colors
Limited accent colors
Clear information hierarchy
Consistent spacing
Subtle shadows
Simple borders
Responsive layouts
Large touch targets
Accessible forms
Clear primary actions
Minimal visual noise
```

---

 Responsive Design

The application is designed for:

```text
Mobile
Tablet
Laptop
Desktop
Large Desktop
```

Registration forms use:

```text
Mobile
↓
Single Column
```

and:

```text
Tablet / Desktop
↓
Two Columns
```

Time slots can also adapt their column count according to available screen width.

---

 API Routes

## Get Events

```http
GET /api/events
```

Returns available events.

---

## Create Event

```http
POST /api/events
```

Creates a new event.

---

## Get Event

```http
GET /api/events/[id]
```

Returns information about a specific event.

---

## Update Event

```http
PUT /api/events/[id]
```

Updates an existing event.

---

## Delete Event

```http
DELETE /api/events/[id]
```

Deletes an event.

---

## Get Event Image

```http
GET /api/events/[id]/image
```

Returns an event image stored in S3.

---

## Get Event Slots

```http
GET /api/events/[id]/slots
```

Returns real time-slot information for an event.

---

 Database Architecture

The basic relationship is:

```text
Event
 │
 ├──── DaySchedule
 │        │
 │        ├──── Slot
 │        ├──── Slot
 │        ├──── Slot
 │        └──── Slot
 │
 ├──── DaySchedule
 │        │
 │        ├──── Slot
 │        ├──── Slot
 │        └──── Slot
 │
 └──── DaySchedule
          │
          ├──── Slot
          └──── Slot
```

Each DaySchedule belongs to an Event.

Each Slot belongs to an Event and a DaySchedule.

---

 Booking Safety

The frontend must never be the final authority for slot availability.

For example, a user may see:

```text
1 slot left
```

but another user could reserve it before the first user confirms.

Therefore, final booking confirmation must validate availability again on the server.

The final backend flow should be:

```text
Receive Booking Request
        ↓
Validate Event
        ↓
Validate Slot
        ↓
Check Capacity
        ↓
Atomically Reserve Slot
        ↓
Create Booking
        ↓
Return Confirmation
```

MongoDB should perform the capacity check and update atomically to prevent overbooking.

---

 Remaining Development

The core event and slot infrastructure is in place.

The next major areas are:

### Final Booking System

Create:

```http
POST /api/bookings
```

This API should:

```text
Receive registration details
Receive selected slot
Validate event
Validate slot
Check capacity
Reserve capacity
Create booking
Return booking confirmation
```

### Booking Model

A future Booking model can contain:

```ts
eventId
dayScheduleId
slotId

bookingFormTemplate

designation
title
fullName
specialty

mobile
countryCode
email

hospitalName

country
state
city

bookingStatus

createdAt
updatedAt
```

### Booking Confirmation

After successful booking:

```text
Booking Confirmed
```

The confirmation page can display:

```text
Booking ID
Attendee Name
Event Name
Date
Time
Venue
Ticket
QR Code
```

---

 Future Admin Modules

The admin navigation provides the foundation for additional modules.

## Bookings

Future functionality:

```text
View bookings
Search bookings
Filter by event
Filter by date
View selected slots
Booking status
Cancel booking
```

## Attendees

Future functionality:

```text
Attendee list
Search attendees
Event filtering
Registration details
Export attendees
```

## Check-in

Future functionality:

```text
QR scanning
Ticket validation
Check-in
Check-in timestamp
Attendance status
```

## Reports & Export

Future functionality:

```text
Event registrations
Slot utilization
Daily registrations
Attendance
No-shows
CSV export
Excel export
```

---

 Data-Driven Architecture

The project follows this approach:

```text
ADMIN
  ↓
Create / Edit Event
  ↓
API
  ↓
MongoDB
  ↓
Public Event API
  ↓
USER INTERFACE
```

Event information should not be hardcoded in the frontend.

For example:

```text
Admin changes booking template
        ↓
MongoDB updated
        ↓
Booking page fetches event
        ↓
Correct template rendered
```

The same approach applies to:

```text
Images
Dates
Venue
Description
Schedules
Capacity
Time Slots
Event Status
```

---

 Realtime Updates

The project includes a realtime refresh layer.

 When running with `npm run dev` or `npm start`, the custom Node server uses Socket.IO for immediate broadcasts. Vercel does not keep a persistent custom Node server for App Router functions, so the browser automatically falls back to a lightweight `/api/realtime` change feed every five seconds. This fallback compares event versions and refreshes only the affected screens, allowing deployed event changes to appear without a page refresh.

Example component:

```text
components/realtime/RealtimeProvider.tsx
```

Event changes can trigger actions such as:

```text
created
updated
deleted
```

This allows management screens to refresh after event mutations.

---

 Local Development

Clone the repository:

```bash
git clone <repository-url>
```

Enter the project:

```bash
cd ssimayaconnect
```

Install dependencies:

```bash
npm install
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

 Environment Variables

Create:

```text
.env.local
```

Environment configuration may include:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# AWS
AWS_REGION=your_aws_region
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name

# Authentication
ADMIN_SECRET=your_secret
```

Use the exact variable names expected by the project's implementation.

---

 Security

Never commit:

```text
.env
.env.local
AWS credentials
MongoDB passwords
API keys
Authentication secrets
```

Make sure `.gitignore` contains:

```gitignore
.env
.env.local
.env.*.local
```

---

 Production Checklist

Before deploying:

- [ ] Verify MongoDB connection
- [ ] Verify AWS S3 configuration
- [ ] Verify environment variables
- [ ] Verify admin authentication
- [ ] Verify protected admin routes
- [ ] Verify event creation
- [ ] Verify event editing
- [ ] Verify template updates
- [ ] Verify event image updates
- [ ] Verify event deletion
- [ ] Verify multi-day schedules
- [ ] Verify generated slots
- [ ] Verify capacity calculation
- [ ] Verify fully booked slots
- [ ] Verify mobile responsiveness
- [ ] Verify tablet responsiveness
- [ ] Verify desktop responsiveness
- [ ] Implement final atomic booking API
- [ ] Prevent booking over-capacity
- [ ] Add booking confirmation
- [ ] Add production logging/error monitoring

---

 Current Development Progress

### Completed

- [x] Next.js application structure
- [x] MongoDB integration
- [x] Mongoose models
- [x] AWS S3 image integration
- [x] Admin authentication
- [x] Protected admin layout
- [x] Responsive admin interface
- [x] Responsive sidebar/navigation
- [x] Event management
- [x] Event creation
- [x] Event editing
- [x] Event deletion
- [x] Event image upload
- [x] Event image updating
- [x] Event type selection
- [x] Dynamic booking template selection
- [x] Multi-day scheduling
- [x] Slot generation
- [x] Slot capacity
- [x] Event status
- [x] Public event pages
- [x] Event detail page
- [x] Dynamic booking forms
- [x] Faculty / Delegate support
- [x] Country selector
- [x] International calling codes
- [x] State / Province loading
- [x] Responsive registration forms
- [x] Time-slot selection UI
- [x] Database-backed time slots
- [x] Remaining capacity display
- [x] Fully booked states

### Next Phase

- [ ] Booking database model
- [ ] Final booking API
- [ ] Atomic capacity reservation
- [ ] Booking confirmation page
- [ ] Ticket generation
- [ ] QR code
- [ ] My Tickets
- [ ] Admin bookings
- [ ] Attendee management
- [ ] Check-in system
- [ ] Reports
- [ ] CSV / Excel export

---

 Overall Application Flow

```text
                     SSI MAYA CONNECT
                            │
             ┌──────────────┴──────────────┐
             │                             │
           ADMIN                          USER
             │                             │
       Admin Login                    Landing Page
             │                             │
       Admin Dashboard                Browse Events
             │                             │
      Event Management                Event Details
             │                             │
      Create/Edit Event                Book Tickets
             │                             │
      Choose Template              Registration Form
             │                             │
      Upload Image               Continue to Time Slots
             │                             │
     Configure Schedule              Select Date
             │                             │
      Generate Slots                 Select Slot
             │                             │
          MongoDB               Confirm Booking
             │                             │
             └─────────────────────────────┘
                            │
                       Booking Data
                            │
                         MongoDB
```

---

 Project Goal

The goal of **SSI Maya Connect** is to provide SSI with one centralized platform for managing:

- Events
- Conferences
- Mantram sessions
- Registrations
- Scheduling
- Time slots
- Bookings
- Tickets
- Attendees
- Check-ins
- Reports

The platform is being developed around reusable components, dynamic database-driven content, responsive interfaces, and scalable APIs so that additional event types, booking templates, and administrative modules can be introduced without rebuilding the entire system.

---

 Development Guidelines

When continuing development:

1. Avoid hardcoded event information.
2. Fetch event information from MongoDB.
3. Keep booking availability server-controlled.
4. Never trust client-side slot capacity.
5. Keep event images in the existing S3 architecture.
6. Reuse existing Event, DaySchedule, and Slot models.
7. Keep registration templates reusable.
8. Maintain responsive behavior.
9. Keep the SSI visual identity consistent.
10. Validate all critical operations on the backend.
11. Prevent duplicate or over-capacity bookings.
12. Keep TypeScript types synchronized with database models.
13. Keep API responses consistent.
14. Handle loading and error states.
15. Test mobile and desktop interfaces before merging.

---

# SSI Maya Connect

**Event Management • Registration • Scheduling • Booking**

Built as a centralized digital event-management platform for SSI.