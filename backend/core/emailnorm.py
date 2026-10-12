"""Email validation and canonicalisation. Display form: NFKC-normalised, lower-cased ASCII.
Canonical form (uniqueness only): '+tag' removed; dots removed for gmail.com/googlemail.com."""
import re
import unicodedata

_ASCII_EMAIL = re.compile(r"^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$")
_GMAIL = {"gmail.com", "googlemail.com"}


def normalize_email(raw: str) -> str:
    s = unicodedata.normalize("NFKC", raw).strip().lower()
    if any(unicodedata.category(c) in ("Cf", "Cc", "Zs", "Zl", "Zp") for c in s):
        raise ValueError("invalid email address")
    if not s.isascii() or len(s) > 254 or not _ASCII_EMAIL.match(s):
        raise ValueError("invalid email address")  # IDN/unicode addresses must be supplied in ASCII (punycode) form
    local, _, domain = s.partition("@")
    if local.startswith(".") or local.endswith(".") or ".." in local:
        raise ValueError("invalid email address")
    return s


def canonical_email(normalized: str) -> str:
    local, _, domain = normalized.partition("@")
    local = local.split("+", 1)[0]
    if domain in _GMAIL:
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}" if local else normalized
