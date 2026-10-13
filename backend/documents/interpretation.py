
from decimal import Decimal, InvalidOperation


def interpret_observation(observation):
    """
    Interpret a laboratory observation only when its
    reference range can be safely understood.

    Expected range formats:
      12-16
      12 - 16
      12 to 16

    Missing or unsupported ranges require manual review.
    """

    result = {
        "status": "needs_review",
        "status_label": "Needs review",
        "explanation": (
            "Verify this result and its reference range "
            "against the original laboratory report."
        ),
    }

    value_text = str(observation.get("value", "")).strip()
    range_text = str(
        observation.get("reference_range", "")
    ).strip()

    if not value_text or not range_text:
        result["explanation"] = (
            "A result value or reference range is missing."
        )
        return result

    try:
        value = Decimal(value_text)
    except (InvalidOperation, ValueError):
        result["explanation"] = (
            "The extracted value is not a valid number."
        )
        return result

    normalized_range = (
        range_text.lower()
        .replace("–", "-")
        .replace("—", "-")
        .replace(" to ", "-")
    )

    parts = normalized_range.split("-")

    if len(parts) != 2:
        result["explanation"] = (
            "The reference range format is unsupported."
        )
        return result

    try:
        lower = Decimal(parts[0].strip())
        upper = Decimal(parts[1].strip())
    except (InvalidOperation, ValueError):
        result["explanation"] = (
            "The reference range could not be interpreted."
        )
        return result

    if lower > upper:
        result["explanation"] = (
            "The reference range needs verification."
        )
        return result

    if value < lower:
        return {
            "status": "low",
            "status_label": "Below reference range",
            "explanation": (
                "The extracted value is below the supplied "
                "reference range."
            ),
        }

    if value > upper:
        return {
            "status": "high",
            "status_label": "Above reference range",
            "explanation": (
                "The extracted value is above the supplied "
                "reference range."
            ),
        }

    return {
        "status": "within_range",
        "status_label": "Within reference range",
        "explanation": (
            "The extracted value falls within the supplied "
            "reference range. This alone does not establish "
            "that the result is medically normal."
        ),
    }
