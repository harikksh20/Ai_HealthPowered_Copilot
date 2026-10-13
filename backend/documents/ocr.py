
import re
from pathlib import Path

from pypdf import PdfReader
from PIL import Image
import pytesseract


# --------------------------------------------------
# 1. Extract text from PDF and image files
# --------------------------------------------------

def extract_text(path):
    path = Path(path)
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        reader = PdfReader(str(path))
        text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        ).strip()

        if not text:
            raise ValueError(
                "No selectable text found in this PDF. "
                "It may be scanned and require image-based OCR."
            )

        return text

    image_extensions = {
        ".png", ".jpg", ".jpeg", ".webp",
        ".tif", ".tiff", ".bmp",
    }

    if suffix in image_extensions:
        with Image.open(path) as image:
            return pytesseract.image_to_string(
                image,
                config="--psm 6",
            ).strip()

    raise ValueError(
        "Unsupported file type. Upload a PDF, JPG, PNG, "
        "WEBP, TIFF, or BMP file."
    )


# --------------------------------------------------
# 2. Recognize supported laboratory test names
# --------------------------------------------------

TEST_PATTERNS = [
    (
        r"hemoglobin|haemoglobin",
        "Hemoglobin",
    ),
    (
        r"total\s+(?:rbc|red\s+blood\s+cell)\s+count"
        r"|(?<!\w)rbc(?!\w)",
        "Total RBC Count",
    ),
    (
        r"total\s+(?:wbc|white\s+blood\s+cell)\s+count"
        r"|(?<!\w)wbc(?!\w)",
        "Total WBC Count",
    ),
    (
        r"packed\s+cell\s+v\s*olume"
        r"|(?<!\w)pcv(?!\w)",
        "Packed Cell Volume",
    ),
    (
        r"platelet\s+count",
        "Platelet Count",
    ),
    (
        r"neutrophils?",
        "Neutrophils",
    ),
    (
        r"lymphocytes?",
        "Lymphocytes",
    ),
    (
        r"vitamin\s+d",
        "Vitamin D",
    ),
    (
        r"fasting\s+blood\s+sugar",
        "Fasting Blood Sugar",
    ),
    (
        r"glucose",
        "Glucose",
    ),
    (
        r"creatinine",
        "Creatinine",
    ),
    (
        r"tsh",
        "TSH",
    ),
]


# --------------------------------------------------
# 3. Match numeric values and common laboratory units
# --------------------------------------------------

NUMBER = r"[<>≤≥]?\s*\d+(?:[.,]\d+)?"

UNIT = (
    r"(?:"
    r"g\s*/\s*dL"
    r"|mg\s*/\s*dL"
    r"|mg\s*/\s*L"
    r"|ng\s*/\s*mL"
    r"|mIU\s*/\s*L"
    r"|uIU\s*/\s*mL"
    r"|cells\s*/\s*(?:µ|μ|u)?L"
    r"|cells\s*/\s*cmm"
    r"|million\s*/\s*cmm"
    r"|lakh\s*/\s*(?:µ|μ|u)?L"
    r"|mmol\s*/\s*L"
    r"|%"
    r")"
)


# --------------------------------------------------
# 4. Parse laboratory observations from extracted text
# --------------------------------------------------

def parse_observations(text):
    results = []
    seen = set()

    for line in text.splitlines():
        clean = re.sub(r"\s+", " ", line).strip()

        if not clean:
            continue

        for test_pattern, canonical in TEST_PATTERNS:
            pattern = (
                rf"(?<!\w)(?:{test_pattern})(?!\w)"
                rf"\s*[:=\-]?\s*"
                rf"(?P<value>{NUMBER})"
                rf"\s*"
                rf"(?P<unit>{UNIT})?"
                rf"(?=\s|$|[,;])"
            )

            match = re.search(
                pattern,
                clean,
                flags=re.IGNORECASE,
            )

            if not match:
                continue

            value = re.sub(
                r"\s+", "", match.group("value")
            ).replace(",", ".")

            unit = re.sub(
                r"\s+", "", match.group("unit") or ""
            )

            identity = (canonical, value, unit)

            if identity in seen:
                continue

            seen.add(identity)

            results.append({
                "test_name": canonical,
                "value": value,
                "unit": unit,
                "reference_range": "",
                "flag": "review",
            })

    return results




def parse_medications(text):
    """Extract medication candidates from line-based prescription text."""
    if not isinstance(text, str) or not text.strip():
        return []

    lines = [
        re.sub(r"\s+", " ", line).strip(" \t-•*")
        for line in text.splitlines()
    ]
    lines = [line for line in lines if line]

    dosage_re = re.compile(
        r"^\d+(?:\.\d+)?\s*(?:mg|mcg|µg|g|ml|mL|IU|units?)$",
        re.IGNORECASE,
    )
    frequency_re = re.compile(
        r"^(?:once daily|twice daily|three times daily|"
        r"four times daily|once a day|twice a day|"
        r"every \d+ hours?|OD|BD|BID|TDS|TID|QID|QHS|SOS|PRN)$",
        re.IGNORECASE,
    )
    duration_re = re.compile(
        r"^\d+\s*(?:days?|weeks?|months?)$",
        re.IGNORECASE,
    )

    ignored = {
        "wellnest — sample prescription",
        "fictional test document — not valid for medical use",
        "patient: alex sample (fictional)",
        "prescriber: example clinic",
        "medication details",
        "medicine name",
        "dosage",
        "frequency",
        "duration",
        "example instructions",
        "testing note",
    }

    results = []
    i = 0

    while i < len(lines):
        name = lines[i].strip()

        if name.casefold() in ignored or ":" in name:
            i += 1
            continue

        # A candidate name must be followed by a dosage line.
        if i + 1 >= len(lines) or not dosage_re.fullmatch(lines[i + 1]):
            i += 1
            continue

        dosage = lines[i + 1]
        frequency = ""
        duration = ""
        instructions = ""

        if i + 2 < len(lines) and frequency_re.fullmatch(lines[i + 2]):
            frequency = lines[i + 2]

        if i + 3 < len(lines) and duration_re.fullmatch(lines[i + 3]):
            duration = lines[i + 3]

        results.append({
            "medicine_name": name,
            "dosage": dosage,
            "frequency": frequency,
            "duration": duration,
            "instructions": "",
            "needs_review": True,
        })

        i += 2
        if frequency:
            i += 1
        if duration:
            i += 1

    # Attach separate example instruction lines to matching medicines.
    for line in lines:
        match = re.match(
            r"^([A-Za-z][A-Za-z0-9 -]*?)\s*[—–-]\s*"
            r"(?:Example instruction:\s*)?(.*)$",
            line,
            re.IGNORECASE,
        )
        if not match:
            continue

        name = match.group(1).strip().casefold()
        instruction = match.group(2).strip().rstrip(".")

        for medication in results:
            if medication["medicine_name"].casefold() == name:
                medication["instructions"] = instruction
                break

    return results

