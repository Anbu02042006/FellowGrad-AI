package com.fellowgrad.voiceservice.provider;

public interface TextToSpeechProvider {
    byte[] convert(String text);
}
