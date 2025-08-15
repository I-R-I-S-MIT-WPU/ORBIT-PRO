#!/usr/bin/env python3
"""
Test script to verify frontend fixes are working correctly.
"""

import json
import time

import requests

BASE_URL = "http://localhost:8080"


def test_health():
    """Test if the server is running."""
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            print("✅ Server is running")
            return True
        else:
            print(f"❌ Server health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        return False


def test_text_selection():
    """Test text selection API."""
    try:
        payload = {
            "selected_text": "This is a test text selection about machine learning and artificial intelligence",
            "document": "test_document.pdf",
            "page_number": 1,
            "persona": "Data Scientist",
            "job": "Understanding ML concepts",
        }

        response = requests.post(f"{BASE_URL}/api/text-selection", json=payload)
        if response.status_code == 200:
            data = response.json()
            print("✅ Text selection API working")
            print(f"   - Found {len(data.get('insights', []))} insights")
            print(f"   - Summary: {data.get('summary', 'N/A')[:100]}...")
            return True
        else:
            print(f"❌ Text selection API failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Text selection test error: {e}")
        return False


def test_enhanced_podcast():
    """Test enhanced podcast API."""
    try:
        payload = {
            "selected_text": "Machine learning algorithms and their applications",
            "related_insights": [
                {
                    "document": "ml_paper.pdf",
                    "page_number": 5,
                    "section_title": "Introduction",
                    "relevant_text": "Machine learning is a subset of artificial intelligence",
                    "relevance_score": 0.8,
                    "insight_type": "relevant",
                    "jump_url": "/files/ml_paper.pdf#page=5",
                }
            ],
            "document": "test_document.pdf",
            "page_number": 1,
            "conversation_style": "academic",
            "persona": "Student",
            "job": "Learning ML concepts",
        }

        response = requests.post(f"{BASE_URL}/api/enhanced-podcast", json=payload)
        if response.status_code == 200:
            data = response.json()
            print("✅ Enhanced podcast API working")
            print(f"   - Audio URL: {data.get('url', 'N/A')}")
            print(f"   - Duration: {data.get('duration', 'N/A')}")
            print(f"   - Segments: {data.get('segments', 'N/A')}")
            return True
        else:
            print(f"❌ Enhanced podcast API failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Enhanced podcast test error: {e}")
        return False


def test_document_search():
    """Test document search API."""
    try:
        payload = {"query": "machine learning algorithms", "top_k": 3}

        response = requests.post(f"{BASE_URL}/api/document-search", json=payload)
        if response.status_code == 200:
            data = response.json()
            print("✅ Document search API working")
            print(f"   - Found {len(data.get('results', []))} results")
            return True
        else:
            print(f"❌ Document search API failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Document search test error: {e}")
        return False


def test_insights():
    """Test insights API."""
    try:
        payload = {
            "persona": "Student",
            "job": "Understanding research papers",
            "current_text": "Machine learning introduction",
            "related_texts": [
                "Neural networks and deep learning",
                "Supervised vs unsupervised learning",
            ],
        }

        response = requests.post(f"{BASE_URL}/api/insights", json=payload)
        if response.status_code == 200:
            data = response.json()
            print("✅ Insights API working")
            content = data.get("content", "")
            if "Key Insights:" in content and "Did You Know?" in content:
                print("   - Proper insights format detected")
                return True
            else:
                print("   - Unexpected insights format")
                return False
        else:
            print(f"❌ Insights API failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Insights test error: {e}")
        return False


def main():
    """Run all tests."""
    print("🧪 Testing Frontend Fixes")
    print("=" * 50)

    tests = [
        ("Health Check", test_health),
        ("Text Selection", test_text_selection),
        ("Enhanced Podcast", test_enhanced_podcast),
        ("Document Search", test_document_search),
        ("Insights", test_insights),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n🔍 Testing: {test_name}")
        try:
            if test_func():
                passed += 1
            else:
                print(f"   ❌ {test_name} failed")
        except Exception as e:
            print(f"   ❌ {test_name} error: {e}")

    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} passed")

    if passed == total:
        print("🎉 All tests passed! Frontend fixes are working correctly.")
    else:
        print("⚠️  Some tests failed. Check the server logs for details.")

    return passed == total


if __name__ == "__main__":
    main()
