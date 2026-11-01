class VoiceService:
    def __init__(self, stt_key="", stt_provider="", tts_key="", tts_provider=""):
        self.stt_key = stt_key
        self.stt_provider = stt_provider
        self.tts_key = tts_key
        self.tts_provider = tts_provider

    async def transcribe(self, audio_bytes: bytes, language: str):
        if not self.stt_key:
            return {
                "available": False,
                "demo_mode": True,
                "message": "Speech-to-text provider is not configured."
            }
        raise NotImplementedError("Connect the selected STT provider.")

    async def synthesize(self, text: str, language: str):
        if not self.tts_key:
            return {
                "available": False,
                "demo_mode": True,
                "message": "Text-to-speech provider is not configured."
            }
        raise NotImplementedError("Connect the selected TTS provider.")
