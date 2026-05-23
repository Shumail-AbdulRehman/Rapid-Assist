# Roadside Assistance Platform

Full-stack roadside assistance platform inspired by the InDrive service-bidding flow.

## Stack

- Web: React + Vite
- Mobile: React Native + Expo
- API: Node.js + Express
- Database: PostgreSQL

## Apps

- `apps/web`: React dashboard for users and providers
- `apps/mobile`: Expo app for the same flows on mobile
- `server`: Express API with PostgreSQL queries

## Core product flow

1. User or provider registers.
2. User logs in and creates a roadside request.
3. Nearby providers within a 4 km discovery radius can view the request.
4. Providers send price offers.
5. User accepts an offer and can track the provider.
6. Requests beyond 7 km apply additional charges.

## Quick start

1. Create a PostgreSQL database, for example `roadside_app`.
2. Run the SQL in `server/sql/schema.sql`.
3. Copy `server/.env.example` to `server/.env`.
4. Install dependencies:

```bash
npm install
```

5. Start the backend:

```bash
npm run dev:server
```

6. Start the web app:

```bash
npm run dev:web
```

7. Start the Expo app:

```bash
npm run dev:mobile
```

## Environment notes

- Web API base URL defaults to `http://localhost:4000/api`
- Mobile API base URL defaults to `http://192.168.100.8:4000/api`
- Update the Expo URL in `apps/mobile/src/config.js` to your machine IP for physical-device testing

## Features implemented

- Role-based registration and login for users and providers
- Provider profile onboarding fields for CNIC, workshop, certificates, history, and reviews
- Local image uploads through the backend into `server/uploads`
- Service request creation with description, vehicle number, and geolocation
- Nearby provider filtering using a Haversine distance calculation
- Offer creation and acceptance workflow
- Extra distance charge calculation beyond 7 km
- OpenStreetMap map views on web and mobile
- Basic provider live-location update endpoint and request tracking UI

## Maps choice

The project uses free OpenStreetMap tiles with Leaflet on the web app. The Expo app uses a WebView-based Leaflet map so it follows the same tile source and does not require a paid Google Maps key for this stage.

## Local uploads

- Uploaded images are stored in `server/uploads`
- The upload API route is `POST /api/uploads/image`
- Returned file URLs are then saved in the registration data for profile and workshop images
