#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoint"""
    print("\n=== Testing Health Endpoint ===")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")
        return False

def test_analyze():
    """Test analyze endpoint with sample company"""
    print("\n=== Testing Analyze Endpoint (Port 8001) ===")
    
    payload = {
        "companies": [
            {
                "name": "Test Corp",
                "sector": "Technology",
                "screener_id": "TEST",
                "ir_page_url": None
            }
        ],
        "quarters": 2,
        "debate_refinement_threshold": 0.7
    }
    
    try:
        print("Sending request...")
        response = requests.post(
            f"{BASE_URL}/analyze",
            json=payload,
            timeout=120
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✓ Response received successfully")
            print(json.dumps(result, indent=2, default=str)[:500])
            return True
        else:
            print(f"ERROR: Status {response.status_code}")
            print(f"Response text: {response.text}")
            return False
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing API on port 8001...")
    health_ok = test_health()
    if health_ok:
        analyze_ok = test_analyze()
        print("\n" + "="*50)
        print(f"Health: {'✓ PASS' if health_ok else '✗ FAIL'}")
        print(f"Analyze: {'✓ PASS' if analyze_ok else '✗ FAIL'}")
