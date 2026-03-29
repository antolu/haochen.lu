from __future__ import annotations

import logging
import time
import typing

import httpx
import jwt

from app.config import settings

logger = logging.getLogger(__name__)


class OidcValidator:
    def __init__(self) -> None:
        self._jwks_keys: list[typing.Any] = []
        self._jwks_fetched_at: float = 0.0
        self._cache_ttl: int = settings.oidc_jwks_cache_ttl

    async def _refresh_jwks(self) -> None:
        discovery_url = (
            f"{settings.oidc_endpoint}/api/oidc/.well-known/openid-configuration"
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                discovery_resp = await client.get(discovery_url)
                if discovery_resp.status_code != 200:
                    logger.error("OIDC discovery failed: %s", discovery_resp.text)
                    return
                jwks_uri = discovery_resp.json().get("jwks_uri")
                if not jwks_uri:
                    logger.error("OIDC discovery missing jwks_uri")
                    return
                jwks_resp = await client.get(jwks_uri)
                if jwks_resp.status_code != 200:
                    logger.error("JWKS fetch failed: %s", jwks_resp.text)
                    return
                keys = jwks_resp.json().get("keys", [])
        except Exception:
            logger.exception("Error fetching JWKS")
            return

        self._jwks_keys = [
            jwt.algorithms.RSAAlgorithm.from_jwk(k)
            for k in keys
            if k.get("alg") == "RS256" or k.get("kty") == "RSA"
        ]
        self._jwks_fetched_at = time.monotonic()

    async def validate_token(self, token: str) -> dict[str, typing.Any] | None:
        now = time.monotonic()
        if not self._jwks_keys or (now - self._jwks_fetched_at) > self._cache_ttl:
            await self._refresh_jwks()

        if not self._jwks_keys:
            return None

        for key in self._jwks_keys:
            try:
                payload: dict[str, typing.Any] = jwt.decode(
                    token,
                    key,
                    algorithms=["RS256"],
                    issuer=settings.oidc_issuer,
                    options={"require": ["exp", "iss", "sub"]},
                )
            except jwt.ExpiredSignatureError:
                logger.debug("OIDC token expired")
                return None
            except jwt.InvalidIssuerError:
                logger.debug("OIDC token has wrong issuer")
                return None
            except jwt.PyJWTError:
                continue
            else:
                return payload

        return None


oidc_validator = OidcValidator()
