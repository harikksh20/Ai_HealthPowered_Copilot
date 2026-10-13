
import logging
from pathlib import Path

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import (
    MedicalDocument,
    Observation,
    Medication,
    AISummary,
)
from .serializers import (
    MedicalDocumentSerializer,
    ObservationSerializer,
    MedicationSerializer,
)
from .ocr import extract_text, parse_observations, parse_medications
from .gemini_service import generate_health_summary
from .interpretation import interpret_observation


logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".webp",
    ".tif", ".tiff", ".bmp",
}
MAX_UPLOAD_BYTES = 12 * 1024 * 1024


# --------------------------------------------------
# Health check
# GET /api/health/
# --------------------------------------------------

@api_view(["GET"])
def health(request):
    return Response({
        "status": "ok",
        "service": "Wellnest API",
        "features": [
            "medical-document-upload",
            "ocr-extraction",
            "lab-observations",
            "prescription-medications",
            "ai-summaries",
            "health-timeline",
        ],
    })


# --------------------------------------------------
# List and upload documents
# GET  /api/documents/
# POST /api/documents/
# --------------------------------------------------

@api_view(["GET", "POST"])
@parser_classes([MultiPartParser, FormParser])
def documents(request):
    if request.method == "GET":
        queryset = MedicalDocument.objects.all().order_by(
            "-uploaded_at"
        )
        return Response(
            MedicalDocumentSerializer(
                queryset, many=True
            ).data
        )

    uploaded = request.FILES.get("file")

    if not uploaded:
        return Response(
            {"error": "Upload a file using the 'file' field."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    extension = Path(uploaded.name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        return Response(
            {"error": "Unsupported file type."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if uploaded.size == 0:
        return Response(
            {"error": "The uploaded file is empty."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if uploaded.size > MAX_UPLOAD_BYTES:
        return Response(
            {"error": "File size must not exceed 12 MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    document_type = request.data.get("document_type", "other")
    allowed_types = {
        choice[0] for choice in MedicalDocument.DOCUMENT_TYPES
    }

    if document_type not in allowed_types:
        return Response(
            {"error": "Invalid document_type."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        item = MedicalDocument.objects.create(
            file=uploaded,
            original_name=Path(uploaded.name).name,
            document_type=document_type,
        )

        return Response(
            MedicalDocumentSerializer(item).data,
            status=status.HTTP_201_CREATED,
        )
    except Exception:
        logger.exception("Document upload failed")
        return Response(
            {"error": "The document could not be saved."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# --------------------------------------------------
# Extract document
# POST /api/documents/<document_id>/extract/
# --------------------------------------------------

@api_view(["POST"])
def extract_document(request, document_id):
    item = get_object_or_404(
        MedicalDocument, pk=document_id
    )

    try:
        text = extract_text(item.file.path)

        if not text or not text.strip():
            item.extracted_text = ""
            item.extraction_status = "empty_text"
            item.extraction_error = "No readable text found."
            item.save(update_fields=[
                "extracted_text",
                "extraction_status",
                "extraction_error",
            ])

            return Response({
                "document": MedicalDocumentSerializer(item).data,
                "extracted_text": "",
                "observations": [],
                "medications": [],
                "observations_count": 0,
                "medications_count": 0,
                "message": (
                    "No readable text was found. Check the file "
                    "and OCR configuration."
                ),
            })

        # Prescription and lab results use separate parsers.
        is_prescription = item.document_type == "prescription"

        if is_prescription:
            parsed_medications = parse_medications(text)
            parsed_observations = []
        else:
            parsed_observations = parse_observations(text)
            parsed_medications = []

        # Save text and parsed results in one transaction.
        with transaction.atomic():
            item.extracted_text = text
            item.extraction_status = "completed"
            item.extraction_error = ""
            item.save(update_fields=[
                "extracted_text",
                "extraction_status",
                "extraction_error",
            ])

            if is_prescription:
                # Replace only this prescription's previous
                # medication candidates.
                item.medications.all().delete()

                Medication.objects.bulk_create([
                    Medication(
                        document=item,
                        **medication,
                    )
                    for medication in parsed_medications
                ])
            else:
                # Preserve the existing lab-report workflow.
                item.observations.all().delete()

                Observation.objects.bulk_create([
                    Observation(
                        document=item,
                        **observation,
                    )
                    for observation in parsed_observations
                ])

        item.refresh_from_db()

        observations = item.observations.all()
        medications = item.medications.all()

        observation_data = ObservationSerializer(
            observations, many=True
        ).data

        for observation in observation_data:
            observation["interpretation"] = (
                interpret_observation(observation)
            )

        medication_data = MedicationSerializer(
            medications, many=True
        ).data

        if is_prescription:
            message = (
                "Prescription text extracted. Verify every "
                "medication detail against the original prescription."
                if medication_data else
                "Text extracted, but no medication candidates "
                "were recognized. Review the original prescription."
            )
        else:
            message = (
                "Text extracted. Verify each observation against "
                "the original medical report."
                if observation_data else
                "Text extracted, but no supported lab observations "
                "were recognized."
            )

        return Response({
            "document": MedicalDocumentSerializer(item).data,
            "extracted_text": text[:12000],
            "observations": observation_data,
            "observations_count": len(observation_data),
            "medications": medication_data,
            "medications_count": len(medication_data),
            "message": message,
        }, status=status.HTTP_200_OK)

    except Exception as exc:
        logger.exception(
            "Extraction failed for document %s", item.pk
        )

        item.extraction_status = "failed"
        item.extraction_error = (
            "Document extraction failed. Check server logs."
        )
        item.save(update_fields=[
            "extraction_status",
            "extraction_error",
        ])

        # Expose expected input/configuration errors, not
        # arbitrary internal exception details.
        details = (
            str(exc) if isinstance(exc, ValueError)
            else "Check the file and OCR configuration."
        )

        return Response({
            "error": "Extraction failed.",
            "details": details,
        }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)


# --------------------------------------------------
# Retrieve lab observations
# GET /api/documents/<document_id>/observations/
# --------------------------------------------------

@api_view(["GET"])
def document_observations(request, document_id):
    item = get_object_or_404(
        MedicalDocument, pk=document_id
    )

    data = ObservationSerializer(
        item.observations.all(), many=True
    ).data

    for observation in data:
        observation["interpretation"] = (
            interpret_observation(observation)
        )

    return Response({
        "document": MedicalDocumentSerializer(item).data,
        "observations": data,
        "count": len(data),
    })


# --------------------------------------------------
# Retrieve medication candidates
# GET /api/documents/<document_id>/medications/
# --------------------------------------------------

@api_view(["GET"])
def document_medications(request, document_id):
    item = get_object_or_404(
        MedicalDocument, pk=document_id
    )

    medications = item.medications.all().order_by("id")

    return Response({
        "document_id": item.pk,
        "document_name": item.original_name,
        "medications": MedicationSerializer(
            medications, many=True
        ).data,
        "count": medications.count(),
        "message": (
            "Verify medication names, dosages and instructions "
            "against the original prescription."
        ),
    })


# --------------------------------------------------
# Generate AI health summary
# POST /api/documents/<document_id>/ai-summary/
# --------------------------------------------------

@api_view(["POST"])
def ai_report_summary(request, document_id):
    item = get_object_or_404(
        MedicalDocument, pk=document_id
    )

    if item.extraction_status != "completed":
        return Response(
            {"error": "Extract the document before generating a summary."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    saved_observations = item.observations.all()

    if not saved_observations.exists():
        return Response(
            {
                "error": (
                    "No lab observations were found. "
                    "AI lab summaries require recognized observations."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    observations = list(
        ObservationSerializer(
            saved_observations, many=True
        ).data
    )

    try:
        summary = generate_health_summary(observations)

        if not isinstance(summary, str) or not summary.strip():
            return Response(
                {"error": "The AI service returned an empty summary."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        saved_summary = AISummary.objects.create(
            document=item,
            summary=summary.strip(),
        )

        return Response({
            "document_id": item.pk,
            "summary_id": saved_summary.pk,
            "summary": saved_summary.summary,
            "created_at": saved_summary.created_at,
            "observations_count": len(observations),
            "message": "AI summary generated and saved successfully.",
        })

    except Exception:
        logger.exception(
            "AI summary generation failed for document %s",
            item.pk,
        )
        return Response(
            {
                "error": (
                    "Could not generate the AI summary. "
                    "Check the AI service configuration and retry."
                )
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )


# --------------------------------------------------
# Retrieve saved AI summaries
# GET /api/documents/<document_id>/ai-summaries/
# --------------------------------------------------

@api_view(["GET"])
def saved_ai_summaries(request, document_id):
    item = get_object_or_404(
        MedicalDocument, pk=document_id
    )

    summaries = AISummary.objects.filter(
        document=item
    ).order_by("-created_at")

    return Response({
        "document_id": item.pk,
        "document_name": item.original_name,
        "summaries": [
            {
                "id": summary.pk,
                "summary": summary.summary,
                "created_at": summary.created_at,
            }
            for summary in summaries
        ],
        "count": summaries.count(),
    })


# --------------------------------------------------
# Unified health timeline
# GET /api/timeline/
# --------------------------------------------------

@api_view(["GET"])
def health_timeline(request):
    timeline = []

    documents_qs = MedicalDocument.objects.all().order_by(
        "-uploaded_at"
    )

    for document in documents_qs:
        timeline.append({
            "event_type": "document",
            "date": document.uploaded_at,
            "document_id": document.pk,
            "document_name": document.original_name,
            "document_type": document.document_type,
            "extraction_status": document.extraction_status,
        })

        for observation in document.observations.all():
            timeline.append({
                "event_type": "lab_observation",
                "date": observation.effective_date
                or document.uploaded_at.date(),
                "document_id": document.pk,
                "document_name": document.original_name,
                "test_name": observation.test_name,
                "value": observation.value,
                "unit": observation.unit,
                "reference_range": observation.reference_range,
                "flag": observation.flag,
            })

        for medication in document.medications.all():
            timeline.append({
                "event_type": "medication",
                "date": document.uploaded_at,
                "document_id": document.pk,
                "document_name": document.original_name,
                "medicine_name": medication.medicine_name,
                "dosage": medication.dosage,
                "frequency": medication.frequency,
                "duration": medication.duration,
                "instructions": medication.instructions,
                "needs_review": medication.needs_review,
            })

        for summary in document.ai_summaries.all():
            timeline.append({
                "event_type": "ai_summary",
                "date": summary.created_at,
                "document_id": document.pk,
                "document_name": document.original_name,
                "summary_id": summary.pk,
                "summary": summary.summary,
            })

    timeline.sort(
        key=lambda entry: str(entry["date"]),
        reverse=True,
    )

    # Convert date/datetime values to JSON-safe ISO strings.
    for entry in timeline:
        entry["date"] = entry["date"].isoformat()

    return Response({
        "timeline": timeline,
        "count": len(timeline),
    })