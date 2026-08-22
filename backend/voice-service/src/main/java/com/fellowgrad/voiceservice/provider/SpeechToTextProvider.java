package com.fellowgrad.voiceservice.provider;

public interface SpeechToTextProvider {
    String convert(byte[] audioData);
}
