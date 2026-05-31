# Roadside Assistance Platform

Full-stack roadside assistance platform inspired by the InDrive service-bidding flow.

## Stack

- Web: React + Vite
- Mobile: React Native + Expo
- API: Node.js + Express
- Database: MongoDB + Mongoose

## Apps

- `apps/web`: React dashboard for users and providers
- `apps/mobile`: Expo app for the same flows on mobile
- `server`: Express API with Mongoose models

## Core product flow

1. User or provider registers.
2. User logs in and creates a roadside request.
3. Nearby providers within a 4 km discovery radius can view the request.
4. Providers send price offers.
5. User accepts an offer and can track the provider.
6. Requests beyond 7 km apply additional charges.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy `server/.env.example` to `server/.env`.

3. Start MongoDB locally with Docker:

```bash
npm run db:up
```

This starts a `mongo:7` container named `roadside-mongodb`. Database files are stored in the Docker named volume `roadside_mongo_data`, so data persists when the container is stopped or recreated.

4. Start the backend:

```bash
npm run dev:server
```

5. Start the web app:

```bash
npm run dev:web
```

6. Start the Expo app:

```bash
npm run dev:mobile
```

## Local MongoDB commands

- `npm run db:up`: start the local MongoDB container
- `npm run db:down`: stop MongoDB without deleting stored data
- `npm run db:logs`: follow MongoDB container logs
- `npm run db:shell`: open `mongosh` connected to the `roadside_app` database
- `npm run db:seed:demo`: upsert demo users and providers into local MongoDB

## Demo accounts

Seed demo accounts after MongoDB is running:

```bash
npm run db:seed:demo
```

All demo accounts use password `Demo@123`.

- Customer: `03000000001`
- Fuel provider: `03000000002`
- Towing provider: `03000000003`
- Mechanic provider: `03000000004`

## Moving existing Atlas data

Start the local Docker database first:

```bash
npm run db:up
```

Then use MongoDB Database Tools to export Atlas and restore into the local Docker MongoDB instance:

```bash
mkdir -p mongo-dumps
mongodump --uri "mongodb+srv://USER:PASSWORD@CLUSTER/roadside_app" --archive=mongo-dumps/atlas.archive --gzip
mongorestore --uri "mongodb://127.0.0.1:27017" --archive=mongo-dumps/atlas.archive --gzip --drop
```

The `--drop` flag replaces matching local collections with the Atlas data. Remove it if you want to merge into existing local collections instead.

## Environment notes

- Web API base URL defaults to `http://localhost:4000/api`
- Mobile API base URL defaults to `http://192.168.100.8:4000/api`
- Update the Expo URL in `apps/mobile/src/config.js` to your machine IP for physical-device testing
- API MongoDB URL defaults to Docker MongoDB at `mongodb://127.0.0.1:27017/roadside_app`
- Default service records are seeded automatically when the backend starts

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
