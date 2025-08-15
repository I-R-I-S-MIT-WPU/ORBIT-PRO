"""
Enhanced podcast service: generates two-person conversations about selected text and related content.
Creates engaging audio discussions that compare, contrast, and explore connections across documents.
"""

import os
import re
import time
from typing import Dict, List, Optional

import numpy as np

from ..models.schemas import (
    CrossPDFInsight,
    EnhancedPodcastRequest,
    EnhancedPodcastResponse,
)
from .llm import get_llm_service
from .models.allminilml6v2 import get_embedding_model
from .tts import get_tts_service

# Get LLM and TTS services
llm = get_llm_service()
tts = get_tts_service()


def get_azure_voices() -> List[str]:
    """
    Get Azure voices from environment variables.
    Automatically picks available voices for dual-person conversations.
    """
    voices = []

    # Primary voice
    if os.getenv("AZURE_SPEECH_VOICE"):
        voices.append(os.getenv("AZURE_SPEECH_VOICE"))

    # Secondary voice
    if os.getenv("AZURE_SPEECH_VOICE_2"):
        voices.append(os.getenv("AZURE_SPEECH_VOICE_2"))

    # Tertiary voice (if needed)
    if os.getenv("AZURE_SPEECH_VOICE_3"):
        voices.append(os.getenv("AZURE_SPEECH_VOICE_3"))

    # Fallback voices if none configured
    if len(voices) < 2:
        voices.extend(["en-US-AriaNeural", "en-US-DavisNeural"])

    return voices[:3]  # Return up to 3 voices


def generate_conversation_script(
    selected_text: str,
    related_insights: List[CrossPDFInsight],
    conversation_style: str = "academic",
    persona: Optional[str] = None,
    job: Optional[str] = None,
) -> str:
    """
    Generate a two-person conversation script about the selected text and related insights.
    Ensures proper speaker identification and natural dialogue flow.
    """
    try:
        # Build context from related insights
        context_summary = ""
        if related_insights:
            context_summary = "Related content from other documents:\n"
            for i, insight in enumerate(related_insights[:5], 1):
                context_summary += f"{i}. {insight.document} (p.{insight.page_number}): {insight.relevant_text[:100]}...\n"

        # Create persona-aware prompt
        persona_context = ""
        if persona:
            persona_context = (
                f"Context: The conversation should be tailored for a {persona}.\n"
            )

        job_context = ""
        if job:
            job_context = f"Focus: The discussion should help with the job: {job}.\n"

        # Style-specific instructions
        style_instructions = {
            "academic": "Use formal academic language, reference specific findings, and discuss implications.",
            "casual": "Use conversational, accessible language with relatable examples and clear explanations.",
            "technical": "Use precise technical terminology, focus on methodology and implementation details.",
        }

        style_guide = style_instructions.get(
            conversation_style, style_instructions["academic"]
        )

        prompt = f"""
        Create a natural, engaging two-person conversation script about the selected text from a research document.
        
        {persona_context}
        {job_context}
        Style: {style_guide}
        
        Selected Text: "{selected_text}"
        
        {context_summary}
        
        Requirements:
        1. Create a dialogue between TWO distinct speakers: "Host" and "Guest"
        2. Each speaker should have a unique perspective and voice
        3. Host should introduce the selected text and ask questions
        4. Guest should provide analysis and connect to related content
        5. Include specific references to page numbers and document names when relevant
        6. Make the conversation flow naturally with questions and responses
        7. Keep each speaker's lines concise (1-2 sentences max)
        8. Focus on insights, connections, and implications
        9. If possible, reference relevant information from the web/internet that relates to the selected text
        10. Make the conversation engaging and educational
        
        Format the script like this:
        Host: [Line of dialogue]
        Guest: [Response and analysis]
        Host: [Follow-up question or observation]
        Guest: [Further explanation or connection]
        [Continue for 8-12 exchanges total]
        
        Make sure the conversation is engaging and provides valuable insights about the selected text and its connections to other documents and broader knowledge.
        """

        response = llm.get_llm_response([{"role": "user", "content": prompt}])

        if response and "Host:" in response and "Guest:" in response:
            return response.strip()
        else:
            # Fallback if LLM doesn't follow format
            return generate_fallback_script(
                selected_text, related_insights, conversation_style, persona, job
            )

    except Exception as e:
        print(f"Error generating conversation script: {e}")
        return generate_fallback_script(
            selected_text, related_insights, conversation_style, persona, job
        )


def generate_fallback_script(
    selected_text: str,
    related_insights: List[CrossPDFInsight],
    conversation_style: str = "academic",
    persona: Optional[str] = None,
    job: Optional[str] = None,
) -> str:
    """
    Generate a fallback conversation script if LLM generation fails.
    """
    # Extract key information
    selected_summary = (
        selected_text[:200] + "..." if len(selected_text) > 200 else selected_text
    )

    # Create a simple but effective two-person conversation
    script = f"""Host: I found this interesting section in the document: "{selected_summary}"
Guest: That's fascinating! Let me analyze what this means in the broader context.
Host: What connections do you see with other documents we've been studying?
Guest: Well, looking at the related content, I notice several important patterns emerging.
Host: Can you elaborate on those patterns and their implications?
Guest: Absolutely. The selected text connects to multiple research areas we've covered.
Host: How does this relate to the main concepts we're trying to understand?
Guest: This section provides a crucial bridge between different theoretical frameworks.
Host: What should we focus on next to deepen our understanding?
Guest: I'd recommend exploring the connections we've identified in more detail."""

    # Add persona-specific modifications
    if persona and "student" in persona.lower():
        script += "\nHost: How would you explain this to someone just starting to learn about this topic?"
        script += "\nGuest: Great question! Let me break this down in simpler terms."

    # Add job-specific modifications
    if job and "identify" in job.lower():
        script += (
            "\nHost: What are the key concepts we should highlight from this analysis?"
        )
        script += "\nGuest: Based on our discussion, I'd identify three main takeaways."

    return script


def enhance_script_for_tts(script: str) -> str:
    """
    Enhance the script with TTS-friendly formatting and natural speech patterns.
    """
    # Add pauses and emphasis for better TTS quality
    enhanced = script

    # Add pauses after speaker names
    enhanced = re.sub(r"([A-Za-z\s]+):", r"\1: [pause]", enhanced)

    # Add emphasis on key terms
    enhanced = re.sub(
        r"(\b[A-Z][A-Za-z\s]{3,}\b)", r"<emphasis>\1</emphasis>", enhanced
    )

    # Add natural pauses
    enhanced = re.sub(r"([.!?])\s+", r"\1 [pause] ", enhanced)

    # Add breathing pauses for longer sentences
    enhanced = re.sub(r"([,;])\s+", r"\1 [short pause] ", enhanced)

    return enhanced


def generate_dual_voice_podcast(
    script: str,
    output_file: str,
    voice1: str = None,
    voice2: str = None,
) -> Dict:
    """
    Generate a podcast with two different voices for the conversation.
    Automatically picks voices from environment variables if not specified.
    """
    try:
        # Get available Azure voices
        available_voices = get_azure_voices()

        # Use provided voices or pick from available ones
        if not voice1:
            voice1 = (
                available_voices[0] if len(available_voices) > 0 else "en-US-AriaNeural"
            )
        if not voice2:
            voice2 = (
                available_voices[1]
                if len(available_voices) > 1
                else "en-US-DavisNeural"
            )

        print(f"Using voices: {voice1} (Host) and {voice2} (Guest)")

        # Split script into speaker segments
        speaker_segments = []
        current_speaker = None
        current_text = ""

        lines = script.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if this is a speaker line
            if ":" in line and not line.startswith("["):
                # Save previous speaker's text
                if current_speaker and current_text:
                    speaker_segments.append(
                        {
                            "speaker": current_speaker,
                            "text": current_text.strip(),
                            "voice": (voice1 if current_speaker == "Host" else voice2),
                        }
                    )

                # Start new speaker
                parts = line.split(":", 1)
                current_speaker = parts[0].strip()
                current_text = parts[1].strip() if len(parts) > 1 else ""
            else:
                # Continue current speaker's text
                if current_text:
                    current_text += " " + line
                else:
                    current_text = line

        # Add the last speaker
        if current_speaker and current_text:
            speaker_segments.append(
                {
                    "speaker": current_speaker,
                    "text": current_text.strip(),
                    "voice": voice1 if current_speaker == "Host" else voice2,
                }
            )

        # Generate audio for each segment
        audio_segments = []
        total_duration = 0

        for i, segment in enumerate(speaker_segments):
            print(
                f"Generating audio for {segment['speaker']} using voice {segment['voice']}"
            )

            # Add delay between requests to avoid rate limiting
            if i > 0:
                import time

                time.sleep(0.5)  # 500ms delay between requests

            # Generate audio for this segment
            try:
                # Escape SSML characters to prevent Azure TTS errors
                safe_text = escape_ssml_text(segment["text"])

                segment_audio = tts.generate_speech(
                    text=safe_text,
                    output_file=f"temp_segment_{i}.mp3",
                    voice=segment["voice"],
                )

                if segment_audio and segment_audio.get("success"):
                    # Store the file path and metadata
                    audio_segments.append(
                        {
                            "file_path": f"temp_segment_{i}.mp3",  # Store actual file path
                            "duration": segment_audio.get("duration", 0),
                            "speaker": segment["speaker"],
                            "voice": segment["voice"],
                            "metadata": segment_audio,  # Store full metadata
                        }
                    )
                    total_duration += segment_audio.get("duration", 0)
                    print(
                        f"✅ Generated audio for {segment['speaker']}: {segment_audio.get('duration', 0):.1f}s"
                    )
                else:
                    print(
                        f"❌ Failed to generate audio for segment {i}: {segment_audio.get('error', 'Unknown error')}"
                    )

            except Exception as e:
                print(f"❌ Error generating audio for segment {i}: {e}")
                # Continue with other segments instead of failing completely
                continue

        if not audio_segments:
            raise Exception("No audio segments were generated successfully")

        # Combine all audio segments into one file
        print(f"Combining {len(audio_segments)} audio segments...")

        # Use proper audio concatenation instead of just copying the first segment
        try:
            # Import pydub for proper audio concatenation
            from pydub import AudioSegment

            # Load all audio segments
            combined_audio = None
            for segment in audio_segments:
                temp_file = segment["file_path"]
                temp_path = os.path.join(os.getcwd(), temp_file)

                if os.path.exists(temp_path):
                    try:
                        # Load the audio segment
                        audio_segment = AudioSegment.from_mp3(temp_path)

                        # Add a small pause between segments for better flow
                        if combined_audio is not None:
                            pause = AudioSegment.silent(duration=200)  # 200ms pause
                            combined_audio = combined_audio + pause + audio_segment
                        else:
                            combined_audio = audio_segment

                        print(
                            f"✅ Added segment: {segment['speaker']} ({audio_segment.duration_seconds:.1f}s)"
                        )
                    except Exception as e:
                        print(f"⚠️ Warning: Could not load segment {temp_file}: {e}")
                        continue
                else:
                    print(f"⚠️ Warning: Temp file not found: {temp_path}")

            if combined_audio:
                # Export the combined audio
                final_path = os.path.join(os.getcwd(), output_file)
                combined_audio.export(final_path, format="mp3")

                print(
                    f"✅ Successfully combined {len(audio_segments)} segments into: {output_file}"
                )
                print(f"📊 Total duration: {combined_audio.duration_seconds:.1f}s")

                # Clean up temp files
                for segment in audio_segments:
                    temp_file = segment["file_path"]
                    temp_path = os.path.join(os.getcwd(), temp_file)
                    if os.path.exists(temp_path):
                        try:
                            os.remove(temp_path)
                            print(f"🧹 Cleaned up temp file: {temp_file}")
                        except Exception as e:
                            print(
                                f"⚠️ Warning: Could not remove temp file {temp_file}: {e}"
                            )

                return {
                    "url": f"/static/{os.path.basename(output_file)}",
                    "duration": combined_audio.duration_seconds,
                    "segments": len(audio_segments),
                    "voices_used": [voice1, voice2],
                    "total_duration": combined_audio.duration_seconds,
                }
            else:
                raise Exception(
                    "No valid audio segments could be loaded for combination"
                )

        except ImportError:
            print("⚠️ Pydub not available, falling back to simple concatenation")
            # Fallback: use ffmpeg or simple file concatenation
            try:
                import subprocess

                # Create a file list for ffmpeg
                file_list_path = "temp_file_list.txt"
                with open(file_list_path, "w") as f:
                    for segment in audio_segments:
                        temp_file = segment["file_path"]
                        temp_path = os.path.join(os.getcwd(), temp_file)
                        if os.path.exists(temp_path):
                            f.write(f"file '{temp_path}'\n")

                # Use ffmpeg to concatenate
                final_path = os.path.join(os.getcwd(), output_file)
                cmd = [
                    "ffmpeg",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    file_list_path,
                    "-c",
                    "copy",
                    final_path,
                    "-y",
                ]

                result = subprocess.run(cmd, capture_output=True, text=True)

                if result.returncode == 0:
                    print(f"✅ Successfully combined audio using ffmpeg: {output_file}")

                    # Clean up temp files
                    for segment in audio_segments:
                        temp_file = segment["file_path"]
                        temp_path = os.path.join(os.getcwd(), temp_file)
                        if os.path.exists(temp_path):
                            try:
                                os.remove(temp_path)
                                print(f"🧹 Cleaned up temp file: {temp_file}")
                            except Exception as e:
                                print(
                                    f"⚠️ Warning: Could not remove temp file {temp_file}: {e}"
                                )

                    # Clean up file list
                    if os.path.exists(file_list_path):
                        os.remove(file_list_path)

                    return {
                        "url": f"/static/{os.path.basename(output_file)}",
                        "duration": total_duration,
                        "segments": len(audio_segments),
                        "voices_used": [voice1, voice2],
                        "total_duration": total_duration,
                    }
                else:
                    print(f"❌ FFmpeg failed: {result.stderr}")
                    raise Exception(f"FFmpeg concatenation failed: {result.stderr}")

            except Exception as e:
                print(f"❌ FFmpeg fallback failed: {e}")
                # Last resort: just copy the first segment
                print("⚠️ Using last resort: copying first segment only")
                main_segment = audio_segments[0]
                temp_file = main_segment["file_path"]
                temp_path = os.path.join(os.getcwd(), temp_file)

                if os.path.exists(temp_path):
                    final_path = os.path.join(os.getcwd(), output_file)
                    shutil.copy2(temp_path, final_path)

                    # Clean up temp files
                    for segment in audio_segments:
                        temp_file = segment["file_path"]
                        temp_path = os.path.join(os.getcwd(), temp_file)
                        if os.path.exists(temp_path):
                            try:
                                os.remove(temp_path)
                                print(f"🧹 Cleaned up temp file: {temp_file}")
                            except Exception as e:
                                print(
                                    f"⚠️ Warning: Could not remove temp file {temp_file}: {e}"
                                )

                    print(f"⚠️ Podcast generated with only first segment: {output_file}")
                    return {
                        "url": f"/static/{os.path.basename(output_file)}",
                        "duration": main_segment.get("duration", 0),
                        "segments": 1,
                        "voices_used": [voice1, voice2],
                        "total_duration": main_segment.get("duration", 0),
                        "warning": "Only first segment available due to concatenation failure",
                    }
                else:
                    raise Exception(f"Temp audio file not found: {temp_path}")

    except Exception as e:
        print(f"❌ Error generating dual voice podcast: {e}")
        return None


def generate_single_voice_podcast(script: str, output_file: str) -> Dict:
    """
    Generate a podcast with a single voice (fallback method).
    """
    try:
        # Clean up the script for single voice
        clean_script = re.sub(r"^[A-Za-z\s]+:\s*", "", script, flags=re.MULTILINE)
        clean_script = re.sub(r"\n+", " ", clean_script)
        clean_script = re.sub(r"\s+", " ", clean_script).strip()

        # Generate audio
        audio_result = tts.generate_speech(text=clean_script, output_file=output_file)

        if audio_result.get("success"):
            return {
                "url": audio_result["url"],
                "transcript": script,
                "duration": audio_result["duration"],
            }
        else:
            raise Exception(
                f"TTS generation failed: {audio_result.get('error', 'Unknown error')}"
            )

    except Exception as e:
        print(f"Error generating single voice podcast: {e}")
        return {"url": "", "transcript": script, "duration": 0, "error": str(e)}


def create_enhanced_podcast(
    request: EnhancedPodcastRequest, output_file: str, static_dir: str
) -> EnhancedPodcastResponse:
    """
    Create an enhanced podcast with two-person conversation based on different scenarios.

    Scenarios:
    1. Persona + Job + Selected PDFs
    2. Selected text only (no persona/job)
    3. Selected PDFs only (no persona/job/text)
    4. All: Persona + Job + Selected text + Selected PDFs
    """
    try:
        print(f"🎙️ Creating enhanced podcast for scenario analysis...")
        print(
            f"Selected text: {len(request.selected_text) if request.selected_text else 0} chars"
        )
        print(
            f"Related insights: {len(request.related_insights) if request.related_insights else 0}"
        )
        print(f"Document: {request.document}")
        print(f"Page: {request.page_number}")
        print(f"Persona: {request.persona}")
        print(f"Job: {request.job}")

        # Determine the scenario and generate appropriate script
        script = generate_scenario_based_script(request)

        if not script:
            raise Exception("Failed to generate conversation script")

        print(f"Generated script length: {len(script)} characters")

        # Generate dual voice podcast with Azure voices
        dual_result = generate_dual_voice_podcast_azure(script, output_file)

        if dual_result and dual_result.get("url"):
            print("✅ Dual voice podcast generated successfully!")
            print(f"Voices used: {dual_result.get('voices_used', [])}")

            return EnhancedPodcastResponse(
                url=dual_result["url"],
                transcript=script,
                duration=dual_result["duration"],
            )
        else:
            raise Exception("Failed to generate dual voice podcast")

    except Exception as e:
        print(f"Error creating enhanced podcast: {e}")
        raise Exception(f"Failed to create enhanced podcast: {str(e)}")


def generate_scenario_based_script(request: EnhancedPodcastRequest) -> str:
    """
    Generate podcast script based on the available information (4 scenarios).
    """
    try:
        # Build context based on available information
        context_parts = []

        # Scenario 1 & 4: Persona and Job context
        if request.persona or request.job:
            if request.persona:
                context_parts.append(
                    f"Context: The conversation should be tailored for a {request.persona}."
                )
            if request.job:
                context_parts.append(
                    f"Focus: The discussion should help with the job: {request.job}."
                )

        # Scenario 2 & 4: Selected text context
        if request.selected_text and request.selected_text.strip():
            context_parts.append(
                f"Selected Text: {request.selected_text[:200]}{'...' if len(request.selected_text) > 200 else ''}"
            )

            # For Scenario 2, emphasize that we should consider relevant info from past PDFs
            if not request.persona and not request.job:
                context_parts.append(
                    "Context: This is a text selection scenario. The conversation should explore the selected text in depth and connect it to relevant information from past uploaded PDFs and broader knowledge."
                )
        else:
            # Fallback for when no text is selected
            context_parts.append(
                "Content: General discussion about research documents and findings"
            )

        # Scenario 1, 3 & 4: Document context
        if request.document and request.document != "unknown":
            context_parts.append(f"Document: {request.document}")
            if request.page_number:
                context_parts.append(f"Page: {request.page_number}")

        # Scenario 1, 3 & 4: Related insights context
        if request.related_insights and len(request.related_insights) > 0:
            context_parts.append(
                f"Related Content: Found {len(request.related_insights)} relevant sections across documents"
            )
            for i, insight in enumerate(request.related_insights[:3], 1):
                context_parts.append(
                    f"{i}. {insight.document} (p.{insight.page_number}): {insight.relevant_text[:100]}..."
                )
        else:
            # Fallback for when no insights are available
            context_parts.append(
                "Related Content: Exploring general research topics and methodologies"
            )

        # Determine conversation style based on context
        conversation_style = "semi_formal"  # Default to semi-formal as requested

        # Generate the conversation script
        prompt = f"""
        Create a natural, engaging two-person conversation script for a podcast about the selected content.
        
        {' '.join(context_parts)}
        
        Style: {conversation_style} - Semi-casual to semi-formal but always relevant and professional. No BS, focus on real insights.
        
        Requirements:
        1. Two speakers: Host and Guest
        2. Natural conversation flow with questions, explanations, and insights
        3. Focus on relevancy and real value - no fluff
        4. Include specific references to the content when available
        5. Make it engaging and informative
        6. Keep it conversational but professional
        7. If specific content is limited, create a general but valuable discussion about research and learning
        8. When related insights from other documents are available, actively reference and discuss them
        9. Draw connections between the selected text and broader research context
        10. If no specific insights are available, discuss the selected text in the context of general research principles and methodologies
        
        Format:
        Host: [Host's dialogue]
        Guest: [Guest's dialogue]
        
        Generate a 2-3 minute conversation script.
        """

        # Use LLM to generate the script
        llm_response = llm.get_llm_response([{"role": "user", "content": prompt}])

        if not llm_response:
            # Fallback script
            return generate_fallback_script(request)

        return llm_response

    except Exception as e:
        print(f"Error generating scenario-based script: {e}")
        return generate_fallback_script(request)


def generate_fallback_script(request: EnhancedPodcastRequest) -> str:
    """
    Generate a fallback script when LLM fails.
    """
    base_text = request.selected_text or "the selected content"

    return f"""Host: Welcome to our research insights podcast. Today we're discussing {base_text}. What are your thoughts on this?

Guest: This is really interesting. Looking at {base_text}, I can see several important implications that are worth discussing.

Host: Can you elaborate on what you find most significant here?

Guest: Absolutely. The key point is that {base_text} represents a fundamental shift in how we approach this topic. It's not just about the technical aspects, but also about the broader implications.

Host: That's a great point. How does this relate to the other research we've been looking at?

Guest: Well, when we consider the broader context, this connects to several other findings that suggest a pattern worth exploring further.

Host: Fascinating. What would you recommend for someone wanting to dive deeper into this area?

Guest: I'd suggest starting with the core concepts we've discussed, then branching out to explore the related research that builds on these foundations."""


def _sanitize_speaker_label(label: str) -> str:
    """Normalize speaker labels by removing markdown markers and trimming whitespace."""
    if not label:
        return "Speaker"
    # Remove markdown asterisks, backticks, and surrounding punctuation
    clean = re.sub(r"[\*`_]+", "", label)
    clean = clean.strip()
    # Normalize common variants
    return clean


def _safe_filename_component(text: str) -> str:
    """Return a filesystem-safe component (Windows-safe)."""
    if not text:
        return "segment"
    # Replace spaces with underscore first
    text = text.replace(" ", "_")
    # Remove any characters not alphanumeric, dash or underscore
    text = re.sub(r"[^A-Za-z0-9_-]", "", text)
    # Fallback if empty
    return text or "segment"


def generate_dual_voice_podcast_azure(script: str, output_file: str) -> Dict:
    """
    Generate a podcast with two different Azure voices for the conversation.
    Uses en-US-AriaNeural (female) and en-US-DavisNeural (male).
    """
    try:
        # Define the two voices
        voice1 = "en-US-AriaNeural"  # Female voice
        voice2 = "en-US-DavisNeural"  # Male voice

        print(f"Using Azure voices: {voice1} (Host) and {voice2} (Guest)")

        # Create temp directory structure
        import shutil
        import tempfile

        # Create a unique temp directory for this podcast
        podcast_id = os.path.basename(output_file).replace(".mp3", "")
        temp_dir = os.path.join("temp", podcast_id)
        os.makedirs(temp_dir, exist_ok=True)

        print(f"📁 Created temp directory: {temp_dir}")
        print(f"📁 Temp directory exists: {os.path.exists(temp_dir)}")
        print(f"📁 Temp directory absolute path: {os.path.abspath(temp_dir)}")

        # Split script into speaker segments
        speaker_segments = []
        current_speaker = None
        current_text = ""

        lines = script.split("\n")
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check if this is a speaker line
            if ":" in line and not line.startswith("["):
                # Save previous speaker's text
                if current_speaker and current_text:
                    clean_label = _sanitize_speaker_label(current_speaker)
                    print(
                        f"🔍 Processing speaker: '{current_speaker}' -> '{clean_label}'"
                    )

                    # Determine voice based on clean label
                    assigned_voice = voice1 if clean_label == "Host" else voice2
                    print(f"🎤 Voice assignment: '{clean_label}' -> {assigned_voice}")

                    speaker_segments.append(
                        {
                            "speaker": clean_label,
                            "text": current_text.strip(),
                            "voice": assigned_voice,
                        }
                    )

                # Start new speaker
                parts = line.split(":", 1)
                current_speaker = _sanitize_speaker_label(parts[0].strip())
                current_text = parts[1].strip() if len(parts) > 1 else ""
            else:
                # Continue current speaker's text
                if current_text:
                    current_text += " " + line
                else:
                    current_text = line

        # Add the last speaker
        if current_speaker and current_text:
            clean_label = _sanitize_speaker_label(current_speaker)
            print(f"🔍 Processing last speaker: '{current_speaker}' -> '{clean_label}'")

            # Determine voice based on clean label
            assigned_voice = voice1 if clean_label == "Host" else voice2
            print(f"🎤 Last voice assignment: '{clean_label}' -> {assigned_voice}")

            speaker_segments.append(
                {
                    "speaker": clean_label,
                    "text": current_text.strip(),
                    "voice": assigned_voice,
                }
            )

        if not speaker_segments:
            raise Exception("No speaker segments found in script")

        print(f"Generated {len(speaker_segments)} speaker segments")

        # Generate audio for each segment
        audio_segments = []
        total_duration = 0

        for i, segment in enumerate(speaker_segments):
            print(
                f"Generating audio for {segment['speaker']} using voice {segment['voice']}"
            )

            # Add delay between requests to avoid rate limiting
            if i > 0:
                import time

                time.sleep(0.5)  # 500ms delay between requests

            # Generate audio for this segment
            try:
                # Escape SSML characters to prevent Azure TTS errors
                safe_text = escape_ssml_text(segment["text"])

                # Create temp file in the temp directory
                temp_filename = (
                    f"segment_{i:02d}_{segment['speaker'].replace(' ', '_')}.mp3"
                )
                temp_file_path = os.path.join(temp_dir, temp_filename)

                print(f"📁 Creating temp file: {temp_file_path}")

                segment_audio = tts.generate_speech(
                    text=safe_text,
                    output_file=temp_file_path,
                    voice=segment["voice"],
                )

                if segment_audio and segment_audio.get("success"):
                    # Verify the file was actually created
                    if os.path.exists(temp_file_path):
                        file_size = os.path.getsize(temp_file_path)
                        print(
                            f"✅ Temp file created successfully: {temp_filename} ({file_size} bytes)"
                        )
                    else:
                        print(f"⚠️ Temp file not found after creation: {temp_file_path}")

                    # Store the file path and metadata
                    audio_segments.append(
                        {
                            "file_path": temp_file_path,  # Full path to temp file
                            "filename": temp_filename,  # Just filename for cleanup
                            "duration": segment_audio.get("duration", 0),
                            "speaker": segment["speaker"],
                            "voice": segment["voice"],
                            "metadata": segment_audio,
                        }
                    )
                    total_duration += segment_audio.get("duration", 0)
                    print(
                        f"✅ Generated audio for {segment['speaker']}: {segment_audio.get('duration', 0):.1f}s"
                    )
                else:
                    print(
                        f"❌ Failed to generate audio for segment {i}: {segment_audio.get('error', 'Unknown error') if segment_audio else 'No response'}"
                    )

            except Exception as e:
                print(f"❌ Error generating audio for segment {i}: {e}")
                # Continue with other segments instead of failing completely
                continue

        if not audio_segments:
            raise Exception("No audio segments generated")

        # Combine audio segments using proper audio mixing
        combined_audio = combine_audio_segments_properly(audio_segments, output_file)

        # NO CLEANUP - Keep temp files forever as requested
        if combined_audio:
            print(f"🎵 Temp files preserved in: {temp_dir}")
            print(f"📁 You can find all audio segments in: {os.path.abspath(temp_dir)}")

            return {
                "url": f"/static/{os.path.basename(output_file)}",
                "duration": total_duration,
                "voices_used": [voice1, voice2],
                "segments": len(speaker_segments),
            }
        else:
            raise Exception("Failed to combine audio segments")

    except Exception as e:
        print(f"Error in dual voice podcast generation: {e}")
        return None


def combine_audio_segments(segment_files: List[Dict], output_file: str) -> str:
    """
    Combine multiple audio segments into a single file.
    This is a simplified implementation - in production, you'd use pydub or similar to mix audio.
    """
    try:
        # For now, just copy the first segment as the output
        # In a real implementation, you'd use pydub or similar to mix audio
        if segment_files and len(segment_files) > 0:
            first_segment = segment_files[0]
            file_path = first_segment.get("file_path", "")

            if file_path and os.path.exists(file_path):
                import shutil

                shutil.copy2(file_path, output_file)
                print(
                    f"✅ Combined audio segments: copied {file_path} to {output_file}"
                )
                return output_file
            else:
                raise Exception(f"First audio segment file not found: {file_path}")
        else:
            raise Exception("No valid audio segments to combine")
    except Exception as e:
        print(f"Error combining audio segments: {e}")
        return None


def escape_ssml_text(text: str) -> str:
    """
    Escape special characters for SSML compatibility with Azure TTS.
    """
    if not text:
        return text

    # Replace problematic characters with SSML-safe alternatives
    escaped = text.replace("&", "&amp;")
    escaped = escaped.replace("<", "&lt;")
    escaped = escaped.replace(">", "&gt;")
    escaped = escaped.replace('"', "&quot;")
    escaped = escaped.replace("'", "&apos;")

    # Remove or replace other problematic characters
    escaped = escaped.replace("**", "")  # Remove markdown bold markers
    escaped = escaped.replace("*", "")  # Remove markdown italic markers

    return escaped


def combine_audio_segments_properly(segment_files: List[Dict], output_file: str) -> str:
    """
    Combine multiple audio segments into a single file using pure Python.
    No external dependencies required - works in Docker containers.
    """
    try:
        print("🎵 Using pure Python audio concatenation (no external dependencies)...")
        print(f"📁 Output file: {output_file}")
        print(f"📁 Number of segments to combine: {len(segment_files)}")

        # Use simple file concatenation for MP3 files
        # This is a basic approach that works without external tools
        with open(output_file, "wb") as outfile:
            for i, segment in enumerate(segment_files):
                file_path = segment.get("file_path")
                absolute_path = os.path.abspath(file_path)
                print(
                    f"🔍 Concatenating segment {i+1}: {os.path.basename(absolute_path)}"
                )
                print(f"   File exists: {os.path.exists(absolute_path)}")
                print(
                    f"   File size: {os.path.getsize(absolute_path) if os.path.exists(absolute_path) else 'N/A'} bytes"
                )

                if file_path and os.path.exists(absolute_path):
                    try:
                        # Read the MP3 file and append to output
                        with open(absolute_path, "rb") as infile:
                            audio_data = infile.read()
                            outfile.write(audio_data)
                            print(
                                f"✅ Concatenated segment {i+1}: {segment['speaker']} ({len(audio_data)} bytes)"
                            )
                    except Exception as e:
                        print(
                            f"❌ Failed to concatenate segment {i+1} ({segment['speaker']}): {e}"
                        )
                        continue
                else:
                    print(f"⚠️ Audio file not found: {absolute_path}")

        # Verify the output file was created
        if os.path.exists(output_file):
            output_size = os.path.getsize(output_file)
            print(f"✅ Successfully created combined audio file: {output_file}")
            print(f"📊 Final file size: {output_size} bytes")
            return output_file
        else:
            raise Exception("Failed to create output audio file")

    except Exception as e:
        print(f"❌ Error combining audio segments: {e}")
        raise Exception(f"Failed to combine audio segments: {str(e)}")
