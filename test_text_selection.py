#!/usr/bin/env python3
"""
Test script for text selection functionality.
This script tests the new text selection and cross-PDF insights features.
"""

import json
import os
import sys
from pathlib import Path

import requests

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent / "backend"))


def test_text_selection_api():
    """Test the text selection API endpoint."""

    # Test data
    test_request = {
        "selected_text": "machine learning algorithms and their applications in natural language processing",
        "document": "test_document.pdf",
        "page_number": 1,
        "persona": "Research Scientist",
        "job": "Understanding recent advances in ML for NLP",
    }

    try:
        # Test the API endpoint
        response = requests.post(
            "http://localhost:8080/api/text-selection",
            json=test_request,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 200:
            result = response.json()
            print("✅ Text selection API test passed!")
            print(f"Found {len(result.get('insights', []))} cross-PDF insights")
            print(f"Summary: {result.get('summary', 'N/A')}")
            print(f"Contradictions: {len(result.get('contradictions', []))}")
            print(f"Connections: {len(result.get('connections', []))}")
            return True
        else:
            print(f"❌ Text selection API test failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(
            "❌ Could not connect to server. Make sure the server is running on localhost:8080"
        )
        return False
    except Exception as e:
        print(f"❌ Text selection API test failed with error: {e}")
        return False


def test_enhanced_podcast_api():
    """Test the enhanced podcast API endpoint."""

    # Test data
    test_request = {
        "selected_text": "deep learning models for text classification",
        "related_insights": [
            {
                "document": "paper1.pdf",
                "page_number": 5,
                "section_title": "Methodology",
                "relevant_text": "The proposed approach uses transformer-based models...",
                "relevance_score": 0.85,
                "insight_type": "relevant",
                "jump_url": "/files/paper1.pdf#page=5",
            }
        ],
        "document": "test_document.pdf",
        "page_number": 1,
        "conversation_style": "academic",
    }

    try:
        # Test the API endpoint
        response = requests.post(
            "http://localhost:8080/api/enhanced-podcast",
            json=test_request,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 200:
            result = response.json()
            print("✅ Enhanced podcast API test passed!")
            print(f"Podcast URL: {result.get('url', 'N/A')}")
            print(f"Duration: {result.get('duration', 'N/A')} seconds")
            print(f"Transcript length: {len(result.get('transcript', ''))} characters")
            return True
        else:
            print(f"❌ Enhanced podcast API test failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(
            "❌ Could not connect to server. Make sure the server is running on localhost:8080"
        )
        return False
    except Exception as e:
        print(f"❌ Enhanced podcast API test failed with error: {e}")
        return False


def test_document_search_api():
    """Test the document search API endpoint."""

    # Test data
    test_request = {
        "query": "machine learning algorithms",
        "documents": [],  # Empty list means search all documents
        "top_k": 5,
    }

    try:
        # Test the API endpoint
        response = requests.post(
            "http://localhost:8080/api/document-search",
            json=test_request,
            headers={"Content-Type": "application/json"},
        )

        if response.status_code == 200:
            result = response.json()
            print("✅ Document search API test passed!")
            print(f"Found {result.get('total_found', 0)} results")
            print(f"Search time: {result.get('search_time', 0):.2f} seconds")
            return True
        else:
            print(f"❌ Document search API test failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except requests.exceptions.ConnectionError:
        print(
            "❌ Could not connect to server. Make sure the server is running on localhost:8080"
        )
        return False
    except Exception as e:
        print(f"❌ Document search API test failed with error: {e}")
        return False


def test_health_endpoint():
    """Test the health endpoint to ensure server is running."""

    try:
        response = requests.get("http://localhost:8080/api/health")

        if response.status_code == 200:
            result = response.json()
            print("✅ Health check passed!")
            print(f"LLM Provider: {result.get('llm_provider', 'N/A')}")
            print(f"TTS Provider: {result.get('tts_provider', 'N/A')}")
            print(f"Adobe Key: {'✅' if result.get('adobe_key') else '❌'}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False

    except requests.exceptions.ConnectionError:
        print(
            "❌ Could not connect to server. Make sure the server is running on localhost:8080"
        )
        return False
    except Exception as e:
        print(f"❌ Health check failed with error: {e}")
        return False


def main():
    """Run all tests."""
    print("🧪 Testing Adobe Hackathon Finale Text Selection Features")
    print("=" * 60)

    # Test health endpoint first
    if not test_health_endpoint():
        print("\n❌ Server is not running. Please start the server first:")
        print("   python backend/app/main.py --reload")
        return

    print("\n" + "=" * 60)

    # Test new API endpoints
    tests = [
        ("Text Selection API", test_text_selection_api),
        ("Enhanced Podcast API", test_enhanced_podcast_api),
        ("Document Search API", test_document_search_api),
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\n🔍 Testing {test_name}...")
        if test_func():
            passed += 1
        print("-" * 40)

    print(f"\n📊 Test Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! The text selection features are working correctly.")
    else:
        print("⚠️  Some tests failed. Check the server logs for more details.")


if __name__ == "__main__":
    main()
