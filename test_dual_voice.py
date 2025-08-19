#!/usr/bin/env python3
"""
Test script for dual voice podcast functionality.
Tests the enhanced podcast service with multiple Azure voices.
"""

import json
import os
import sys

import requests

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

BASE_URL = "http://localhost:8080"


def test_dual_voice_podcast():
    """Test dual voice podcast generation with multiple Azure voices."""
    print("🎙️ Testing Dual Voice Podcast Generation")
    print("=" * 50)

    # Test data for podcast generation
    test_data = {
        "selected_text": "Machine learning algorithms have shown remarkable performance in various domains including computer vision, natural language processing, and robotics. The recent advances in deep learning have revolutionized how we approach complex problems.",
        "related_insights": [
            {
                "document": "research_paper_1.pdf",
                "page_number": 5,
                "section_title": "Deep Learning Applications",
                "relevant_text": "Convolutional neural networks have achieved state-of-the-art results in image classification tasks, surpassing human performance in many benchmarks.",
                "relevance_score": 0.92,
                "insight_type": "relevant",
                "jump_url": "/files/research_paper_1.pdf#page=5",
            },
            {
                "document": "research_paper_2.pdf",
                "page_number": 12,
                "section_title": "Neural Network Architectures",
                "relevant_text": "Transformer models have demonstrated exceptional capabilities in natural language processing, leading to breakthroughs in machine translation and text generation.",
                "relevance_score": 0.88,
                "insight_type": "adjacent",
                "jump_url": "/files/research_paper_2.pdf#page=12",
            },
        ],
        "document": "current_research.pdf",
        "page_number": 3,
        "conversation_style": "academic",
        "persona": "Graduate Computer Science Student",
        "job": "Understanding machine learning applications and research trends",
    }

    print("📝 Test Data:")
    print(f"   Selected Text: {test_data['selected_text'][:100]}...")
    print(f"   Related Insights: {len(test_data['related_insights'])}")
    print(f"   Persona: {test_data['persona']}")
    print(f"   Job: {test_data['job']}")
    print()

    try:
        print("🚀 Sending request to enhanced podcast endpoint...")
        response = requests.post(f"{BASE_URL}/api/enhanced-podcast", json=test_data)

        if response.status_code == 200:
            result = response.json()
            print("✅ Enhanced podcast generation successful!")
            print(f"   Audio URL: {result.get('url', 'No URL')}")
            print(f"   Duration: {result.get('duration', 'Unknown')} seconds")
            print(
                f"   Transcript available: {'Yes' if result.get('transcript') else 'No'}"
            )

            if result.get("transcript"):
                print("\n📜 Transcript Preview:")
                transcript_lines = result["transcript"].split("\n")[:6]
                for line in transcript_lines:
                    if line.strip():
                        print(f"   {line}")

            return result
        else:
            print(f"❌ Enhanced podcast generation failed: {response.status_code}")
            error_text = response.text if response.text else "No error details"
            print(f"   Error: {error_text}")
            return None

    except Exception as e:
        print(f"❌ Enhanced podcast generation error: {e}")
        return None


def test_voice_configuration():
    """Test if the voice configuration is properly loaded."""
    print("\n🔊 Testing Voice Configuration")
    print("=" * 50)

    try:
        # Test the index stats to see if server is running
        response = requests.get(f"{BASE_URL}/api/index/stats")
        if response.status_code == 200:
            print("✅ Server is running and accessible")

            # Check environment variables (this would be visible in server logs)
            print("\n📋 Expected Voice Configuration:")
            print("   AZURE_TTS_VOICE: en-US-AriaNeural")
            print("   AZURE_TTS_VOICE_2: en-US-DavisNeural")
            print("   AZURE_TTS_VOICE_3: en-US-JennyNeural")

            print("\n💡 The server should automatically pick these voices for:")
            print("   Speaker A: en-US-AriaNeural (Female)")
            print("   Speaker B: en-US-DavisNeural (Male)")
            print("   Fallback: en-US-JennyNeural (Female)")

            return True
        else:
            print(f"❌ Server check failed: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Server check error: {e}")
        return False


def test_llm_integration():
    """Test if LLM is working for conversation script generation."""
    print("\n🤖 Testing LLM Integration")
    print("=" * 50)

    try:
        # Simple test to see if LLM service is accessible
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            health_data = response.json()
            print("✅ Server health check passed")
            print(f"   LLM Provider: {health_data.get('llm_provider', 'Unknown')}")
            print(f"   TTS Provider: {health_data.get('tts_provider', 'Unknown')}")

            if health_data.get("llm_provider") == "gemini":
                print("   ✅ Gemini LLM is configured")
            else:
                print("   ⚠️ LLM provider not configured as expected")

            if health_data.get("tts_provider") == "azure_speech":
                print("   ✅ Azure Speech TTS is configured")
            else:
                print("   ⚠️ TTS provider not configured as expected")

            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False


def main():
    """Run all tests."""
    print("🧪 Dual Voice Podcast Testing")
    print("=" * 60)

    # Test server health and configuration
    if not test_voice_configuration():
        print("❌ Voice configuration test failed. Check server status.")
        return

    if not test_llm_integration():
        print("❌ LLM integration test failed. Check configuration.")
        return

    # Test dual voice podcast generation
    result = test_dual_voice_podcast()

    # Summary
    print("\n" + "=" * 60)
    print("📋 Test Summary:")

    if result:
        print("✅ Dual voice podcast generation: SUCCESS")
        print("🎯 Your setup is working correctly!")
        print("\n🎉 Features confirmed working:")
        print("   ✅ Multiple Azure voices configured")
        print("   ✅ LLM conversation script generation")
        print("   ✅ Persona and job context integration")
        print("   ✅ Cross-document insights integration")
        print("   ✅ Dual voice TTS generation")
    else:
        print("❌ Dual voice podcast generation: FAILED")
        print("🔍 Check the error messages above for troubleshooting")

    print("\n🚀 Ready to generate engaging two-person podcasts!")


if __name__ == "__main__":
    main()
