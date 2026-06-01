# Rapid Assist API Test Report

Generated: 01/06/2026, 12:55:57 pm

Overall: PASS

- Requests: 55
- Passed: 55
- Failed: 0
- Runner: Generated Postman collection executed by Newman
- Base URL: http://localhost:4000

## Notes

Mounted Express routes were tested end-to-end. The repository contains `requestRoutes.js`, but it is not mounted in `server/src/app.js`; those declared legacy endpoints were probed and returned 404.

## Endpoint Status Matrix

| # | Status | Test | Endpoint | Expected | Actual | Duration | Response summary |
|---|---|---|---|---:|---:|---:|---|
| 1 | PASS | Health check | `GET /api/health` | 200 | 200 | 46 ms | Roadside assistance API is running |
| 2 | PASS | List services | `GET /api/services` | 200 | 200 | 7 ms | 3 item(s) |
| 3 | PASS | Register validation failure | `POST /api/auth/register` | 400 | 400 | 16 ms | role, name, phone and password are required |
| 4 | PASS | Register customer | `POST /api/auth/register` | 201 | 201 | 165 ms | Registration successful |
| 5 | PASS | Login customer | `POST /api/auth/login` | 200 | 200 | 153 ms | token, user |
| 6 | PASS | Login fuel provider | `POST /api/auth/login` | 200 | 200 | 157 ms | token, user |
| 7 | PASS | Login towing provider | `POST /api/auth/login` | 200 | 200 | 151 ms | token, user |
| 8 | PASS | Login mechanic provider | `POST /api/auth/login` | 200 | 200 | 144 ms | token, user |
| 9 | PASS | Get current customer profile | `GET /api/auth/me` | 200 | 200 | 13 ms | user |
| 10 | PASS | Update customer profile | `PATCH /api/auth/me` | 200 | 200 | 14 ms | token, user |
| 11 | PASS | Get provider profile | `GET /api/auth/me` | 200 | 200 | 9 ms | user |
| 12 | PASS | Update provider profile | `PATCH /api/auth/me` | 200 | 200 | 17 ms | token, user |
| 13 | PASS | Upload image validation failure | `POST /api/uploads/image` | 400 | 400 | 2 ms | Image file is required |
| 14 | PASS | Upload image | `POST /api/uploads/image` | 201 | 201 | 2760 ms | Upload successful |
| 15 | PASS | Provider cannot create customer order | `POST /api/orders` | 403 | 403 | 2 ms | Forbidden |
| 16 | PASS | Create fuel order | `POST /api/orders` | 201 | 201 | 50 ms | order.status=open |
| 17 | PASS | Update fuel provider location | `PATCH /api/orders/provider/location` | 200 | 200 | 12 ms | Provider location updated |
| 18 | PASS | List open orders for fuel provider | `GET /api/orders/open?latitude=31.5205&longitude=74.3588&radiusKm=300` | 200 | 200 | 15 ms | 1 item(s) |
| 19 | PASS | Accept fuel order | `POST /api/orders/{{fuelOrderId}}/accept` | 200 | 200 | 30 ms | Order accepted |
| 20 | PASS | Get customer active fuel order | `GET /api/orders/mine/active` | 200 | 200 | 13 ms | order.status=assigned |
| 21 | PASS | Get fuel order details | `GET /api/orders/{{fuelOrderId}}` | 200 | 200 | 13 ms | order.status=assigned |
| 22 | PASS | Mark fuel provider arrived | `POST /api/orders/{{fuelOrderId}}/arrive` | 200 | 200 | 20 ms | Arrival marked |
| 23 | PASS | Start fuel order | `POST /api/orders/{{fuelOrderId}}/start` | 200 | 200 | 21 ms | Order progress updated |
| 24 | PASS | Mark fuel delivered | `POST /api/orders/{{fuelOrderId}}/fuel-delivered` | 200 | 200 | 16 ms | Fuel marked as delivered |
| 25 | PASS | Customer confirms fuel delivery | `POST /api/orders/{{fuelOrderId}}/fuel-confirm` | 200 | 200 | 14 ms | Fuel delivery confirmed |
| 26 | PASS | Customer confirms fuel payment | `POST /api/orders/{{fuelOrderId}}/payment/customer-confirm` | 200 | 200 | 14 ms | Customer payment confirmation saved |
| 27 | PASS | Provider confirms fuel payment | `POST /api/orders/{{fuelOrderId}}/payment/provider-confirm` | 200 | 200 | 12 ms | Provider payment confirmation saved |
| 28 | PASS | Create towing order | `POST /api/orders` | 201 | 201 | 31 ms | order.status=open |
| 29 | PASS | Update towing provider location | `PATCH /api/orders/provider/location` | 200 | 200 | 13 ms | Provider location updated |
| 30 | PASS | Accept towing order | `POST /api/orders/{{towingOrderId}}/accept` | 200 | 200 | 29 ms | Order accepted |
| 31 | PASS | Mark towing provider arrived | `POST /api/orders/{{towingOrderId}}/arrive` | 200 | 200 | 14 ms | Arrival marked |
| 32 | PASS | Start towing transit | `POST /api/orders/{{towingOrderId}}/start` | 200 | 200 | 12 ms | Order progress updated |
| 33 | PASS | Raise towing SOS | `POST /api/orders/{{towingOrderId}}/sos` | 200 | 200 | 12 ms | SOS alert recorded |
| 34 | PASS | Complete towing order | `POST /api/orders/{{towingOrderId}}/complete` | 200 | 200 | 14 ms | Order completed |
| 35 | PASS | Customer confirms towing payment | `POST /api/orders/{{towingOrderId}}/payment/customer-confirm` | 200 | 200 | 14 ms | Customer payment confirmation saved |
| 36 | PASS | Provider confirms towing payment | `POST /api/orders/{{towingOrderId}}/payment/provider-confirm` | 200 | 200 | 16 ms | Provider payment confirmation saved |
| 37 | PASS | Create mechanic order | `POST /api/orders` | 201 | 201 | 27 ms | order.status=open |
| 38 | PASS | Update mechanic provider location | `PATCH /api/orders/provider/location` | 200 | 200 | 9 ms | Provider location updated |
| 39 | PASS | Accept mechanic order | `POST /api/orders/{{mechanicOrderId}}/accept` | 200 | 200 | 18 ms | Order accepted |
| 40 | PASS | Mark mechanic arrived | `POST /api/orders/{{mechanicOrderId}}/arrive` | 200 | 200 | 12 ms | Arrival marked |
| 41 | PASS | Submit mechanic extra work request | `POST /api/orders/{{mechanicOrderId}}/extra-work` | 201 | 201 | 19 ms | Extra work request submitted |
| 42 | PASS | Customer responds to extra work request | `POST /api/orders/{{mechanicOrderId}}/extra-work/{{extraWorkRequestId}}/respond` | 200 | 200 | 24 ms | Extra work response submitted |
| 43 | PASS | Complete mechanic order | `POST /api/orders/{{mechanicOrderId}}/complete` | 200 | 200 | 16 ms | Order completed |
| 44 | PASS | Customer confirms mechanic payment | `POST /api/orders/{{mechanicOrderId}}/payment/customer-confirm` | 200 | 200 | 14 ms | Customer payment confirmation saved |
| 45 | PASS | Provider confirms mechanic payment | `POST /api/orders/{{mechanicOrderId}}/payment/provider-confirm` | 200 | 200 | 19 ms | Provider payment confirmation saved |
| 46 | PASS | Customer order history | `GET /api/orders/history` | 200 | 200 | 18 ms | 3 item(s) |
| 47 | PASS | Provider order history | `GET /api/orders/history` | 200 | 200 | 11 ms | 1 item(s) |
| 48 | PASS | Unauthorized order history | `GET /api/orders/history` | 401 | 401 | 2 ms | Missing bearer token |
| 49 | PASS | Invalid order id | `GET /api/orders/not-a-valid-id` | 400 | 400 | 2 ms | Invalid order id |
| 50 | PASS | Legacy create request route is unmounted | `POST /api/requests` | 404 | 404 | 3 ms | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot POST /api/requests</pre> </body> </html>  |
| 51 | PASS | Legacy nearby requests route is unmounted | `GET /api/requests/nearby?latitude=31.5204&longitude=74.3587&radiusKm=4` | 404 | 404 | 3 ms | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot GET /api/requests/nearby</pre> </body> </html>  |
| 52 | PASS | Legacy request details route is unmounted | `GET /api/requests/{{fakeObjectId}}` | 404 | 404 | 2 ms | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot GET /api/requests/64f000000000000000000001</pre>  |
| 53 | PASS | Legacy create offer route is unmounted | `POST /api/requests/offers` | 404 | 404 | 4 ms | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot POST /api/requests/offers</pre> </body> </html>  |
| 54 | PASS | Legacy accept offer route is unmounted | `POST /api/requests/offers/{{fakeObjectId}}/accept` | 404 | 404 | 5 ms | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot POST /api/requests/offers/64f00000000000000000000 |
| 55 | PASS | Legacy provider location route is unmounted | `PATCH /api/requests/provider/location` | 404 | 404 | 2 ms | <!DOCTYPE html> <html lang="en"> <head> <meta charset="utf-8"> <title>Error</title> </head> <body> <pre>Cannot PATCH /api/requests/provider/location</pre> </bod |
