package com.fellowgrad.voiceservice.provider;

import com.google.cloud.texttospeech.v1.*;
import com.google.protobuf.ByteString;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Slf4j
public class GoogleTextToSpeechProvider implements TextToSpeechProvider {

    @Override
    public byte[] convert(String text) {
        if (text == null || text.trim().isEmpty()) {
            log.warn("Empty text received for TTS");
            return new byte[0];
        }

        try (TextToSpeechClient textToSpeechClient = TextToSpeechClient.create()) {
            SynthesisInput input = SynthesisInput.newBuilder().setText(text).build();

            // Using a natural Wavenet voice
            VoiceSelectionParams voice = VoiceSelectionParams.newBuilder()
                    .setLanguageCode("en-US")
                    .setName("en-US-Wavenet-D")
                    .setSsmlGender(SsmlVoiceGender.MALE)
                    .build();

            AudioConfig audioConfig = AudioConfig.newBuilder()
                    .setAudioEncoding(AudioEncoding.MP3)
                    .build();

            SynthesizeSpeechResponse response = textToSpeechClient.synthesizeSpeech(input, voice, audioConfig);
            ByteString audioContents = response.getAudioContent();

            log.info("Successfully converted text to speech: {} bytes", audioContents.size());
            return audioContents.toByteArray();
        } catch (IOException e) {
            log.error("Error during Google Text-to-Speech conversion", e);
            throw new RuntimeException("Failed to convert text to speech using Google Cloud", e);
        }
    }
}
