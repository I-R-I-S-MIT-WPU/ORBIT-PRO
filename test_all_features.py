#!/usr/bin/env python3
"""
Comprehensive test script for Adobe Hackathon Finale features.
Tests all new functionality including document indexing, clustering, recommendations, and enhanced podcasts.
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


def test_index_stats():
    """Test the index statistics endpoint."""
    print("\n📊 Testing index statistics...")
    try:
        response = requests.get(f"{BASE_URL}/api/index/stats")
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Index stats: {json.dumps(stats, indent=2)}")
            return stats
        else:
            print(f"❌ Index stats failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Index stats error: {e}")
        return None


def test_document_clustering():
    """Test document clustering functionality."""
    print("\n🔗 Testing document clustering...")
    try:
        response = requests.get(f"{BASE_URL}/api/index/clusters?n_clusters=3")
        if response.status_code == 200:
            clusters = response.json()
            print(f"✅ Document clustering successful:")
            print(f"   Total clusters: {clusters.get('total_clusters', 0)}")
            print(f"   Method: {clusters.get('clustering_method', 'Unknown')}")

            if clusters.get("clusters"):
                for i, cluster in enumerate(clusters["clusters"][:2], 1):
                    print(
                        f"   Cluster {i}: {cluster['size']} documents - {', '.join(cluster['keywords'][:3])}"
                    )

            return clusters
        else:
            print(f"❌ Document clustering failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Document clustering error: {e}")
        return None


def test_document_recommendations():
    """Test document recommendations functionality."""
    print("\n💡 Testing document recommendations...")
    try:
        # First get list of documents
        docs_response = requests.get(f"{BASE_URL}/api/documents")
        if docs_response.status_code != 200:
            print("❌ Could not get documents list")
            return None

        documents = docs_response.json()
        if not documents:
            print("❌ No documents available for testing recommendations")
            return None

        # Test recommendations for first document
        test_doc = documents[0]["filename"]
        response = requests.get(
            f"{BASE_URL}/api/index/recommendations/{test_doc}?top_k=3"
        )

        if response.status_code == 200:
            recommendations = response.json()
            print(f"✅ Document recommendations successful:")
            print(f"   Current document: {recommendations['current_document']}")
            print(
                f"   Total recommendations: {recommendations['total_recommendations']}"
            )

            for i, rec in enumerate(recommendations["recommendations"][:2], 1):
                print(f"   {i}. {rec['document']} - {rec['similarity_score']:.3f}")

            return recommendations
        else:
            print(f"❌ Document recommendations failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Document recommendations error: {e}")
        return None


def test_incremental_update_status():
    """Test incremental update status functionality."""
    print("\n🔄 Testing incremental update status...")
    try:
        response = requests.get(f"{BASE_URL}/api/index/incremental-status")
        if response.status_code == 200:
            status = response.json()
            print(f"✅ Incremental update status successful:")
            print(f"   Total files checked: {status['total_files_checked']}")
            print(f"   Documents up to date: {len(status['documents_up_to_date'])}")
            print(f"   Documents to update: {len(status['documents_to_update'])}")

            if status["documents_to_update"]:
                for doc in status["documents_to_update"][:2]:
                    print(f"   - {doc['document']}: {doc['reason']}")

            return status
        else:
            print(f"❌ Incremental update status failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Incremental update status error: {e}")
        return None


def test_incremental_update():
    """Test incremental update functionality."""
    print("\n🔄 Testing incremental update...")
    try:
        response = requests.post(f"{BASE_URL}/api/index/incremental-update")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Incremental update successful:")
            print(f"   Message: {result.get('message', 'No message')}")
            print(f"   Updated documents: {len(result.get('updated', {}))}")
            return result
        else:
            print(f"❌ Incremental update failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Incremental update error: {e}")
        return None


def test_enhanced_podcast():
    """Test enhanced podcast generation."""
    print("\n🎙️ Testing enhanced podcast generation...")
    try:
        # Test data for podcast generation
        test_data = {
            "selected_text": "Machine learning algorithms have shown remarkable performance in various domains including computer vision, natural language processing, and robotics.",
            "related_insights": [
                {
                    "document": "test_document.pdf",
                    "page_number": 1,
                    "section_title": "Introduction",
                    "relevant_text": "Recent advances in deep learning have revolutionized the field of artificial intelligence.",
                    "relevance_score": 0.85,
                    "insight_type": "relevant",
                    "jump_url": "/files/test_document.pdf#page=1",
                }
            ],
            "document": "test_document.pdf",
            "page_number": 1,
            "conversation_style": "academic",
            "persona": "Graduate Computer Science Student",
            "job": "Understanding machine learning applications in AI",
        }

        response = requests.post(f"{BASE_URL}/api/enhanced-podcast", json=test_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Enhanced podcast generation successful:")
            print(f"   Audio URL: {result.get('url', 'No URL')}")
            print(f"   Duration: {result.get('duration', 'Unknown')} seconds")
            print(
                f"   Transcript available: {'Yes' if result.get('transcript') else 'No'}"
            )
            return result
        else:
            print(f"❌ Enhanced podcast generation failed: {response.status_code}")
            error_text = response.text if response.text else "No error details"
            print(f"   Error: {error_text}")
            return None
    except Exception as e:
        print(f"❌ Enhanced podcast generation error: {e}")
        return None


def test_text_selection():
    """Test text selection functionality."""
    print("\n📝 Testing text selection...")
    try:
        test_data = {
            "selected_text": "Neural networks and deep learning have transformed the landscape of artificial intelligence research.",
            "document": "test_document.pdf",
            "page_number": 1,
            "persona": "Research Scientist",
            "job": "Analyzing AI research trends",
        }

        response = requests.post(f"{BASE_URL}/api/text-selection", json=test_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Text selection successful:")
            print(f"   Selected text: {result.get('selected_text', 'No text')[:50]}...")
            print(f"   Insights found: {len(result.get('insights', []))}")
            print(f"   Summary: {result.get('summary', 'No summary')[:100]}...")
            return result
        else:
            print(f"❌ Text selection failed: {response.status_code}")
            if response.status_code == 400:
                print("   (This is expected if no documents are uploaded)")
            return None
    except Exception as e:
        print(f"❌ Text selection error: {e}")
        return None


def test_document_search():
    """Test document search functionality."""
    print("\n🔍 Testing document search...")
    try:
        test_data = {"query": "artificial intelligence machine learning", "top_k": 5}

        response = requests.post(f"{BASE_URL}/api/document-search", json=test_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Document search successful:")
            print(f"   Query: '{test_data['query']}'")
            print(f"   Found: {result['total_found']} results")
            print(f"   Search time: {result['search_time']:.3f}s")

            for i, search_result in enumerate(result["results"][:3], 1):
                print(
                    f"   {i}. {search_result['document']} (p.{search_result['page_number']}) - {search_result['similarity_score']:.3f}"
                )

            return result
        else:
            print(f"❌ Document search failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Document search error: {e}")
        return None


def test_delete_functionality():
    """Test document deletion functionality."""
    print("\n🗑️ Testing document deletion...")
    try:
        # First get list of documents
        docs_response = requests.get(f"{BASE_URL}/api/documents")
        if docs_response.status_code != 200:
            print("❌ Could not get documents list")
            return None

        documents = docs_response.json()
        if not documents:
            print("❌ No documents available for testing deletion")
            return None

        # Test deletion of first document
        test_doc = documents[0]["filename"]
        print(f"   Testing deletion of: {test_doc}")

        response = requests.delete(f"{BASE_URL}/api/documents/{test_doc}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Document deletion successful:")
            print(f"   Message: {result.get('message', 'No message')}")
            return result
        else:
            print(f"❌ Document deletion failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Document deletion error: {e}")
        return None


def performance_test():
    """Test performance of key operations."""
    print("\n⚡ Performance testing...")

    # Test search performance
    start_time = time.time()
    search_response = requests.post(
        f"{BASE_URL}/api/document-search",
        json={"query": "deep learning neural networks", "top_k": 10},
    )
    search_time = time.time() - start_time

    if search_response.status_code == 200:
        result = search_response.json()
        print(
            f"✅ Search performance: {search_time:.3f}s for {result['total_found']} results"
        )

        if search_time < 1.0:
            print("🚀 Excellent performance! Index is working well.")
        elif search_time < 3.0:
            print("⚡ Good performance. Index is functioning.")
        else:
            print("🐌 Slow performance. May need optimization.")
    else:
        print("❌ Search performance test failed")

    # Test clustering performance
    start_time = time.time()
    cluster_response = requests.get(f"{BASE_URL}/api/index/clusters?n_clusters=3")
    cluster_time = time.time() - start_time

    if cluster_response.status_code == 200:
        print(f"✅ Clustering performance: {cluster_time:.3f}s")

        if cluster_time < 5.0:
            print("🚀 Clustering performance is good.")
        elif cluster_time < 10.0:
            print("⚡ Clustering performance is acceptable.")
        else:
            print("🐌 Clustering is slow. Consider optimization.")
    else:
        print("❌ Clustering performance test failed")


def main():
    """Run all tests."""
    print("🧪 Adobe Hackathon Finale - Comprehensive Feature Testing")
    print("=" * 70)

    # Test health first
    if not test_health():
        print("❌ Server not running. Please start the server first.")
        return

    # Run all tests
    tests = [
        ("Index Statistics", test_index_stats),
        ("Document Clustering", test_document_clustering),
        ("Document Recommendations", test_document_recommendations),
        ("Incremental Update Status", test_incremental_update_status),
        ("Incremental Update", test_incremental_update),
        ("Text Selection", test_text_selection),
        ("Document Search", test_document_search),
        ("Enhanced Podcast", test_enhanced_podcast),
        ("Performance", performance_test),
        ("Document Deletion", test_delete_functionality),
    ]

    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results[test_name] = None

    # Summary
    print("\n" + "=" * 70)
    print("📋 Test Summary:")

    passed = 0
    total = len(tests)

    for test_name, result in results.items():
        status = "✅ PASS" if result is not None else "❌ FAIL"
        print(f"   {test_name}: {status}")
        if result is not None:
            passed += 1

    print(f"\n🎯 Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Your Adobe Hackathon Finale is working perfectly!")
    elif passed >= total * 0.8:
        print("👍 Most tests passed. Minor issues detected.")
    else:
        print("⚠️ Several tests failed. Check the implementation.")

    print("\n🚀 Ready for the hackathon finale!")


if __name__ == "__main__":
    main()
