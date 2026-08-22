package com.fellowgrad.voiceservice.provider;

import com.google.cloud.speech.v1.*;
import com.google.protobuf.ByteString;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

@Component
@Slf4j
public class GoogleSpeechToTextProvider implements SpeechToTextProvider {

    @Override
    public String convert(byte[] audioData) {
        if (audioData == null || audioData.length == 0) {
            log.warn("Empty audio data received for STT");
            return "";
        }

        try (SpeechClient speechClient = SpeechClient.create()) {
            ByteString audioBytes = ByteString.copyFrom(audioData);

            RecognitionConfig config = RecognitionConfig.newBuilder()
                    .setEncoding(RecognitionConfig.AudioEncoding.LINEAR16)
                    .setSampleRateHertz(16000)
                    .setLanguageCode("en-US")
                    .build();

            RecognitionAudio recognitionAudio = RecognitionAudio.newBuilder()
                    .setContent(audioBytes)
                    .build();

            RecognizeResponse response = speechClient.recognize(config, recognitionAudio);
            List<SpeechRecognitionResult> results = response.getResultsList();

            StringBuilder transcript = new StringBuilder();
            for (SpeechRecognitionResult result : results) {
                if (result.getAlternativesCount() > 0) {
                    SpeechRecognitionAlternative alternative = result.getAlternativesList().get(0);
                    transcript.append(alternative.getTranscript());
                }
            }

            String result = transcript.toString();
            log.info("Transcribed text: {}", result);
            return result;
        } catch (IOException e) {
            log.error("Error during Google Speech-to-Text conversion", e);
            throw new RuntimeException("Failed to convert speech to text using Google Cloud", e);
        }
    }
}
