#!/usr/bin/env python3
"""
Quick validation test for the refactored Screener scraper pipeline.
Tests:
1. Imports and module loading
2. Function signatures
3. Sample data parsing
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test that all modules import correctly."""
    print("Testing imports...")
    try:
        from tools.parser_tools import parse_table_to_metrics_records, batch_insert_financial_metrics
        print("  ✅ parser_tools imported")
        
        from tools.chroma_tools import generate_chunks_from_table, embed_text_chunks
        print("  ✅ chroma_tools imported")
        
        from scraper import ScreenerScraper
        print("  ✅ scraper imported")
        
        from storage.structured_store import engine as db_engine
        print("  ✅ db_engine imported")
        
        from storage.semantic_store import client as chroma_client
        print("  ✅ chroma_client imported")
        
        return True
    except Exception as e:
        print(f"  ❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_parsing_logic():
    """Test parsing logic with sample data."""
    print("\nTesting parsing logic...")
    try:
        from tools.parser_tools import parse_table_to_metrics_records, batch_insert_financial_metrics
        
        # Sample table data (as if extracted from Screener)
        sample_table = {
            "headers": ["Q3FY24", "Q2FY24", "Q1FY24"],
            "rows": {
                "Revenue": ["1234.5", "1200.0", "1100.0"],
                "Net Income": ["250.5", "240.0", "220.0"],
                "Operating Cash Flow": ["300.0", "280.0", "260.0"]
            }
        }
        
        # Test parsing
        records = parse_table_to_metrics_records(
            sample_table,
            "quarterly_results",
            "PERSISTENT",
            "https://screener.in/company/PERSISTENT"
        )
        
        print(f"  ✅ Parsed {len(records)} metric records")
        
        # Verify record structure
        if records:
            first_record = records[0]
            required_keys = {"company_name", "quarter", "metric_name", "metric_value", "unit", "source_document_id", "confidence"}
            if required_keys.issubset(first_record.keys()):
                print(f"  ✅ Record structure valid: {first_record}")
            else:
                print(f"  ❌ Record missing keys. Got: {first_record.keys()}")
                return False
        
        return True
    except Exception as e:
        print(f"  ❌ Parsing test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_chunk_generation():
    """Test chunk generation logic."""
    print("\nTesting chunk generation...")
    try:
        from tools.chroma_tools import generate_chunks_from_table
        
        # Sample table data
        sample_table = {
            "headers": ["Q3FY24", "Q2FY24"],
            "rows": {
                "Revenue": ["1234.5", "1200.0"],
                "Expenses": ["900.0", "880.0"],
                "PAT": ["250.5", "240.0"]
            }
        }
        
        # Test chunk generation
        chunks = generate_chunks_from_table(
            sample_table,
            "quarterly_results",
            "PERSISTENT",
            "PERSISTENT",
            "https://screener.in/company/PERSISTENT"
        )
        
        print(f"  ✅ Generated {len(chunks)} chunks")
        
        # Verify chunk structure
        if chunks:
            first_chunk = chunks[0]
            required_keys = {"text", "metadata"}
            if required_keys.issubset(first_chunk.keys()):
                print(f"  ✅ Chunk structure valid")
                print(f"     - Text length: {len(first_chunk['text'])} chars")
                print(f"     - Metadata keys: {list(first_chunk['metadata'].keys())}")
            else:
                print(f"  ❌ Chunk missing keys. Got: {first_chunk.keys()}")
                return False
        
        return True
    except Exception as e:
        print(f"  ❌ Chunk generation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_scraper_init():
    """Test ScreenerScraper initialization."""
    print("\nTesting ScreenerScraper initialization...")
    try:
        from scraper import ScreenerScraper
        
        # Test with no DB clients (JSON-only mode)
        scraper = ScreenerScraper("PERSISTENT", db_engine=None, chroma_client=None)
        print(f"  ✅ Scraper initialized (JSON-only mode)")
        print(f"     - Ticker: {scraper.ticker}")
        print(f"     - URL: {scraper.url}")
        
        return True
    except Exception as e:
        print(f"  ❌ Scraper initialization failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("VALIDATION TEST SUITE FOR SCREENER REFACTORING")
    print("=" * 60)
    
    tests = [
        test_imports,
        test_parsing_logic,
        test_chunk_generation,
        test_scraper_init,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print(f"\n❌ Test {test.__name__} crashed: {e}")
            results.append(False)
    
    print("\n" + "=" * 60)
    print(f"RESULTS: {sum(results)}/{len(results)} tests passed")
    print("=" * 60)
    
    if all(results):
        print("✅ All tests passed! Ready for integration.")
        return 0
    else:
        print("❌ Some tests failed. Review errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
