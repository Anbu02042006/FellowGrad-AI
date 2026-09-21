package com.fellowgrad

import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
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

    // Recording state
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val isRecording = AtomicBoolean(false)

    // Playback state
    private var audioTrack: AudioTrack? = null
    private val isPlayerInitialized = AtomicBoolean(false)

    override fun getName(): String {
        return "AudioStream"
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    // =========================================================================
    // MICROPHONE CAPTURE (16kHz 16-bit Mono PCM)
    // =========================================================================

    @ReactMethod
    fun startRecording(sampleRate: Int, chunkSizeMs: Int, promise: Promise) {
        try {
            if (isRecording.get()) {
                promise.resolve(true)
                return
            }

            // Check RECORD_AUDIO permission
            val permission = ContextCompat.checkSelfPermission(
                reactContext,
                android.Manifest.permission.RECORD_AUDIO
            )
            if (permission != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Microphone permission is not granted.")
                return
            }

            val validSampleRate = if (sampleRate > 0) sampleRate else 16000
            val validChunkMs = if (chunkSizeMs > 0) chunkSizeMs else 100

            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufferSize = AudioRecord.getMinBufferSize(validSampleRate, channelConfig, audioFormat)

            if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                promise.reject("INIT_FAILED", "Invalid AudioRecord parameters.")
                return
            }

            // Chunk size in bytes: (sampleRate * validChunkMs / 1000) * 2 bytes per sample
            val chunkSizeInBytes = (validSampleRate * validChunkMs / 1000) * 2
            val bufferSize = Math.max(minBufferSize * 2, chunkSizeInBytes * 4)

            // VOICE_COMMUNICATION provides hardware Acoustic Echo Cancellation (AEC) and Noise Suppression
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                validSampleRate,
                channelConfig,
                audioFormat,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("INIT_FAILED", "AudioRecord failed to initialize.")
                return
            }

            audioRecord?.startRecording()
            isRecording.set(true)

            recordingThread = Thread({
                val buffer = ByteArray(chunkSizeInBytes)

                while (isRecording.get()) {
                    val bytesRead = audioRecord?.read(buffer, 0, chunkSizeInBytes) ?: -1

                    if (bytesRead > 0 && isRecording.get()) {
                        val base64Chunk = Base64.encodeToString(buffer, 0, bytesRead, Base64.NO_WRAP)
                        val eventParams = Arguments.createMap()
                        eventParams.putString("data", base64Chunk)
                        sendEvent("onAudioChunk", eventParams)
                    }
                }
            }, "AudioStreamRecordingThread")

            recordingThread?.priority = Thread.MAX_PRIORITY
            recordingThread?.start()

            promise.resolve(true)
        } catch (e: Exception) {
            isRecording.set(false)
            promise.reject("START_RECORDING_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            isRecording.set(false)

            recordingThread?.interrupt()
            recordingThread = null

            audioRecord?.let {
                try {
                    if (it.state == AudioRecord.STATE_INITIALIZED) {
                        it.stop()
                    }
                } catch (_: Exception) {}
                it.release()
            }
            audioRecord = null

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_RECORDING_ERROR", e.message, e)
        }
    }

    // =========================================================================
    // STREAMING AUDIO PLAYBACK (24kHz 16-bit Mono PCM)
    // =========================================================================

    @ReactMethod
    fun initPlayer(sampleRate: Int, promise: Promise) {
        try {
            val validSampleRate = if (sampleRate > 0) sampleRate else 24000
            val channelConfig = AudioFormat.CHANNEL_OUT_MONO
            val audioEncoding = AudioFormat.ENCODING_PCM_16BIT

            val minBufferSize = AudioTrack.getMinBufferSize(validSampleRate, channelConfig, audioEncoding)
            val bufferSize = Math.max(minBufferSize * 4, 32768)

            // Release previous player if active
            stopPlayerInternal()

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()

            val format = AudioFormat.Builder()
                .setEncoding(audioEncoding)
                .setSampleRate(validSampleRate)
                .setChannelMask(channelConfig)
                .build()

            audioTrack = AudioTrack(
                attributes,
                format,
                bufferSize,
                AudioTrack.MODE_STREAM,
                android.media.AudioManager.AUDIO_SESSION_ID_GENERATE
            )

            if (audioTrack?.state != AudioTrack.STATE_INITIALIZED) {
                promise.reject("INIT_PLAYER_FAILED", "AudioTrack failed to initialize.")
                return
            }

            audioTrack?.play()
            isPlayerInitialized.set(true)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INIT_PLAYER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun playChunk(base64Pcm: String, promise: Promise) {
        try {
            if (!isPlayerInitialized.get() || audioTrack == null) {
                promise.resolve(false)
                return
            }

            val data = Base64.decode(base64Pcm, Base64.NO_WRAP)
            if (data.isNotEmpty()) {
                audioTrack?.write(data, 0, data.size, AudioTrack.WRITE_NON_BLOCKING)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PLAY_CHUNK_ERROR", e.message, e)
        }
    }

    /**
     * Instantly flushes AudioTrack buffer when user interrupts (barge-in)
     */
    @ReactMethod
    fun flushPlayer(promise: Promise) {
        try {
            audioTrack?.let { track ->
                if (track.state == AudioTrack.STATE_INITIALIZED) {
                    track.pause()
                    track.flush()
                    track.play()
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FLUSH_PLAYER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopPlayer(promise: Promise) {
        try {
            stopPlayerInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_PLAYER_ERROR", e.message, e)
        }
    }

    private fun stopPlayerInternal() {
        isPlayerInitialized.set(false)
        audioTrack?.let { track ->
            try {
                if (track.state == AudioTrack.STATE_INITIALIZED) {
                    track.pause()
                    track.flush()
                    track.stop()
                }
            } catch (_: Exception) {}
            try {
                track.release()
            } catch (_: Exception) {}
        }
        audioTrack = null
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        isRecording.set(false)
        try {
            audioRecord?.release()
        } catch (_: Exception) {}
        audioRecord = null
        stopPlayerInternal()
    }
}
