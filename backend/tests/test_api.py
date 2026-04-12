#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"

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
    print("\n=== Testing Analyze Endpoint ===")
    
    payload = {
        "companies": [
            {
                "name": "Apple Inc.",
                "sector": "Technology",
                "screener_id": "AAPL",
                "ir_page_url": "https://investor.apple.com"
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
            timeout=60
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\n✓ Response received successfully")
            print(f"Response structure keys: {list(result.keys())}")
            
            # Validate response structure
            if "scorecards" in result:
                print(f"✓ Scorecards present: {len(result['scorecards'])} scorecard(s)")
                for i, sc in enumerate(result['scorecards']):
                    print(f"\n  Scorecard {i}:")
                    print(f"    - company: {sc.get('company', 'MISSING')}")
                    print(f"    - overall_grade: {sc.get('overall_grade', 'MISSING')}")
                    print(f"    - dimensions: {len(sc.get('dimensions', []))} dimension(s)")
                    print(f"    - debate_summary: {sc.get('debate_summary', 'MISSING')[:50]}...")
                    print(f"    - coordinator_confidence: {sc.get('coordinator_confidence', 'MISSING')}")
                    print(f"    - refinement_cycles: {sc.get('refinement_cycles', 'MISSING')}")
            else:
                print("ERROR: No scorecards in response")
            
            if "execution_status" in result:
                print(f"✓ Execution status: {result['execution_status']}")
            
            return response.status_code == 200
        else:
            print(f"ERROR: Status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")
        return False

def test_ask():
    """Test ask endpoint"""
    print("\n=== Testing Ask Endpoint ===")
    
    payload = {
        "question": "What is Apple's competitive advantage in the smartphone market?"
    }
    
    try:
        print("Sending request...")
        response = requests.post(
            f"{BASE_URL}/ask",
            json=payload,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Response: {str(result)[:200]}...")
            return True
        else:
            print(f"ERROR: Status {response.status_code}")
            return False
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")
        return False

if __name__ == "__main__":
    print("Starting API tests...")
    print(f"Base URL: {BASE_URL}")
    
    # Test health first
    health_ok = test_health()
    if not health_ok:
        print("\nERROR: Health check failed. Exiting.")
        exit(1)
    
    print("\nWaiting before main test...")
    time.sleep(2)
    
    # Test main endpoint
    analyze_ok = test_analyze()
    
    print("\n" + "="*50)
    print("Test Summary:")
    print(f"  Health Check: {'✓ PASS' if health_ok else '✗ FAIL'}")
    print(f"  Analyze Test: {'✓ PASS' if analyze_ok else '✗ FAIL'}")
    print("="*50)
