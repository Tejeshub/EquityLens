from sqlalchemy import text
from storage.structured_store import engine

def verify_metric(company_name: str, quarter: str, metric_name: str) -> dict:
    sql = text("""
    SELECT company_name, quarter, metric_name, metric_value, unit, confidence
    FROM financials_quarterly
    WHERE company_name = :company_name AND quarter = :quarter AND metric_name = :metric_name
    ORDER BY confidence DESC NULLS LAST
    LIMIT 1
    """)
    with engine.begin() as conn:
        row = conn.execute(sql, {
            "company_name": company_name,
            "quarter": quarter,
            "metric_name": metric_name
        }).fetchone()
    if not row:
        return {"ok": False, "error": "Cannot verify from available structured sources."}
    return {
        "ok": True,
        "company_name": row[0],
        "quarter": row[1],
        "metric_name": row[2],
        "metric_value": float(row[3]) if row[3] is not None else None,
        "unit": row[4],
        "confidence": float(row[5]) if row[5] is not None else None,
    }