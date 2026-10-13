# Wellnest Full-stack Hackathon Starter

Includes:
- `frontend/`: React + Vite multilingual dashboard
- `backend/`: Django REST API, SQLite storage, document upload and starter OCR extraction

## 1. Run the backend (Windows / VS Code)

Open a terminal in the `backend` folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py makemigrations documents
python manage.py migrate
python manage.py runserver
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, then activate again.

Test: http://127.0.0.1:8000/api/health/

## 2. Install Tesseract for image OCR

Python's `pytesseract` package is only a wrapper; the Tesseract OCR application must also be installed on Windows and available on PATH. Restart VS Code after installing it. Without Tesseract, image extraction returns an error. The starter reads embedded text from PDFs; scanned PDFs need PDF-to-image OCR added.

## 3. Run the frontend

Open a second terminal in `frontend`:

```powershell
npm install
npm run dev
```

Frontend expects API at `http://127.0.0.1:8000`. To override, copy `.env.example` to `.env` and set `VITE_API_BASE_URL`. Restart Vite after changing `.env`.

## 4. Test flow

1. Open the frontend URL shown by Vite.
2. Click Upload a health record and choose a text-based PDF or a clear image.
3. After upload succeeds, open that record using the arrow at the end of its row.
4. Click **Run OCR extraction**.
5. Inspect the extracted observations and compare every value with the source document.

API:
- `GET /api/health/`
- `GET /api/documents/`
- `POST /api/documents/` multipart field `file`
- `POST /api/documents/<id>/extract/`
- `GET /api/documents/<id>/observations/`

## Important limitations

- The extraction parser is a hackathon starter, not clinical-grade OCR. It recognises only selected common lab test names and can miss values or misread text.
- `pypdf` extracts embedded text only. Scanned PDFs need a PDF-to-image OCR pipeline.
- This does not generate AI medical summaries or translate OCR output. Those are separate backend features.
- No authentication is included. Do not upload real patient records to a public deployment. Use synthetic/demo data for the hackathon until authentication, authorisation, consent, secure storage and auditing are implemented.
- Do not use extracted output for diagnosis or treatment. Always verify against the original and consult a clinician.
