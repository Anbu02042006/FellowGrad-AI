package com.fellowgrad

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

import java.util.Locale

class SpeechRecognizerModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName(): String {
        return "SpeechRecognizer"
    }

    private fun sendEvent(
        eventName: String,
        params: WritableMap
    ) {
        reactContext
            .getJSModule(
                DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
            )
            .emit(eventName, params)
    }

    @ReactMethod
    fun startListening(promise: Promise) {

        mainHandler.post {

            try {

                if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {

                    promise.reject(
                        "SPEECH_NOT_AVAILABLE",
                        "Speech recognition is not available on this device."
                    )

                    return@post
                }

                // Destroy previous recognizer if one exists
                speechRecognizer?.destroy()
                speechRecognizer = null

                // Create recognizer on MAIN THREAD
                speechRecognizer =
                    SpeechRecognizer.createSpeechRecognizer(
                        reactContext
                    )

                speechRecognizer?.setRecognitionListener(
                    object : RecognitionListener {

                        override fun onReadyForSpeech(
                            params: Bundle?
                        ) {

                            sendEvent(
                                "SpeechRecognizerReady",
                                Arguments.createMap()
                            )
                        }

                        override fun onBeginningOfSpeech() {

                            sendEvent(
                                "SpeechRecognizerBeginning",
                                Arguments.createMap()
                            )
                        }

                        override fun onRmsChanged(
                            rmsdB: Float
                        ) {
                        }

                        override fun onBufferReceived(
                            buffer: ByteArray?
                        ) {
                        }

                        override fun onEndOfSpeech() {

                            sendEvent(
                                "SpeechRecognizerEnd",
                                Arguments.createMap()
                            )
                        }

                        override fun onError(
                            error: Int
                        ) {

                            val params =
                                Arguments.createMap()

                            params.putInt(
                                "error",
                                error
                            )

                            sendEvent(
                                "SpeechRecognizerError",
                                params
                            )
                        }

                        override fun onResults(
                            results: Bundle?
                        ) {

                            val matches =
                                results?.getStringArrayList(
                                    SpeechRecognizer.RESULTS_RECOGNITION
                                )

                            val text =
                                matches?.firstOrNull() ?: ""

                            val params =
                                Arguments.createMap()

                            params.putString(
                                "text",
                                text
                            )

                            sendEvent(
                                "SpeechRecognizerResult",
                                params
                            )
                        }

                        override fun onPartialResults(
                            partialResults: Bundle?
                        ) {

                            val matches =
                                partialResults?.getStringArrayList(
                                    SpeechRecognizer.RESULTS_RECOGNITION
                                )

                            val text =
                                matches?.firstOrNull() ?: ""

                            if (text.isNotEmpty()) {

                                val params =
                                    Arguments.createMap()

                                params.putString(
                                    "text",
                                    text
                                )

                                sendEvent(
                                    "SpeechRecognizerPartialResult",
                                    params
                                )
                            }
                        }

                        override fun onEvent(
                            eventType: Int,
                            params: Bundle?
                        ) {
                        }
                    }
                )

                val intent =
                    Intent(
                        RecognizerIntent.ACTION_RECOGNIZE_SPEECH
                    ).apply {

                        putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                        )

                        putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE,
                            Locale.US.toLanguageTag()
                        )

                        putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,
                            Locale.US.toLanguageTag()
                        )

                        putExtra(
                            RecognizerIntent.EXTRA_PARTIAL_RESULTS,
                            true
                        )

                        putExtra(
                            RecognizerIntent.EXTRA_MAX_RESULTS,
                            3
                        )
                    }

                // Start recognizer on MAIN THREAD
                speechRecognizer?.startListening(intent)

                promise.resolve(true)

            } catch (e: Exception) {

                promise.reject(
                    "SPEECH_START_ERROR",
                    e.message,
                    e
                )
            }
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {

        mainHandler.post {

            try {

                speechRecognizer?.stopListening()

                promise.resolve(true)

            } catch (e: Exception) {

                promise.reject(
                    "SPEECH_STOP_ERROR",
                    e.message,
                    e
                )
            }
        }
    }

    @ReactMethod
    fun cancelListening(promise: Promise) {

        mainHandler.post {

            try {

                speechRecognizer?.cancel()

                promise.resolve(true)

            } catch (e: Exception) {

                promise.reject(
                    "SPEECH_CANCEL_ERROR",
                    e.message,
                    e
                )
            }
        }
    }

    override fun invalidate() {

        mainHandler.post {

            try {
                speechRecognizer?.destroy()
                speechRecognizer = null
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        super.invalidate()
    }
}