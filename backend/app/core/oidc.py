from __future__ import annotations

from arcadia_auth import OidcClient, OidcValidator

from app.config import oidc_settings

oidc_validator = OidcValidator(oidc_settings)
oidc_client = OidcClient(oidc_settings)
