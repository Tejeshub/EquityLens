import json
import time
from pathlib import Path
from scraper import ScreenerScraper
from storage.structured_store import engine as db_engine
from storage.semantic_store import client as chroma_client

def run_company_analysis(ticker: str, skip_db: bool = False):
    """
    Analyze a company using Screener data.
    
    Args:
        ticker: Company ticker
        skip_db: If True, skip database insertion (JSON-only mode)
    """
    print(f"\n{'='*60}\nAnalyzing {ticker}\n{'='*60}")
    
    # ---------- 1. Scrape structured data with direct DB insertion ----------
    try:
        # Initialize scraper with DB clients (unless skip_db is True)
        db_instance = None if skip_db else db_engine
        chroma_instance = None if skip_db else chroma_client
        
        scraper = ScreenerScraper(ticker, db_engine=db_instance, chroma_client=chroma_instance)
        scraped = scraper.scrape_all()
        
        # Report DB insertion results
        if not skip_db:
            print("\n📊 Database Insertion Results:")
            for table_name, result in scraped.get("db_insertion_results", {}).items():
                if result:
                    db_result = result.get("db_result", {})
                    chroma_result = result.get("chroma_result", {})
                    
                    if db_result and "inserted" in db_result:
                        print(f"  {table_name}:")
                        print(f"    - PostgreSQL: {db_result['inserted']} inserted, {db_result['skipped']} skipped")
                    
                    if chroma_result and "count" in chroma_result:
                        print(f"    - ChromaDB: {chroma_result['count']} chunks embedded")
        
        print(f"✅ Scraped data for {ticker}")
    except Exception as e:
        print(f"❌ Scraping failed for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        return None

    # ---------- 2. Save raw JSON as backup ----------
    try:
        raw_path = Path(f"data/raw/{ticker}.json")
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        with open(raw_path, "w", encoding="utf-8") as f:
            # Remove db_insertion_results from JSON to keep file clean
            json_data = scraped.copy()
            json_data.pop("db_insertion_results", None)
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved JSON backup to {raw_path}")
    except Exception as e:
        print(f"⚠️ Warning: Failed to save JSON backup: {e}")

    # ---------- 3. Report final status ----------
    print(f"✅ Analysis complete for {ticker}")
    return scraped

if __name__ == "__main__":
    # Your companies to analyze
    companies = [
        "PERSISTENT"
    ]
    # Uncomment to add more: "NEWGEN", "TATAELXSI", "CYIENT", "KPITTECH", "HAPPSTMNDS", "TATATECH", "MPHASIS"
    
    for idx, ticker in enumerate(companies):
        try:
            result = run_company_analysis(ticker)
            if result:
                print(f"\n✅ Analysis successful for {ticker}\n")
            else:
                print(f"⚠️ Skipped {ticker} due to errors.")
        except Exception as e:
            print(f"❌ Failed to analyze {ticker}: {e}")
            import traceback
            traceback.print_exc()
        
        # Delay to avoid rate limits
        if idx < len(companies) - 1:
            print("⏳ Waiting 1 second before next company...")
            time.sleep(1)
