#!/usr/bin/env python3
"""
Sample data seeder for financials_quarterly table.
Use this to populate test data for development.
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from storage.structured_store import engine, financials_quarterly
from datetime import datetime
import uuid

# Sample companies and their Q3FY24 metrics
SAMPLE_DATA = [
    # Tata Consultancy Services Ltd
    {"company_name": "Tata Consultancy Services Ltd", "quarter": "Q3FY24", "metric_name": "revenue", "metric_value": 60000.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "Tata Consultancy Services Ltd", "quarter": "Q3FY24", "metric_name": "pat", "metric_value": 12000.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "Tata Consultancy Services Ltd", "quarter": "Q3FY24", "metric_name": "roce", "metric_value": 45.2, "unit": "%", "confidence": 0.90},
    {"company_name": "Tata Consultancy Services Ltd", "quarter": "Q3FY24", "metric_name": "debt_equity", "metric_value": 0.25, "unit": "ratio", "confidence": 0.90},
    
    # Infosys Ltd
    {"company_name": "Infosys Ltd", "quarter": "Q3FY24", "metric_name": "revenue", "metric_value": 38000.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "Infosys Ltd", "quarter": "Q3FY24", "metric_name": "pat", "metric_value": 8500.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "Infosys Ltd", "quarter": "Q3FY24", "metric_name": "roce", "metric_value": 42.5, "unit": "%", "confidence": 0.90},
    {"company_name": "Infosys Ltd", "quarter": "Q3FY24", "metric_name": "debt_equity", "metric_value": 0.18, "unit": "ratio", "confidence": 0.90},
    
    # Wipro Ltd
    {"company_name": "Wipro Ltd", "quarter": "Q3FY24", "metric_name": "revenue", "metric_value": 23000.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "Wipro Ltd", "quarter": "Q3FY24", "metric_name": "pat", "metric_value": 4200.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "Wipro Ltd", "quarter": "Q3FY24", "metric_name": "roce", "metric_value": 38.0, "unit": "%", "confidence": 0.90},
    {"company_name": "Wipro Ltd", "quarter": "Q3FY24", "metric_name": "debt_equity", "metric_value": 0.22, "unit": "ratio", "confidence": 0.90},
    
    # HCL Technologies Ltd
    {"company_name": "HCL Technologies Ltd", "quarter": "Q3FY24", "metric_name": "revenue", "metric_value": 28000.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "HCL Technologies Ltd", "quarter": "Q3FY24", "metric_name": "pat", "metric_value": 5800.0, "unit": "Crore", "confidence": 0.95},
    {"company_name": "HCL Technologies Ltd", "quarter": "Q3FY24", "metric_name": "roce", "metric_value": 40.0, "unit": "%", "confidence": 0.90},
    {"company_name": "HCL Technologies Ltd", "quarter": "Q3FY24", "metric_name": "debt_equity", "metric_value": 0.20, "unit": "ratio", "confidence": 0.90},
]

def seed_data():
    """Insert sample data into financials_quarterly table"""
    print("Seeding sample financial data...\n")
    
    try:
        with engine.begin() as conn:
            # First, check if table exists and is empty
            count_sql = text("SELECT COUNT(*) FROM financials_quarterly")
            existing_count = conn.execute(count_sql).scalar()
            print(f"Existing records in financials_quarterly: {existing_count}")
            
            if existing_count > 0:
                print("TABLE ALREADY HAS DATA. Skipping seed to avoid duplicates.")
                print("To reset, run: DELETE FROM financials_quarterly;")
                return
            
            # Insert sample data
            insert_count = 0
            for record in SAMPLE_DATA:
                record["id"] = str(uuid.uuid4())
                record["source_document_id"] = "sample_data"
                record["confidence"] = record.get("confidence", 0.85)
                record["created_at"] = datetime.now()
                
                ins = financials_quarterly.insert().values(**record)
                conn.execute(ins)
                insert_count += 1
                print(f"  ✓ {record['company_name']:30s} | {record['quarter']} | {record['metric_name']:12s} = {record['metric_value']} {record['unit']}")
            
            print(f"\n✓ Successfully inserted {insert_count} records")
            
            # Verify data
            verify_sql = text("SELECT COUNT(*), COUNT(DISTINCT company_name) FROM financials_quarterly")
            result = conn.execute(verify_sql).fetchone()
            print(f"\nVerification:")
            print(f"  Total records: {result[0]}")
            print(f"  Unique companies: {result[1]}")
            
    except Exception as e:
        print(f"\n✗ ERROR during seeding: {type(e).__name__}: {str(e)}")
        print(f"\nMake sure:")
        print(f"  1. PostgreSQL is running")
        print(f"  2. Database exists and POSTGRES_URL is correct in .env")
        print(f"  3. Tables are created (run: python scripts/init_db.py)")
        raise

if __name__ == "__main__":
    seed_data()
    print("\n✓ Seed complete. Metrics are ready for analysis.")
