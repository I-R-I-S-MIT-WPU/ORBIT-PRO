import os
import requests
from pathlib import Path

# Optional: Google Cloud TTS
try:
    from google.cloud import texttospeech  # type: ignore
    _HAS_GCP = True
except Exception:
    _HAS_GCP = False


def _ensure_parent(path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)


def _azure_speech_tts(text: str, output_file: str, voice: str | None = None) -> str:
    """Azure Cognitive Services Speech TTS (Free tier available).

    Env vars:
      - AZURE_SPEECH_KEY
      - AZURE_SPEECH_REGION (e.g., eastus, centralindia)
      - AZURE_SPEECH_VOICE (e.g., en-US-AriaNeural)
      - AZURE_SPEECH_FORMAT (optional, default: audio-24khz-48kbitrate-mono-mp3)
    """
    key = os.getenv("AZURE_SPEECH_KEY")
    # Accept either region or endpoint override (supports common aliases + typo)
    region = os.getenv("AZURE_SPEECH_REGION")
    endpoint_override = (
        os.getenv("AZURE_SPEECH_ENDPOINT")
        or os.getenv("AZURE_ENDPOINT")
        or os.getenv("AZURE_ENPOINT")  # tolerate common typo
    )
    voice = voice or os.getenv("AZURE_SPEECH_VOICE", "en-US-AriaNeural")
    audio_format = os.getenv("AZURE_SPEECH_FORMAT", "audio-24khz-48kbitrate-mono-mp3")

    if not key:
        raise ValueError("AZURE_SPEECH_KEY must be set for Azure Speech TTS")

    # If endpoint override is provided, try derive region from host like 'centralindia.api.cognitive.microsoft.com'
    if not region and endpoint_override:
        try:
            from urllib.parse import urlparse
            host = urlparse(endpoint_override).netloc
            # Expect '<region>.api.cognitive.microsoft.com'
            region = host.split(".")[0] if host else None
        except Exception:
            region = None

    if not region:
        raise ValueError(
            "Provide AZURE_SPEECH_REGION (e.g., 'centralindia') or set AZURE_SPEECH_ENDPOINT/AZURE_ENDPOINT"
        )

    # 1) Get OAuth token
    token_url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    token_headers = {"Ocp-Apim-Subscription-Key": key}
    token_resp = requests.post(token_url, headers=token_headers, timeout=30)
    token_resp.raise_for_status()
    token = token_resp.text

    # 2) Synthesize via SSML
    tts_url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    ssml = f"""
    <speak version='1.0' xml:lang='en-US'>
      <voice xml:lang='en-US' name='{voice}'>
        {text}
      </voice>
    </speak>
    """.strip()
    tts_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": audio_format,
        "User-Agent": "AdobeHackathonFinale/1.0",
    }

    _ensure_parent(output_file)
    resp = requests.post(tts_url, headers=tts_headers, data=ssml.encode("utf-8"), timeout=60)
    resp.raise_for_status()
    with open(output_file, "wb") as f:
        f.write(resp.content)
    return output_file


def _gcp_tts(text: str, output_file: str, voice: str | None = None) -> str:
    if not _HAS_GCP:
        raise RuntimeError("google-cloud-texttospeech not installed in this image")
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_path:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
    client = texttospeech.TextToSpeechClient()
    input_text = texttospeech.SynthesisInput(text=text)
    language = os.getenv("GCP_TTS_LANGUAGE", "en-US")
    gcp_voice = voice or os.getenv("GCP_TTS_VOICE", "en-US-Neural2-F")
    voice_params = texttospeech.VoiceSelectionParams(language_code=language, name=gcp_voice)
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    _ensure_parent(output_file)
    response = client.synthesize_speech(input=input_text, voice=voice_params, audio_config=audio_config)
    with open(output_file, "wb") as out:
        out.write(response.audio_content)
    return output_file


def _local_tts(text: str, output_file: str) -> str:
    # Minimal local fallback: write a placeholder mp3 if no TTS provider is configured
    # This keeps endpoint functional for demo; real audio requires Azure/GCP/local TTS setup.
    _ensure_parent(output_file)
    with open(output_file, "wb") as f:
        f.write(b"\x00")  # placeholder; front-end player will likely refuse, but file exists
    return output_file


def generate_audio_to_file(text: str, output_file: str) -> str:
    provider = os.getenv("TTS_PROVIDER", "azure_speech").lower()
    # Backward compat: treat 'azure' as azure_speech
    if provider == "azure":
        provider = "azure_speech"
    voice = os.getenv("AZURE_SPEECH_VOICE")
    if provider == "azure_speech":
        return _azure_speech_tts(text, output_file, voice)
    elif provider == "gcp":
        return _gcp_tts(text, output_file, voice)
    elif provider == "local":
        return _local_tts(text, output_file)
    else:
        raise ValueError(f"Unsupported TTS_PROVIDER: {provider}")
