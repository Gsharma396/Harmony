import React, { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import CircularProgress from '@mui/material/CircularProgress';
import { v4 as uuidv4 } from 'uuid'; // Import the UUID library

const Home = () => {
  const [voiceOn, setVoiceOn] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "👋 Hi there! I'm Harmony from Haven Senior Investments. How can I help?" }
  ]);

  const [lastUserInputTime, setLastUserInputTime] = useState(Date.now());
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [hasShownReminderMessage, setHasShownReminderMessage] = useState(false);

  const [questionCount, setQuestionCount] = useState(0);

  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('');
  const [audioFinished, setAudioFinished] = useState(false);
  const [canGenerateMessage, setCanGenerateMessage] = useState(true);

  const messageListRef = useRef(null);
  const textAreaRef = useRef(null);
  const audioRef = useRef(null);
const [reminderTimeout, setReminderTimeout] = useState(null);

  const [uuid, setUuid] = useState('');

  useEffect(() => {
    const generatedUuid = uuidv4();
    setUuid(generatedUuid);
  }, []);

  useEffect(() => {
    const messageList = messageListRef.current;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages]);

  useEffect(() => {
    textAreaRef.current.focus();
  }, []);

  const resetState = () => {
    setVoiceOn(false);
    setAudioUrl('');
    setUserInput('');
    setLoading(false);
    setMessages([
      { role: 'assistant', content: "Hi there! I'm Harmony, an AI designed to assist you. How can I help?" }
    ]);
    setLastUserInputTime(Date.now());
    setHasUserSentMessage(false);
    setHasShownReminderMessage(false);
    setQuestionCount(0);

    setUserEmail('');
    setUserName('');
    setUserPhoneNumber('');
    setAudioFinished(false);
    setCanGenerateMessage(true);

    textAreaRef.current.focus();
  };

  useEffect(() => {
    if (voiceOn && audioUrl) {
      const audioElement = new Audio(audioUrl);
      audioRef.current = audioElement;
      audioElement.addEventListener('ended', () => {
        setAudioFinished(true);

      });
      audioElement.play();
    } else if (!voiceOn) {
      if (audioRef.current) {
        audioRef.current.pause();
        setAudioFinished(true);
      }

    }
  }, [voiceOn, audioUrl]);

 
  const handleReminderMessage = () => {
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        role: 'assistant',
        content: "I see you haven't responded. Are you there?",
      },
    ]);
  };

  
  const handleError = () => {
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        role: 'assistant',
        content:
          "Oops, it looks like my response got cut short. Please try sending your message again and I'll do my best to respond in full. Thank you for your patience!",
      },
    ]);
    setLoading(false);
    setUserInput('');
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  if (userInput.trim() === '') {
    return;
  }

  setLoading(true);
  const context = [...messages, { role: 'user', content: userInput }];
  setMessages(context);
  setLastUserInputTime(Date.now());
  setHasUserSentMessage(true);
  setHasShownReminderMessage(false);

  // Clear the previous reminderTimeout if exists
  if (reminderTimeout) {
    clearTimeout(reminderTimeout);
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: context, uuid }),
  });

  if (!response.ok) {
    handleError();
    return;
  }

  setUserInput('');

  const data = await response.json();

  if (questionCount >= 2 && canGenerateMessage) {
    setCanGenerateMessage(false);
  }

  // Set a 60-second delay before adding the reminder message
  const newReminderTimeout = setTimeout(() => {
    handleReminderMessage();
    setHasShownReminderMessage(true);
  }, 60000);

  setReminderTimeout(newReminderTimeout);

  // Add assistant message after user message
  setMessages((prevMessages) => [
    ...prevMessages,
    { role: 'assistant', content: data.result.content },
  ]);

  setAudioUrl(data.audioUrl);
  setLoading(false);
};


  const handleVoiceToggle = () => {
    setVoiceOn((prevState) => !prevState);
  };

  const handleEnter = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && userInput.trim() !== '') {
      handleSubmit(e);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setHasUserSentMessage(false);
      setHasShownReminderMessage(false);
      setLastUserInputTime(Date.now());
    }
  };

  return (
    <>
      <Head>
        <title>Harmony</title>
        <meta name="description" content="GPT-4 interface" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.topnav}>
        <div className={styles.navlogo}>
          <a>Harmony</a>
        </div>
        <div className={styles.navlinks}></div>
      </div>
      <main className={styles.main}>
        <div className={styles.cloud}>
          <div ref={messageListRef} className={styles.messagelist}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === 'user' && loading && index === messages.length - 1
                    ? styles.usermessagewaiting
                    :

 message.role === 'assistant'
                    ? styles.apimessage
                    : styles.usermessage
                }
              >
                {message.role === 'assistant' ? (
                  <Image
                    src="/openai.png"
                    alt="AI"
                    width="30"
                    height="30"
                    className={styles.boticon}
                    priority={true}
                  />
                ) : (
                  <Image
                    src="/usericon.png"
                    alt="Me"
                    width="30"
                    height="30"
                    className={styles.usericon}
                    priority={true}
                  />
                )}
                <div className={styles.markdownanswer}>
                  <ReactMarkdown linkTarget="_blank">{message.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.center}>
          <div className={styles.cloudform}>
            <form onSubmit={handleSubmit}>
              <textarea
                disabled={loading}
                onKeyDown={handleEnter}
                ref={textAreaRef}
                autoFocus={false}
                rows={1}
                maxLength={512}
                type="text"
                id="userInput"
                name="userInput"
                placeholder={loading ? 'Waiting for response...' : 'Talk to Harmony...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className={styles.textarea}
              />
              <button type="submit" disabled={loading} className={styles.generatebutton}>
                {loading ? (
                  <div className={styles.loadingwheel}>
                    <CircularProgress color="inherit" size={20} />
                  </div>
                ) : (
                  <svg viewBox="0 0 20 20" className={styles.svgicon} xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                  </svg>
                )}
              </button>
            </form>
          </div>
          <div className={styles.voiceToggle}>
            <label className={styles.toggleLabel}>
            <br />
              <a> Audio</a>
          
              <br />
              <br />
              <br />
              <input
                type="checkbox"
                checked={voiceOn}
                onChange={handleVoiceToggle}
                className={styles.toggleInput}
              />
              <span className={styles.slider}></span>
            </label>
            
          </div>
          <div className={styles.footer}>
            <br />
            <br />
            <p>Powered by <a>SprngGPT</a></p>
          </div>
        </div>
      </main>
    </>
  );
};

export default Home;