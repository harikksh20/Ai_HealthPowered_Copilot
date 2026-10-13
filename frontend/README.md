# Wellnest — frontend upgrade

This is a React/Vite prototype for a multilingual personal health record dashboard. It uses ordinary, editable React components and CSS, with translations maintained in `src/translations.js`.

## Start locally

```bash
npm install
npm run dev
```

## Languages

The language selector currently translates the main dashboard copy into English, Tamil, Hindi and Telugu. Review clinical translations with fluent speakers before using them with real patients. This UI translation does not automatically translate OCR output or AI-generated summaries; those require backend support.

## Backend assumptions

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`. The frontend expects:
- `GET /api/documents/` to return an array or an object with `results` or `documents`.
- `POST /api/documents/` to accept multipart form data with a `file` field.

Update the paths and mappings in `src/App.jsx` to match your Django API. Start your backend, configure CORS and verify the response shape. This frontend does not itself perform OCR, diagnosis or AI medical interpretation.

## Demo safety

Visible sample records and the Vitamin D example are illustrative only. They must not be presented as patient-specific analysis. Do not expose API keys in frontend code. For production, add authentication, authorization, consent, secure storage, audit logs, and clinician-reviewed safety requirements.
