# LEVEL X Gaming Arena

Multi-page starter website with Home, Booking, Game Vault, Tournaments and Contact pages.

## 1. Requirements
- Node.js 18 or newer
- A Supabase project

## 2. Install
```bash
npm install
```

## 3. Database
In Supabase, open **SQL Editor**, paste all of `supabase-schema.sql`, and run it.

## 4. Environment
Copy `.env.example` to `.env`. Fill in:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never put this in frontend code)
- `ADMIN_TOKEN` (long random secret)
- `RATE_SOLO`, `RATE_DUO`, `RATE_THRICE`, `RATE_SQUAD` with actual INR hourly rates

Do not deploy while package rates are zero. Do not share or commit `.env`.

## 5. Run locally
```bash
npm start
```
Open http://localhost:3000

## 6. Payment flow
The booking page displays the supplied UPI QR and `9168310367@ptsbi`. Customer enters the UTR/reference after paying. The booking is created as `pending_verification`; the server does not automatically trust a UTR or mark payment successful. Check the payment in your UPI/bank app before confirming.

Admin verification API:
```http
PATCH /api/admin/bookings/BOOKING_UUID
x-admin-token: YOUR_ADMIN_TOKEN
Content-Type: application/json

{"status":"confirmed"}
```
Use `{"status":"rejected"}` to reject. This is an API starter, not a full admin dashboard.

## 7. Important before going live
- Enter real package rates in `.env`.
- Test bookings and station conflict handling.
- Add stronger abuse protection (rate limiting, CAPTCHA, request validation) before public launch.
- Set up HTTPS and backups.
- The sample tournament content is placeholder announcement content.
- Existing project files/database may differ. Back up your current project and database before replacing anything.
