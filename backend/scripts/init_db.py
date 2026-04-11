import sys
from pathlib import Path

# Allow direct execution via `python scripts/init_db.py` from backend.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from storage.structured_store import engine, metadata

def init_db():
    metadata.create_all(engine)
    print("Tables created successfully")

if __name__ == "__main__":
    init_db()