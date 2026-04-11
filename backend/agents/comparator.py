import pandas as pd
from storage.structured_store import engine

def compare_companies(company_list: list, metric: str = "revenue_growth") -> dict:
    # Fetch latest quarter metric for each company
    sql = f"""
    SELECT company_name, metric_value 
    FROM financials_quarterly 
    WHERE metric_name = '{metric}' 
    AND quarter = (SELECT MAX(quarter) FROM financials_quarterly)
    ORDER BY metric_value DESC
    """
    df = pd.read_sql(sql, engine)
    ranking = df.to_dict(orient="records")
    return {"metric": metric, "ranking": ranking}