import os
from typing import Dict, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables in the service
load_dotenv()


def get_llm_service():
    """Get the LLM service instance."""
    return LLMService()


class LLMService:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "gemini").lower()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        self.api_key = os.getenv("GOOGLE_API_KEY")

        print(f"🔍 LLM Service Debug:")
        print(f"   Provider: {self.provider}")
        print(f"   Model: {self.model}")
        print(f"   API Key: {'Set' if self.api_key else 'Not Set'}")
        print(f"   API Key length: {len(self.api_key) if self.api_key else 0}")

        if self.provider == "gemini" and self.api_key:
            # Configure Google Generative AI
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(self.model)
            print(f"✅ LLM client initialized successfully")
        else:
            self.client = None
            print(
                f"⚠️ LLM client not initialized. Provider: {self.provider}, API Key: {'Set' if self.api_key else 'Not Set'}"
            )

    def get_llm_response(self, messages: List[Dict[str, str]]) -> Optional[str]:
        """
        Get response from LLM service.

        Args:
                messages: List of message dictionaries with 'role' and 'content'

        Returns:
                LLM response text or None if failed
        """
        try:
            if not self.client:
                print("Error: LLM client not initialized")
                return None

            # Convert chat-style messages to a single prompt for Gemini
            prompt_parts: List[str] = []
            for m in messages or []:
                role = m.get("role")
                content = m.get("content", "")
                if not content:
                    continue
                if role == "system":
                    prompt_parts.append(f"[Instructions]\n{content}\n")
                elif role == "user":
                    prompt_parts.append(f"[User]\n{content}\n")
                else:
                    prompt_parts.append(content)

            prompt = "\n".join(prompt_parts).strip()
            if not prompt:
                print("Error: Empty prompt constructed for LLM")
                return None

            # Generate response
            response = self.client.generate_content(prompt)

            if response and hasattr(response, "text"):
                return response.text
            else:
                print("Error: Invalid response from Gemini")
                return None

        except Exception as e:
            print(f"Error getting LLM response: {e}")
            return None

    def generate_conversation_script(self, prompt: str) -> Optional[str]:
        pass
