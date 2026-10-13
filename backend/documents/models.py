from django.db import models


class MedicalDocument(models.Model):
    DOCUMENT_TYPES = [
        ("lab_report", "Lab report"),
        ("prescription", "Prescription"),
        ("discharge_summary", "Discharge summary"),
        ("other", "Other medical record"),
    ]

    file = models.FileField(
        upload_to="medical_documents/%Y/%m/"
    )
    original_name = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=30,
        choices=DOCUMENT_TYPES,
        default="other",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    extracted_text = models.TextField(blank=True)
    extraction_status = models.CharField(
        max_length=30,
        default="not_started",
    )
    extraction_error = models.TextField(blank=True)

    def __str__(self):
        return self.original_name


class Observation(models.Model):
    document = models.ForeignKey(
        MedicalDocument,
        related_name="observations",
        on_delete=models.CASCADE,
    )
    test_name = models.CharField(max_length=160)
    value = models.CharField(max_length=100)
    unit = models.CharField(max_length=80, blank=True)
    reference_range = models.CharField(max_length=100, blank=True)
    flag = models.CharField(max_length=30, default="review")
    effective_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.test_name}: {self.value} {self.unit}".strip()


class Medication(models.Model):
    document = models.ForeignKey(
        MedicalDocument,
        related_name="medications",
        on_delete=models.CASCADE,
    )
    medicine_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100, blank=True)
    frequency = models.CharField(max_length=100, blank=True)
    duration = models.CharField(max_length=100, blank=True)
    instructions = models.TextField(blank=True)
    needs_review = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.medicine_name


class AISummary(models.Model):
    document = models.ForeignKey(
        MedicalDocument,
        on_delete=models.CASCADE,
        related_name="ai_summaries",
    )
    summary = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"AI Summary for {self.document.original_name}"
