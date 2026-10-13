
from django.urls import path
from . import views


urlpatterns = [
    path(
        "health/",
        views.health,
        name="api-health",
    ),
    path(
        "documents/",
        views.documents,
        name="documents",
    ),
    path(
        "documents/<int:document_id>/extract/",
        views.extract_document,
        name="extract-document",
    ),
    path(
        "documents/<int:document_id>/observations/",
        views.document_observations,
        name="document-observations",
    ),
    path(
        "documents/<int:document_id>/medications/",
        views.document_medications,
        name="document-medications",
    ),
    path(
        "documents/<int:document_id>/ai-summary/",
        views.ai_report_summary,
        name="ai-report-summary",
    ),
    path(
        "documents/<int:document_id>/ai-summaries/",
        views.saved_ai_summaries,
        name="saved-ai-summaries",
    ),
    path(
        "timeline/",
        views.health_timeline,
        name="health-timeline",
    ),
]
