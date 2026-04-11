# backend/verify_scraper.py
from pathlib import Path
from sqlalchemy import text
from storage.structured_store import engine as db_engine
from storage.semantic_store import client as chroma_client
import json

print("=" * 60)
print("SCRAPER VERIFICATION REPORT")
print("=" * 60)

# 1. Check PostgreSQL
print("\n1️⃣ PostgreSQL Metrics:")
try:
    with db_engine.begin() as conn:
        result = conn.execute(text("SELECT COUNT(*) as cnt FROM financials_quarterly"))
        count = result.scalar()
        print(f"   ✅ Total metrics inserted: {count}")
        
        # Sample data
        result = conn.execute(text("""
            SELECT company_name, quarter, COUNT(*) as metric_count
            FROM financials_quarterly
            GROUP BY company_name, quarter
            LIMIT 5
        """))
        rows = result.fetchall()
        if rows:
            print(f"   ✅ Sample by company/quarter:")
            for company, quarter, cnt in rows:
                print(f"      - {company} {quarter}: {cnt} metrics")
except Exception as e:
    print(f"   ❌ Error: {e}")

# 2. Check ChromaDB
print("\n2️⃣ ChromaDB Chunks:")
try:
    collection = chroma_client.get_collection("equity_chunks")
    count = collection.count()
    print(f"   ✅ Total chunks embedded: {count}")
    
    # Sample metadata
    peek = collection.peek(limit=3)
    if peek['metadatas']:
        print(f"   ✅ Sample chunk metadata:")
        for meta in peek['metadatas'][:3]:
            print(f"      - Company: {meta.get('company')}, Table: {meta.get('table_type')}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# 3. Check JSON backups
print("\n3️⃣ JSON Backup Files:")
raw_dir = Path("data/raw")
if raw_dir.exists():
    json_files = list(raw_dir.glob("*.json"))
    print(f"   ✅ Found {len(json_files)} JSON files:")
    for jf in json_files:
        size_kb = jf.stat().st_size / 1024
        print(f"      - {jf.name} ({size_kb:.1f} KB)")
else:
    print(f"   ⚠️ data/raw directory not found")

# 4. Insertion results (if available in recent scraped data)
print("\n4️⃣ Recent Insertion Results:")
print("   (Check PostgreSQL SELECT above for confirmation)")

print("\n" + "=" * 60)
print("✅ VERIFICATION COMPLETE")
print("=" * 60)