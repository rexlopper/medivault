from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets


PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode("utf-8"),
        base64.b64encode(derived_key).decode("utf-8"),
    )


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        scheme, iterations, encoded_salt, encoded_hash = password_hash.split("$", 3)
    except ValueError:
        return False

    if scheme != "pbkdf2_sha256":
        return False

    salt = base64.b64decode(encoded_salt.encode("utf-8"))
    expected_hash = base64.b64decode(encoded_hash.encode("utf-8"))
    candidate_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
    return hmac.compare_digest(candidate_hash, expected_hash)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)
