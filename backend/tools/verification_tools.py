from sqlalchemy import text
from storage.structured_store import engine

def verify_metric(company_name: str, quarter: str, metric_name: str) -> dict:
    print(f"verify_metric: searching for company={company_name}, quarter={quarter}, metric={metric_name}")
    
    sql = text("""
    SELECT company_name, quarter, metric_name, metric_value, unit, confidence
    FROM financials_quarterly
    WHERE company_name = :company_name AND quarter = :quarter AND metric_name = :metric_name
    ORDER BY confidence DESC NULLS LAST
    LIMIT 1
    """)
    
    try:
        with engine.begin() as conn:
            print(f"verify_metric: executing query...")
            row = conn.execute(sql, {
                "company_name": company_name,
                "quarter": quarter,
                "metric_name": metric_name
            }).fetchone()
            print(f"verify_metric: query returned row={row}")
        
        if not row:
            print(f"verify_metric: WARNING - No data found for {company_name} {quarter} {metric_name}")
            # Check what data is actually in the table
            with engine.begin() as conn:
                count_sql = text("SELECT COUNT(*) FROM financials_quarterly")
                count = conn.execute(count_sql).scalar()
                print(f"verify_metric: DEBUG - Total records in financials_quarterly: {count}")
                
                if count > 0:
                    sample_sql = text("SELECT DISTINCT company_name, quarter FROM financials_quarterly LIMIT 5")
                    samples = conn.execute(sample_sql).fetchall()
                    print(f"verify_metric: DEBUG - Sample data: {samples}")
            
            return {"ok": False, "error": "Cannot verify from available structured sources. Table may be empty."}
        
        print(f"verify_metric: SUCCESS - Found metric_value={row[3]}")
        return {
            "ok": True,
            "company_name": row[0],
            "quarter": row[1],
            "metric_name": row[2],
            "metric_value": float(row[3]) if row[3] is not None else None,
            "unit": row[4],
            "confidence": float(row[5]) if row[5] is not None else None,
        }
    except Exception as e:
        print(f"verify_metric: ERROR - {type(e).__name__}: {str(e)}")
        return {"ok": False, "error": f"Database query failed: {str(e)}"}