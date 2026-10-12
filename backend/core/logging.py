"""Structured logging with secret redaction. Never log prompts, passwords or API keys."""
import logging
import re
import sys

_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|token|password|secret|authorization)(\s*[=:]\s*)([^\s,;'\"]+)"),
    re.compile(r"(postgres(?:ql)?(?:\+\w+)?://[^:/\s]+:)([^@\s]+)(@)"),
    re.compile(r"\b(gsk_|sk-|AIza)[A-Za-z0-9_\-]{8,}"),
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-~+/=]+"),
]


def redact(text: str) -> str:
    text = _PATTERNS[3].sub("Bearer [REDACTED]", text)  # before the generic key=value rule consumes the word "Bearer"
    text = _PATTERNS[0].sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", text)
    text = _PATTERNS[1].sub(lambda m: f"{m.group(1)}[REDACTED]{m.group(3)}", text)
    return _PATTERNS[2].sub("[REDACTED]", text)


class _RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return redact(super().format(record))


def configure_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if any(getattr(h, "_equitylens", False) for h in root.handlers):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler._equitylens = True  # type: ignore[attr-defined]
    handler.setFormatter(_RedactingFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root.addHandler(handler)
    root.setLevel(level)
