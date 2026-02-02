from __future__ import annotations

import re

# RFC 5322 compliant email regex (simplified)
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def is_email(value: str) -> bool:
    """Check if a string is a valid email address."""
    return bool(EMAIL_REGEX.match(value))
