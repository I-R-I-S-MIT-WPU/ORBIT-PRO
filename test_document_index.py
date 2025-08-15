#!/usr/bin/env python3
"""
Test script for document indexing functionality.
Tests the performance improvements and vector storage capabilities.
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


def test_document_search():
    """Test document search functionality."""
    print("\n🔍 Testing document search...")

    # Test search query
    search_query = "machine learning"

    try:
        response = requests.post(
            f"{BASE_URL}/api/document-search", json={"query": search_query, "top_k": 5}
        )

        if response.status_code == 200:
            results = response.json()
            print(f"✅ Document search successful:")
            print(f"   Query: '{search_query}'")
            print(f"   Found: {results['total_found']} results")
            print(f"   Search time: {results['search_time']:.3f}s")

            for i, result in enumerate(results["results"][:3], 1):
                print(
                    f"   {i}. {result['document']} (p.{result['page_number']}) - {result['similarity_score']:.3f}"
                )

            return results
        else:
            print(f"❌ Document search failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Document search error: {e}")
        return None


def test_text_selection():
    """Test text selection functionality."""
    print("\n📝 Testing text selection...")

    # Test text selection
    selected_text = "artificial intelligence and neural networks"

    try:
        response = requests.post(
            f"{BASE_URL}/api/text-selection",
            json={
                "selected_text": selected_text,
                "document": "sample.pdf",  # This should be a real uploaded document
                "page_number": 1,
            },
        )

        if response.status_code == 200:
            results = response.json()
            print(f"✅ Text selection successful:")
            print(f"   Selected text: '{selected_text[:50]}...'")
            print(f"   Found insights: {len(results['insights'])}")
            print(f"   Summary: {results['summary'][:100]}...")

            for i, insight in enumerate(results["insights"][:3], 1):
                print(
                    f"   {i}. {insight['document']} - {insight['insight_type']} ({insight['relevance_score']:.3f})"
                )

            return results
        else:
            print(f"❌ Text selection failed: {response.status_code}")
            if response.status_code == 400:
                print("   (This is expected if no documents are uploaded)")
            return None
    except Exception as e:
        print(f"❌ Text selection error: {e}")
        return None


def test_index_rebuild():
    """Test index rebuild functionality."""
    print("\n🔄 Testing index rebuild...")

    try:
        response = requests.post(f"{BASE_URL}/api/index/rebuild")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Index rebuild started: {result}")
            return True
        else:
            print(f"❌ Index rebuild failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Index rebuild error: {e}")
        return False


def performance_comparison():
    """Compare performance with and without indexing."""
    print("\n⚡ Performance comparison...")

    # Test search performance
    search_query = "deep learning"

    try:
        # Test with document index (should be fast)
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/document-search", json={"query": search_query, "top_k": 10}
        )
        indexed_time = time.time() - start_time

        if response.status_code == 200:
            results = response.json()
            print(
                f"✅ Indexed search: {indexed_time:.3f}s for {results['total_found']} results"
            )
        else:
            print(f"❌ Indexed search failed: {response.status_code}")
            return

        # Test text selection performance (also uses index)
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/text-selection",
            json={
                "selected_text": search_query,
                "document": "sample.pdf",
                "page_number": 1,
            },
        )
        selection_time = time.time() - start_time

        if response.status_code == 200:
            results = response.json()
            print(
                f"✅ Text selection: {selection_time:.3f}s for {len(results['insights'])} insights"
            )
        else:
            print(f"❌ Text selection failed: {response.status_code}")

        # Performance assessment
        if indexed_time < 1.0:
            print("🚀 Excellent performance! Index is working well.")
        elif indexed_time < 3.0:
            print("⚡ Good performance. Index is functioning.")
        else:
            print("🐌 Slow performance. May need optimization.")

    except Exception as e:
        print(f"❌ Performance test error: {e}")


def main():
    """Run all tests."""
    print("🧪 Document Index Testing Suite")
    print("=" * 50)

    # Test health first
    if not test_health():
        print("❌ Server not running. Please start the server first.")
        return

    # Test index stats
    stats = test_index_stats()

    # Test document search
    search_results = test_document_search()

    # Test text selection
    selection_results = test_text_selection()

    # Test index rebuild
    rebuild_success = test_index_rebuild()

    # Performance comparison
    performance_comparison()

    # Summary
    print("\n" + "=" * 50)
    print("📋 Test Summary:")
    print(f"   Health: ✅")
    print(f"   Index Stats: {'✅' if stats else '❌'}")
    print(f"   Document Search: {'✅' if search_results else '❌'}")
    print(f"   Text Selection: {'✅' if selection_results else '❌'}")
    print(f"   Index Rebuild: {'✅' if rebuild_success else '❌'}")

    if stats:
        print(f"\n📊 Index Statistics:")
        print(f"   Total Documents: {stats.get('total_documents', 0)}")
        print(f"   Total Chunks: {stats.get('total_chunks', 0)}")

    print("\n🎉 Testing complete!")


if __name__ == "__main__":
    main()
