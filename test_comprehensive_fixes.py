#!/usr/bin/env python3
"""
Comprehensive test script for Adobe Hackathon Finale fixes.
Tests text selection, clustering, and enhanced podcast functionality.
"""

import json
import os
import sys
import time

import requests

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

BASE_URL = "http://localhost:8080"


def test_health():
    """Test the health endpoint."""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False


def test_document_index():
    """Test document indexing functionality."""
    print("\n📚 Testing document indexing...")
    try:
        # Check current index stats
        stats_response = requests.get(f"{BASE_URL}/api/index/stats")
        if stats_response.status_code == 200:
            stats = stats_response.json()
            print(f"📊 Current index stats: {stats}")

            if stats.get("total_documents", 0) > 0:
                print("✅ Documents are indexed")
                return True
            else:
                print("⚠️ No documents indexed yet")
                return False
        else:
            print(f"❌ Failed to get index stats: {stats_response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Index stats error: {e}")
        return False


def test_text_selection_api():
    """Test the text selection API endpoint."""
    print("\n📝 Testing text selection API...")
    try:
        test_data = {
            "selected_text": "artificial intelligence and neural networks in modern computing systems",
            "document": "test_document.pdf",
            "page_number": 1,
            "persona": "researcher",
            "job": "understanding AI applications",
        }

        response = requests.post(f"{BASE_URL}/api/text-selection", json=test_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Text selection API working:")
            print(f"   Selected text: {data.get('selected_text', 'N/A')}")
            print(f"   Insights found: {len(data.get('insights', []))}")
            print(f"   Summary: {data.get('summary', 'N/A')}")
            return True
        else:
            print(f"❌ Text selection API failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Text selection API error: {e}")
        return False


def test_enhanced_podcast_api():
    """Test the enhanced podcast API endpoint."""
    print("\n🎙️ Testing enhanced podcast API...")
    try:
        test_data = {
            "selected_text": "machine learning algorithms and their applications in data science",
            "related_insights": [
                {
                    "document": "research_paper.pdf",
                    "page_number": 5,
                    "section_title": "Machine Learning Applications",
                    "relevant_text": "Machine learning algorithms show significant improvements in data processing",
                    "relevance_score": 0.85,
                    "insight_type": "relevant",
                    "jump_url": "/files/research_paper.pdf#page=5",
                }
            ],
            "document": "test_document.pdf",
            "page_number": 1,
            "conversation_style": "academic",
        }

        response = requests.post(f"{BASE_URL}/api/enhanced-podcast", json=test_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Enhanced podcast API working:")
            print(f"   URL: {data.get('url', 'N/A')}")
            print(f"   Duration: {data.get('duration', 'N/A')}")
            print(f"   Transcript length: {len(data.get('transcript', ''))}")
            return True
        else:
            print(f"❌ Enhanced podcast API failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Enhanced podcast API error: {e}")
        return False


def test_document_clustering():
    """Test document clustering functionality."""
    print("\n🔗 Testing document clustering...")
    try:
        response = requests.get(f"{BASE_URL}/api/index/clusters?n_clusters=3")
        if response.status_code == 200:
            clusters = response.json()
            print(f"✅ Document clustering working:")
            print(f"   Total clusters: {clusters.get('total_clusters', 0)}")
            print(f"   Method: {clusters.get('clustering_method', 'Unknown')}")

            if clusters.get("clusters"):
                for i, cluster in enumerate(clusters["clusters"][:2], 1):
                    print(
                        f"   Cluster {i}: {cluster['size']} documents - {', '.join(cluster['keywords'][:3])}"
                    )
            else:
                print(f"   Message: {clusters.get('message', 'No clusters found')}")

            return True
        else:
            print(f"❌ Document clustering failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Document clustering error: {e}")
        return False


def test_document_search():
    """Test document search functionality."""
    print("\n🔍 Testing document search...")
    try:
        test_data = {"query": "artificial intelligence machine learning", "top_k": 5}

        response = requests.post(f"{BASE_URL}/api/document-search", json=test_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Document search working:")
            print(f"   Results found: {data.get('total_found', 0)}")
            print(f"   Search time: {data.get('search_time', 0):.3f}s")
            return True
        else:
            print(f"❌ Document search failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Document search error: {e}")
        return False


def test_podcast_scenarios():
    """Test different podcast generation scenarios."""
    print("\n🎙️ Testing podcast scenarios...")

    scenarios = [
        {
            "name": "Scenario 1: Persona + Job + PDFs",
            "data": {
                "selected_text": "",
                "related_insights": [],
                "document": "test_document.pdf",
                "page_number": 1,
                "persona": "researcher",
                "job": "understanding AI applications",
            },
        },
        {
            "name": "Scenario 2: Selected text only",
            "data": {
                "selected_text": "machine learning algorithms and neural networks",
                "related_insights": [],
                "document": "test_document.pdf",
                "page_number": 1,
            },
        },
        {
            "name": "Scenario 3: PDFs only",
            "data": {
                "selected_text": "",
                "related_insights": [
                    {
                        "document": "research_paper.pdf",
                        "page_number": 3,
                        "section_title": "Research Findings",
                        "relevant_text": "Machine learning shows promising results",
                        "relevance_score": 0.8,
                        "insight_type": "relevant",
                        "jump_url": "/files/research_paper.pdf#page=3",
                    }
                ],
                "document": "test_document.pdf",
                "page_number": 1,
            },
        },
        {
            "name": "Scenario 4: All parameters",
            "data": {
                "selected_text": "artificial intelligence in modern computing",
                "related_insights": [
                    {
                        "document": "research_paper.pdf",
                        "page_number": 5,
                        "section_title": "AI Applications",
                        "relevant_text": "AI applications are transforming industries",
                        "relevance_score": 0.9,
                        "insight_type": "relevant",
                        "jump_url": "/files/research_paper.pdf#page=5",
                    }
                ],
                "document": "test_document.pdf",
                "page_number": 1,
                "persona": "developer",
                "job": "implementing AI solutions",
            },
        },
    ]

    success_count = 0
    for scenario in scenarios:
        try:
            print(f"   Testing {scenario['name']}...")
            response = requests.post(
                f"{BASE_URL}/api/enhanced-podcast", json=scenario["data"]
            )
            if response.status_code == 200:
                print(f"   ✅ {scenario['name']} - SUCCESS")
                success_count += 1
            else:
                print(f"   ❌ {scenario['name']} - FAILED ({response.status_code})")
        except Exception as e:
            print(f"   ❌ {scenario['name']} - ERROR: {e}")

    print(f"   📊 Podcast scenarios: {success_count}/{len(scenarios)} successful")
    return success_count == len(scenarios)


def test_pdf_upload_and_indexing():
    """Test PDF upload and indexing functionality."""
    print("\n📤 Testing PDF upload and indexing...")
    try:
        # Check if we have PDFs in the files directory
        files_dir = os.path.join(os.path.dirname(__file__), "files")
        if not os.path.exists(files_dir):
            print("   ⚠️ No files directory found")
            return False

        pdf_files = [f for f in os.listdir(files_dir) if f.lower().endswith(".pdf")]
        if not pdf_files:
            print("   ⚠️ No PDF files found in files directory")
            return False

        print(f"   📄 Found {len(pdf_files)} PDF files: {', '.join(pdf_files[:3])}")

        # Test if documents are indexed
        stats_response = requests.get(f"{BASE_URL}/api/index/stats")
        if stats_response.status_code == 200:
            stats = stats_response.json()
            if stats.get("total_documents", 0) > 0:
                print(f"   ✅ {stats['total_documents']} documents are indexed")
                return True
            else:
                print("   ⚠️ No documents indexed yet - triggering index rebuild...")
                # Try to rebuild the index
                rebuild_response = requests.post(f"{BASE_URL}/api/index/rebuild")
                if rebuild_response.status_code == 200:
                    print("   ✅ Index rebuild triggered")
                    return True
                else:
                    print(f"   ❌ Index rebuild failed: {rebuild_response.status_code}")
                    return False
        else:
            print(f"   ❌ Failed to get index stats: {stats_response.status_code}")
            return False

    except Exception as e:
        print(f"   ❌ PDF upload/indexing test error: {e}")
        return False


def main():
    """Run all tests."""
    print("🧪 Adobe Hackathon Finale - Comprehensive Fixes Test")
    print("=" * 60)

    # Wait for server to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(3)

    tests = [
        ("Health Check", test_health),
        ("Document Index", test_document_index),
        ("Text Selection API", test_text_selection_api),
        ("Enhanced Podcast API", test_enhanced_podcast_api),
        ("Document Clustering", test_document_clustering),
        ("Document Search", test_document_search),
        ("Podcast Scenarios", test_podcast_scenarios),
        ("PDF Upload and Indexing", test_pdf_upload_and_indexing),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))

    # Summary
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")

    print(f"\n📊 Overall: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! The fixes are working correctly.")
    else:
        print("⚠️ Some tests failed. Check the logs above for details.")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
