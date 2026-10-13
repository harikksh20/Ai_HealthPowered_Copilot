from django.contrib import admin
from .models import MedicalDocument, Observation

class ObservationInline(admin.TabularInline):
    model = Observation
    extra = 0

@admin.register(MedicalDocument)
class MedicalDocumentAdmin(admin.ModelAdmin):
    list_display = ("original_name", "document_type", "uploaded_at", "extraction_status")
    search_fields = ("original_name",)
    inlines = [ObservationInline]

@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ("test_name", "value", "unit", "flag", "document")
    search_fields = ("test_name", "document__original_name")
