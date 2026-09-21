import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';

import styles from './HomeScreen.scss';
import AgentModal from '../../components/AgentModal/AgentModal';
import { useAuth } from '../../context/AuthContext';
import {
  useVoiceAssistant,
  AssistantState,
} from '../../hooks/useVoiceAssistant';
import conversationApi from '../../services/api/conversationApi';

const HomeScreen = ({ navigation }: any) => {
  const { user } = useAuth();

  const [isModalVisible, setModalVisible] =
    useState(false);

  const [selectedAgent, setSelectedAgent] =
    useState('Maya');

  const [isCalling, setIsCalling] =
    useState(false);

  const [isIncognito, setIsIncognito] =
    useState(false);

  const [timer, setTimer] =
    useState(0);

  const [conversationId, setConversationId] =
    useState<string | null>(null);

  const [inputText, setInputText] =
    useState('');

  /*
   * React Native timer type.
   *
   * Do NOT use NodeJS.Timeout here because
   * this project does not include the NodeJS
   * type namespace.
   */
  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  // --------------------------------------------------
  // Voice Assistant
  // --------------------------------------------------

  const {
    state: assistantState,
    error: assistantError,
    lastResponse,
    recognizedText,
    startListening,
    stopListening,
    sendTextMessage,
    stopSpeaking,
  } = useVoiceAssistant(conversationId);

  // --------------------------------------------------
  // Initialize conversation
  // --------------------------------------------------

  useEffect(() => {
    const initConversation = async () => {
      if (!user) {
        return;
      }

      try {
        const existing =
          await conversationApi.getByUser(
            user.userId
          );

        if (
          existing.data &&
          existing.data.length > 0
        ) {
          setConversationId(
            existing.data[0].id
          );
        } else {
          const created =
            await conversationApi.create({
              userId: user.userId,
              title: `Chat with ${selectedAgent}`,
            });

          setConversationId(
            created.data.id
          );
        }
      } catch (e) {
        console.error(
          'Failed to init conversation:',
          e
        );
      }
    };

    initConversation();
  }, [user, selectedAgent]);

  // --------------------------------------------------
  // Call timer
  // --------------------------------------------------

  useEffect(() => {
    if (isCalling) {
      timerRef.current =
        setInterval(() => {
          setTimer(
            (previous) => previous + 1
          );
        }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );

        timerRef.current = null;
      }

      setTimer(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(
          timerRef.current
        );

        timerRef.current = null;
      }
    };
  }, [isCalling]);

  // --------------------------------------------------
  // Assistant errors
  // --------------------------------------------------

  useEffect(() => {
    if (assistantError) {
      Alert.alert(
        'Assistant Error',
        assistantError
      );
    }
  }, [assistantError]);

  // --------------------------------------------------
  // Format timer
  // --------------------------------------------------

  const formatTime = (
    seconds: number
  ) => {
    const mins = Math.floor(
      seconds / 60
    );

    const secs = seconds % 60;

    return `${mins
      .toString()
      .padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  // --------------------------------------------------
  // Start / End call
  // --------------------------------------------------

  const handleCallPress =
    async () => {
      if (isCalling) {
        // --------------------------------------------
        // END CALL
        // --------------------------------------------

        try {
          await stopListening();
        } catch (error) {
          console.error(
            'Failed to stop listening:',
            error
          );
        }

        stopSpeaking();

        setIsCalling(false);

        return;
      }

      // ----------------------------------------------
      // START CALL
      // ----------------------------------------------

      try {
        setTimer(0);
        setIsCalling(true);

        await startListening();
      } catch (error) {
        console.error(
          'Failed to start listening:',
          error
        );

        setIsCalling(false);
      }
    };

  // --------------------------------------------------
  // Toggle incognito mode
  // --------------------------------------------------

  const toggleIncognito = () => {
    if (isCalling) {
      return;
    }

    setIsIncognito(
      (previous) => !previous
    );
  };

  // --------------------------------------------------
  // Send text message
  // --------------------------------------------------

  const handleSendMessage =
    async () => {
      const cleanMessage =
        inputText.trim();

      if (!cleanMessage) {
        return;
      }

      if (
        assistantState ===
        AssistantState.THINKING
      ) {
        return;
      }

      try {
        setInputText('');

        await sendTextMessage(
          cleanMessage
        );
      } catch (error) {
        console.error(
          'Failed to send text message:',
          error
        );
      }
    };

  // --------------------------------------------------
  // Status text
  // --------------------------------------------------

  const getStatusText = () => {
    switch (assistantState) {
      case AssistantState.LISTENING:
        return 'Listening...';

      case AssistantState.PROCESSING:
        return 'Processing...';

      case AssistantState.THINKING:
        return 'Thinking...';

      case AssistantState.SPEAKING:
        return 'Speaking...';

      case AssistantState.ERROR:
        return 'Something went wrong';

      case AssistantState.IDLE:
      default:
        return isIncognito
          ? 'Start an incognito call'
          : 'Start a call';
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar
        barStyle="light-content"
      />

      {/* ========================================== */}
      {/* HEADER */}
      {/* ========================================== */}

      <View style={styles.header}>
        {/* Profile button */}

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() =>
            navigation.navigate(
              'Settings'
            )
          }
          hitSlop={{
            top: 20,
            bottom: 20,
            left: 20,
            right: 20,
          }}
        >
          <View
            style={
              styles.profileIconWrapper
            }
          >
            <Text
              style={
                styles.profileIconText
              }
            >
              👤
            </Text>
          </View>
        </TouchableOpacity>

        {/* Agent selector */}

        <TouchableOpacity
          style={styles.agentSelector}
          onPress={() =>
            setModalVisible(true)
          }
          disabled={isCalling}
        >
          <View
            style={
              styles.agentSelectorContent
            }
          >
            <View
              style={
                styles.agentNameContainer
              }
            >
              <Text
                style={styles.agentName}
              >
                {selectedAgent}
              </Text>

              {isIncognito && (
                <Text
                  style={
                    styles.incognitoSubtext
                  }
                >
                  Incognito Mode
                </Text>
              )}
            </View>

            {(isCalling ||
              assistantState !==
                AssistantState.IDLE) && (
              <View
                style={[
                  styles.callingIndicator,

                  assistantState ===
                    AssistantState.LISTENING && {
                    backgroundColor:
                      '#FF4C4C',
                  },
                ]}
              />
            )}

            <Text
              style={
                styles.dropdownIcon
              }
            >
              ⌄
            </Text>
          </View>
        </TouchableOpacity>

        {/* Incognito button */}

        <TouchableOpacity
          style={styles.iconButton}
          onPress={
            toggleIncognito
          }
          hitSlop={{
            top: 20,
            bottom: 20,
            left: 20,
            right: 20,
          }}
          activeOpacity={0.7}
        >
          <Text
            style={styles.iconText}
          >
            {isIncognito
              ? '✕'
              : '👻'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ========================================== */}
      {/* MAIN CONTENT */}
      {/* ========================================== */}

      <View style={styles.content}>
        {isIncognito &&
        !isCalling &&
        assistantState ===
          AssistantState.IDLE ? (
          <View
            style={
              styles.incognitoInfo
            }
          >
            <View
              style={
                styles.incognitoIconCircle
              }
            >
              <Text
                style={
                  styles.incognitoLargeIcon
                }
              >
                👻
              </Text>
            </View>

            <Text
              style={
                styles.incognitoTitle
              }
            >
              Incognito Mode
            </Text>

            <Text
              style={
                styles.incognitoDesc
              }
            >
              Calls made here are
              never saved or added
              to memory.
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.normalContent
            }
          >
            {/* Recognized speech */}

            {recognizedText !== '' && (
              <View
                style={
                  styles.userSpeechBubble
                }
              >
                <Text
                  style={
                    styles.userSpeechText
                  }
                >
                  "{recognizedText}"
                </Text>
              </View>
            )}

            {/* Maya circle */}

            <View
              style={[
                styles.agentCircle,

                (isCalling ||
                  assistantState !==
                    AssistantState.IDLE) &&
                  styles.agentCircleActive,

                assistantState ===
                  AssistantState.LISTENING && {
                  borderColor:
                    '#FF4C4C',
                },
              ]}
            >
              <Text
                style={
                  styles.agentLargeIcon
                }
              >
                {assistantState ===
                AssistantState.THINKING
                  ? '🧠'
                  : isIncognito
                  ? '👻'
                  : '👤'}
              </Text>
            </View>

            {/* Call timer */}

            {isCalling && (
              <View
                style={
                  styles.timerContainer
                }
              >
                <Text
                  style={
                    styles.timerText
                  }
                >
                  {formatTime(timer)}
                </Text>
              </View>
            )}

            {/* Maya response */}

            {lastResponse &&
              assistantState !==
                AssistantState.LISTENING && (
                <View
                  style={
                    styles.responseBubble
                  }
                >
                  <Text
                    style={
                      styles.responseText
                    }
                  >
                    {lastResponse}
                  </Text>
                </View>
              )}

            {/* Thinking indicator */}

            {assistantState ===
              AssistantState.THINKING && (
              <ActivityIndicator
                color="#6C63FF"
                style={{
                  marginTop: 20,
                }}
              />
            )}
          </View>
        )}
      </View>

      {/* ========================================== */}
      {/* CALL BUTTON */}
      {/* ========================================== */}

      <View
        style={
          styles.bottomSection
        }
      >
        <TouchableOpacity
          style={[
            styles.callButton,

            isCalling &&
              styles.callButtonActive,

            assistantState ===
              AssistantState.LISTENING && {
              backgroundColor:
                '#FF4C4C',
            },
          ]}
          onPress={
            handleCallPress
          }
        >
          <Text
            style={[
              styles.callIcon,

              isCalling &&
                styles.callIconActive,
            ]}
          >
            {isCalling
              ? '✕'
              : '📞'}
          </Text>
        </TouchableOpacity>

        <Text
          style={styles.callText}
        >
          {getStatusText()}
        </Text>
      </View>

      {/* ========================================== */}
      {/* TEXT INPUT */}
      {/* ========================================== */}

      <View
        style={
          styles.inputContainer
        }
      >
        {isIncognito ? (
          <View
            style={
              styles.disabledInput
            }
          >
            <Text
              style={
                styles.disabledInputText
              }
            >
              Texting is disabled in
              Incognito Mode
            </Text>
          </View>
        ) : (
          !isCalling &&
          assistantState ===
            AssistantState.IDLE && (
            <View
              style={
                styles.inputWrapper
              }
            >
              <TextInput
                style={styles.input}
                placeholder="Send a text"
                placeholderTextColor="#A0A0B0"
                value={inputText}
                onChangeText={
                  setInputText
                }
                onSubmitEditing={
                  handleSendMessage
                }
                returnKeyType="send"
              />

              {inputText.length >
                0 && (
                <TouchableOpacity
                  onPress={
                    handleSendMessage
                  }
                  style={
                    styles.sendButton
                  }
                >
                  <Text
                    style={
                      styles.sendIcon
                    }
                  >
                    ➔
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}
      </View>

      {/* ========================================== */}
      {/* AGENT MODAL */}
      {/* ========================================== */}

      <AgentModal
        visible={
          isModalVisible
        }
        onClose={() =>
          setModalVisible(false)
        }
        onSelect={(
          agent: string
        ) => {
          setSelectedAgent(
            agent
          );

          setModalVisible(
            false
          );
        }}
      />
    </SafeAreaView>
  );
};

export default HomeScreen;