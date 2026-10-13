
from rest_framework import serializers

from .models import (
    MedicalDocument,
    Observation,
    Medication,
)


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = [
            "id",
            "test_name",
            "value",
            "unit",
            "reference_range",
            "flag",
            "effective_date",
        ]


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = [
            "id",
            "medicine_name",
            "dosage",
            "frequency",
            "duration",
            "instructions",
            "needs_review",
            "created_at",
        ]


class MedicalDocumentSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        source="original_name",
        read_only=True,
    )
    type = serializers.CharField(
        source="get_document_type_display",
        read_only=True,
    )
    date = serializers.DateTimeField(
        source="uploaded_at",
        read_only=True,
    )
    observation_count = serializers.SerializerMethodField()
    medication_count = serializers.SerializerMethodField()

    class Meta:
        model = MedicalDocument
        fields = [
            "id",
            "name",
            "type",
            "document_type",
            "date",
            "extraction_status",
            "observation_count",
            "medication_count",
            "file",
        ]

    def get_observation_count(self, obj):
        return obj.observations.count()

    def get_medication_count(self, obj):
        return obj.medications.count()
