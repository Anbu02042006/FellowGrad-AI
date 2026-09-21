package com.fellowgrad

import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

import java.util.concurrent.atomic.AtomicBoolean

class AudioStreamModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    // =========================================================================
    // RECORDING STATE
    // =========================================================================

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val isRecording = AtomicBoolean(false)

    // Debug counter for PCM diagnostics
    private var debugChunkCounter = 0

    // =========================================================================
    // PLAYBACK STATE
    // =========================================================================

    private var audioTrack: AudioTrack? = null
    private val isPlayerInitialized = AtomicBoolean(false)
    private val isFirstChunkInTurn = AtomicBoolean(true)

    override fun getName(): String {
        return "AudioStream"
    }

    private fun sendEvent(
        eventName: String,
        params: com.facebook.react.bridge.WritableMap
    ) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(
                    DeviceEventManagerModule.RCTDeviceEventEmitter::class.java
                )
                .emit(eventName, params)
        }
    }

    // =========================================================================
    // MICROPHONE CAPTURE
    // 16kHz / 16-bit / MONO / RAW PCM
    // =========================================================================

    @ReactMethod
    fun startRecording(
        sampleRate: Int,
        chunkSizeMs: Int,
        promise: Promise
    ) {
        try {

            if (isRecording.get()) {
                promise.resolve(true)
                return
            }

            // -------------------------------------------------------------
            // Check microphone permission
            // -------------------------------------------------------------

            val permission = ContextCompat.checkSelfPermission(
                reactContext,
                android.Manifest.permission.RECORD_AUDIO
            )

            if (permission != PackageManager.PERMISSION_GRANTED) {
                promise.reject(
                    "PERMISSION_DENIED",
                    "Microphone permission is not granted."
                )
                return
            }

            // -------------------------------------------------------------
            // Validate configuration
            // -------------------------------------------------------------

            val validSampleRate =
                if (sampleRate > 0) sampleRate else 16000

            val validChunkMs =
                if (chunkSizeMs > 0) chunkSizeMs else 100

            val channelConfig =
                AudioFormat.CHANNEL_IN_MONO

            val audioFormat =
                AudioFormat.ENCODING_PCM_16BIT

            val minBufferSize =
                AudioRecord.getMinBufferSize(
                    validSampleRate,
                    channelConfig,
                    audioFormat
                )

            if (
                minBufferSize == AudioRecord.ERROR ||
                minBufferSize == AudioRecord.ERROR_BAD_VALUE
            ) {
                promise.reject(
                    "INIT_FAILED",
                    "Invalid AudioRecord parameters."
                )
                return
            }

            // -------------------------------------------------------------
            // Calculate exact PCM chunk size
            //
            // 16,000 samples/sec
            // × 100 ms
            // × 2 bytes/sample
            // = 3,200 bytes
            // -------------------------------------------------------------

            val chunkSizeInBytes =
                (validSampleRate * validChunkMs / 1000) * 2

            val bufferSize =
                Math.max(
                    minBufferSize * 2,
                    chunkSizeInBytes * 4
                )

            Log.d(
                "AudioStream",
                "Audio config -> sampleRate=$validSampleRate, " +
                    "chunkMs=$validChunkMs, " +
                    "chunkBytes=$chunkSizeInBytes, " +
                    "bufferSize=$bufferSize"
            )

            // -------------------------------------------------------------
            // Create AudioRecord
            //
            // VOICE_COMMUNICATION gives Android's communication
            // audio processing such as AEC / noise suppression
            // -------------------------------------------------------------

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                validSampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (
                audioRecord?.state !=
                AudioRecord.STATE_INITIALIZED
            ) {
                promise.reject(
                    "INIT_FAILED",
                    "AudioRecord failed to initialize."
                )
                return
            }

            // -------------------------------------------------------------
            // Start recording
            // -------------------------------------------------------------

            debugChunkCounter = 0

            audioRecord?.startRecording()

            isRecording.set(true)

            Log.d(
                "AudioStream",
                "Recording started -> " +
                    "${validSampleRate}Hz / " +
                    "16-bit / mono / " +
                    "${validChunkMs}ms"
            )

            // -------------------------------------------------------------
            // Recording thread
            // -------------------------------------------------------------

            recordingThread = Thread({

                val buffer =
                    ByteArray(chunkSizeInBytes)

                while (isRecording.get()) {

                    val bytesRead =
                        audioRecord?.read(
                            buffer,
                            0,
                            chunkSizeInBytes
                        ) ?: -1

                    if (
                        bytesRead > 0 &&
                        isRecording.get()
                    ) {

                        // =================================================
                        // PCM DIAGNOSTICS
                        // =================================================

                        var sumSquares = 0.0
                        var nonZeroSamples = 0

                        var i = 0

                        while (i + 1 < bytesRead) {

                            // PCM is little-endian:
                            // low byte first
                            // high byte second

                            val low =
                                buffer[i].toInt() and 0xFF

                            val high =
                                buffer[i + 1].toInt()

                            val sample =
                                (high shl 8) or low

                            if (sample != 0) {
                                nonZeroSamples++
                            }

                            sumSquares +=
                                sample.toDouble() *
                                sample.toDouble()

                            i += 2
                        }

                        val sampleCount =
                            bytesRead / 2

                        val rms =
                            if (sampleCount > 0) {
                                Math.sqrt(
                                    sumSquares /
                                        sampleCount
                                )
                            } else {
                                0.0
                            }

                        debugChunkCounter++

                        // Log every 20 chunks
                        if (
                            debugChunkCounter == 1 ||
                            debugChunkCounter % 20 == 0
                        ) {

                            Log.d(
                                "AudioStream",
                                "PCM DEBUG -> " +
                                    "chunk=$debugChunkCounter, " +
                                    "bytes=$bytesRead, " +
                                    "samples=$sampleCount, " +
                                    "rms=$rms, " +
                                    "nonZero=$nonZeroSamples"
                            )
                        }

                        // =================================================
                        // Convert RAW PCM -> Base64
                        // =================================================

                        val base64Chunk =
                            Base64.encodeToString(
                                buffer,
                                0,
                                bytesRead,
                                Base64.NO_WRAP
                            )

                        val eventParams =
                            Arguments.createMap()

                        eventParams.putString(
                            "data",
                            base64Chunk
                        )

                        // =================================================
                        // Send PCM chunk to React Native
                        // =================================================

                        sendEvent(
                            "onAudioChunk",
                            eventParams
                        )
                    }
                }

            }, "AudioStreamRecordingThread")

            recordingThread?.priority =
                Thread.MAX_PRIORITY

            recordingThread?.start()

            promise.resolve(true)

        } catch (e: Exception) {

            isRecording.set(false)

            Log.e(
                "AudioStream",
                "START_RECORDING_ERROR",
                e
            )

            promise.reject(
                "START_RECORDING_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================================
    // STOP MICROPHONE
    // =========================================================================

    @ReactMethod
    fun stopRecording(
        promise: Promise
    ) {

        try {

            isRecording.set(false)

            recordingThread?.interrupt()
            recordingThread = null

            audioRecord?.let {

                try {

                    if (
                        it.state ==
                        AudioRecord.STATE_INITIALIZED
                    ) {
                        it.stop()
                    }

                } catch (_: Exception) {
                }

                try {
                    it.release()
                } catch (_: Exception) {
                }
            }

            audioRecord = null

            debugChunkCounter = 0

            Log.d(
                "AudioStream",
                "Recording stopped"
            )

            promise.resolve(true)

        } catch (e: Exception) {

            promise.reject(
                "STOP_RECORDING_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================================
    // STREAMING AUDIO PLAYBACK
    // 24kHz / 16-bit / MONO PCM
    // =========================================================================

    @ReactMethod
    fun initPlayer(
        sampleRate: Int,
        promise: Promise
    ) {

        try {

            val validSampleRate =
                if (sampleRate > 0)
                    sampleRate
                else
                    24000

            val channelConfig =
                AudioFormat.CHANNEL_OUT_MONO

            val audioEncoding =
                AudioFormat.ENCODING_PCM_16BIT

            val minBufferSize =
                AudioTrack.getMinBufferSize(
                    validSampleRate,
                    channelConfig,
                    audioEncoding
                )

            val bufferSize =
                Math.max(
                    minBufferSize * 4,
                    32768
                )

            // Release previous player
            stopPlayerInternal()

            val attributes =
                AudioAttributes.Builder()
                    .setUsage(
                        AudioAttributes.USAGE_MEDIA
                    )
                    .setContentType(
                        AudioAttributes.CONTENT_TYPE_SPEECH
                    )
                    .build()

            val format =
                AudioFormat.Builder()
                    .setEncoding(audioEncoding)
                    .setSampleRate(validSampleRate)
                    .setChannelMask(channelConfig)
                    .build()

            audioTrack =
                AudioTrack(
                    attributes,
                    format,
                    bufferSize,
                    AudioTrack.MODE_STREAM,
                    AudioManager.AUDIO_SESSION_ID_GENERATE
                )

            if (
                audioTrack?.state !=
                AudioTrack.STATE_INITIALIZED
            ) {
                Log.e(
                    "AudioStream",
                    "[AudioStream] AudioTrack failed to initialize! state=${audioTrack?.state}"
                )
                promise.reject(
                    "INIT_PLAYER_FAILED",
                    "AudioTrack failed to initialize."
                )
                return
            }

            audioTrack?.setVolume(AudioTrack.getMaxVolume())
            audioTrack?.play()

            // Ensure loudspeaker routing
            try {
                val audioManager =
                    reactContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                audioManager?.isSpeakerphoneOn = true
            } catch (routeErr: Exception) {
                Log.w("AudioStream", "[AudioStream] Speakerphone routing warning: ${routeErr.message}")
            }

            isPlayerInitialized.set(true)
            isFirstChunkInTurn.set(true)

            Log.d(
                "AudioStream",
                "[AudioStream] AudioTrack initialized -> " +
                    "state=${audioTrack?.state}, " +
                    "playState=${audioTrack?.playState}, " +
                    "sampleRate=${audioTrack?.sampleRate}, " +
                    "channelCount=${audioTrack?.channelCount}, " +
                    "audioSessionId=${audioTrack?.audioSessionId}"
            )

            promise.resolve(true)

        } catch (e: Exception) {

            Log.e(
                "AudioStream",
                "INIT_PLAYER_ERROR",
                e
            )

            promise.reject(
                "INIT_PLAYER_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================================
    // PLAY GEMINI PCM CHUNK
    // =========================================================================

    @ReactMethod
    fun playChunk(
        base64Pcm: String,
        promise: Promise
    ) {

        try {

            if (
                !isPlayerInitialized.get() ||
                audioTrack == null
            ) {
                Log.w("AudioStream", "[AudioStream] playChunk called but player not initialized")
                promise.resolve(false)
                return
            }

            val data =
                Base64.decode(
                    base64Pcm,
                    Base64.DEFAULT
                )

            if (data.isNotEmpty()) {
                val track = audioTrack
                if (track != null) {
                    if (isFirstChunkInTurn.compareAndSet(true, false)) {
                        Log.d(
                            "AudioStream",
                            "[Latency] FIRST_AUDIO_WRITE -> bytes=${data.size} written to AudioTrack at ${System.currentTimeMillis()}"
                        )
                    }

                    Log.d(
                        "AudioStream",
                        "[AudioStream] TRACK STATE -> state=${track.state}, " +
                            "playState=${track.playState}, " +
                            "sampleRate=${track.sampleRate}, " +
                            "channelCount=${track.channelCount}, " +
                            "audioSessionId=${track.audioSessionId}"
                    )

                    var totalWritten = 0
                    while (totalWritten < data.size && track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                        val written = track.write(
                            data,
                            totalWritten,
                            data.size - totalWritten,
                            AudioTrack.WRITE_BLOCKING
                        )

                        if (written < 0) {
                            Log.e(
                                "AudioStream",
                                "[AudioStream] AUDIO WRITE ERROR -> bytes=${data.size}, error=$written"
                            )
                            break
                        }

                        totalWritten += written
                    }

                    Log.d(
                        "AudioStream",
                        "[AudioStream] AUDIO WRITE -> bytes=${data.size}, result=$totalWritten"
                    )
                }
            }

            promise.resolve(true)

        } catch (e: Exception) {

            Log.e(
                "AudioStream",
                "PLAY_CHUNK_ERROR",
                e
            )

            promise.reject(
                "PLAY_CHUNK_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================================
    // FLUSH PLAYER
    // Used for Gemini Live barge-in
    // =========================================================================

    @ReactMethod
    fun flushPlayer(
        promise: Promise
    ) {

        try {
            isFirstChunkInTurn.set(true)
            Log.d("AudioStream", "[AudioStream] FLUSH PLAYER CALLED")

            audioTrack?.let { track ->

                if (
                    track.state ==
                    AudioTrack.STATE_INITIALIZED
                ) {

                    track.pause()
                    track.flush()
                    track.play()
                }
            }

            promise.resolve(true)

        } catch (e: Exception) {

            promise.reject(
                "FLUSH_PLAYER_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================================
    // STOP PLAYER
    // =========================================================================

    @ReactMethod
    fun stopPlayer(
        promise: Promise
    ) {

        try {

            stopPlayerInternal()

            promise.resolve(true)

        } catch (e: Exception) {

            promise.reject(
                "STOP_PLAYER_ERROR",
                e.message,
                e
            )
        }
    }

    // =========================================================================
    // INTERNAL PLAYER CLEANUP
    // =========================================================================

    private fun stopPlayerInternal() {

        isPlayerInitialized.set(false)
        isFirstChunkInTurn.set(true)

        audioTrack?.let { track ->

            try {

                if (
                    track.state ==
                    AudioTrack.STATE_INITIALIZED
                ) {

                    track.pause()
                    track.flush()
                    track.stop()
                }

            } catch (_: Exception) {
            }

            try {
                track.release()
            } catch (_: Exception) {
            }
        }

        audioTrack = null
    }

    // =========================================================================
    // RN INSTANCE DESTROY
    // =========================================================================

    override fun onCatalystInstanceDestroy() {

        super.onCatalystInstanceDestroy()

        isRecording.set(false)

        try {
            audioRecord?.release()
        } catch (_: Exception) {
        }

        audioRecord = null

        stopPlayerInternal()
    }
}