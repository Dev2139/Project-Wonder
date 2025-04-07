'use client';
import React, { useState, useEffect, useCallback } from 'react';

import {
  CallControls,
  CallParticipantsList,
  CallStatsButton,
  CallingState,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, LayoutList, Code, Play, MessageSquare } from 'lucide-react';
import Editor from '@monaco-editor/react';
import io, { Socket } from 'socket.io-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import Loader from './Loader';
import EndCallButton from './EndCallButton';
import { cn } from '@/lib/utils';

const socket: Socket = io('http://localhost:5000');

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';
type ChatMessage = { sender: string; message: string; timestamp: string };

const sampleAppContent = `console.log('Hello, World!');\nfunction add(a, b) {\n  return a + b;\n}\nconsole.log(add(5, 3));`;

const MeetingRoom: React.FC = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams?.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeContent, setCodeContent] = useState<string>(sampleAppContent);
  const [language, setLanguage] = useState<string>('javascript');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const { useCallCallingState } = useCallStateHooks();

  const callingState = useCallCallingState();
  const roomId = searchParams?.get('room') || 'default-room';

  const languageMap: Record<string, string> = {
    javascript: 'node@18.15.0',
    typescript: 'node@18.15.0',
    python: 'python@3.10.0',
    java: 'java@15.0.2',
    cpp: 'cpp@10.2.0',
    html: 'html',
    css: 'css',
  };

  const handleCodeChange = useCallback((value: string | undefined) => {
    if (isRunning) return; // Lock editor during execution
    const newCode = value || '';
    setCodeContent(newCode);
    socket.emit('codeChange', { room: roomId, code: newCode });
  }, [roomId, isRunning]);

  const executeCode = useCallback(async () => {
    if (!codeContent.trim()) {
      setOutput('Error: No code to run');
      socket.emit('outputUpdate', { room: roomId, output: 'Error: No code to run', isRunning: false });
      return;
    }

    setIsRunning(true);
    setOutput('Running...');
    socket.emit('outputUpdate', { room: roomId, output: 'Running...', isRunning: true });

    const languageVersion = languageMap[language] || 'node@18.15.0';
    const [lang, version] = languageVersion.split('@');

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          version: version,
          files: [{ name: `main.${lang === 'cpp' ? 'cpp' : lang === 'java' ? 'java' : 'js'}`, content: codeContent }],
          stdin: '',
          args: [],
          compile_timeout: 10000,
          run_timeout: 3000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to execute code: ${errorData.message || 'Unknown error'}`);
      }

      const result = await response.json();
      const outputText = result.run.stdout || result.run.stderr || 'No output';
      setOutput(outputText);
      socket.emit('outputUpdate', { room: roomId, output: outputText, isRunning: false });
    } catch (error: unknown) {
      const errorMessage = `Error: ${(error as Error).message}`;
      setOutput(errorMessage);
      socket.emit('outputUpdate', { room: roomId, output: errorMessage, isRunning: false });
    } finally {
      setIsRunning(false);
    }
  }, [codeContent, language, roomId]);

  useEffect(() => {
    const handleCodeUpdate = (newCode: string) => setCodeContent(newCode);
    const handleOutputUpdate = ({ output: newOutput, isRunning: runningState }: { output: string; isRunning: boolean }) => {
      setOutput(newOutput);
      setIsRunning(runningState);
    };
    const handleRunCode = () => executeCode();

    socket.on('codeUpdate', handleCodeUpdate);
    socket.on('outputUpdate', handleOutputUpdate);
    socket.on('runCode', handleRunCode);
    socket.emit('joinRoom', { room: roomId });

    return () => {
      socket.off('codeUpdate', handleCodeUpdate);
      socket.off('outputUpdate', handleOutputUpdate);
      socket.off('runCode', handleRunCode);
    };
  }, [roomId, executeCode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Block Ctrl+Tab
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        setAlertMessage('Ctrl+Tab is disabled during the meeting.');
        return;
      }

      // Block Alt+Tab
      if (event.altKey && event.key === 'Tab') {
        event.preventDefault();
        setAlertMessage('Alt+Tab is disabled during the meeting (browser may override).');
        return;
      }

      // Block Cmd+Tab on macOS
      if (event.metaKey && event.key === 'Tab') {
        event.preventDefault();
        setAlertMessage('Cmd+Tab is disabled during the meeting (browser may override).');
        return;
      }

      // Block Tab key
      if (event.key === 'Tab') {
        event.preventDefault();
        setAlertMessage('Tab key is disabled during the meeting.');
      }

      // Block Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        setAlertMessage('Escape key is disabled during the meeting.');
      }

      // Block F11
      if (event.key === 'F11') {
        event.preventDefault();
        setAlertMessage('F11 key is disabled during the meeting.');
      }

      // Block Alt+F4
      if (event.altKey && event.key === 'F4') {
        event.preventDefault();
        setAlertMessage('Alt+F4 is disabled during the meeting.');
      }

      // Block Ctrl+W or Cmd+W
      if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
        event.preventDefault();
        setAlertMessage('Ctrl+W/Cmd+W is disabled during the meeting.');
      }

      // Block Ctrl+T or Cmd+T
      if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        setAlertMessage('Ctrl+T/Cmd+T is disabled during the meeting.');
      }

      // Block Ctrl+N or Cmd+N
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        setAlertMessage('Ctrl+N/Cmd+N is disabled during the meeting.');
      }

      // Block Ctrl+R or Cmd+R
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        setAlertMessage('Ctrl+R/Cmd+R is disabled during the meeting.');
      }

      // Block F5
      if (event.key === 'F5') {
        event.preventDefault();
        setAlertMessage('F5 key is disabled during the meeting.');
      }

      // Block Ctrl+Shift+T or Cmd+Shift+T
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        setAlertMessage('Ctrl+Shift+T/Cmd+Shift+T is disabled during the meeting.');
      }

      // Block Ctrl+Shift+N or Cmd+Shift+N
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
        event.preventDefault();
        setAlertMessage('Ctrl+Shift+N/Cmd+Shift+N is disabled during the meeting.');
      }

      // Block Windows/Cmd key
      if (event.key === 'Meta' || event.metaKey) {
        event.preventDefault();
        setAlertMessage('Windows/Cmd key is disabled during the meeting.');
      }

      // Block Ctrl+Shift+I or Cmd+Option+I
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
        event.preventDefault();
        setAlertMessage('Ctrl+Shift+I/Cmd+Option+I is disabled during the meeting.');
      }

      // Block Copy (Ctrl+C or Cmd+C)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        setAlertMessage('Copying is disabled during the meeting.');
      }

      // Block Paste (Ctrl+V or Cmd+V)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        setAlertMessage('Pasting is disabled during the meeting.');
      }

      // Block Cut (Ctrl+X or Cmd+X)
      if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
        event.preventDefault();
        setAlertMessage('Cutting is disabled during the meeting.');
      }
    };

    // Block right-click
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      setAlertMessage('Right-click is disabled during the meeting.');
    };

    // Monitor window focus and notify all users
    const handleBlur = () => {
      socket.emit('tabSwitch', { room: roomId, user: 'You' }); // Emit tab switch event
    };

    const handleFocus = () => {
      setAlertMessage(null);
    };

    // Listen for tab switch notifications from other users
    const handleTabSwitchNotification = ({ user }: { user: string }) => {
      setAlertMessage(`${user} has switched tabs.`);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    socket.on('tabSwitchNotification', handleTabSwitchNotification);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      socket.off('tabSwitchNotification', handleTabSwitchNotification);
    };
  }, [roomId]);

  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLanguage(newLanguage);
    setOutput('');
  }, []);

  const handleRunCode = useCallback(() => {
    socket.emit('runCode', { room: roomId });
    executeCode();
  }, [roomId, executeCode]);

  // Chat functionality
  const handleSendMessage = useCallback(() => {
    if (messageInput.trim()) {
      const message: ChatMessage = {
        sender: 'You',
        message: messageInput,
        timestamp: new Date().toISOString(),
      };
      socket.emit('chatMessage', { room: roomId, ...message });
      setMessageInput('');
    }
  }, [messageInput, roomId]);

  useEffect(() => {
    socket.on('chatMessage', (newMessage: ChatMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    return () => {
      socket.off('chatMessage');
    };
  }, []);

  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout: React.FC = () => {
    const { useParticipants } = useCallStateHooks();
    const participants = useParticipants();
    
    if (showCodeEditor) {
      const organizer = participants.find(p => p.isLocalParticipant) || participants[0];
      return (
        <SpeakerLayout 
          participantsBarPosition="right"
          numberOfParticipants={1}
          pinnedParticipants={organizer ? [organizer.sessionId] : undefined}
        />
      );
    }

    switch (layout) {
      case 'grid': return <PaginatedGridLayout />;
      case 'speaker-right': return <SpeakerLayout participantsBarPosition="left" />;
      default: return <SpeakerLayout participantsBarPosition="right" />;
    }
  };

  return (
    <section className="relative h-screen w-full overflow-hidden pt-4 text-white">
      <div className="relative flex size-full items-center justify-center">
        <div
          className={cn('flex size-full max-w-[1000px] items-center transition-all duration-300', {
            'absolute top-4 right-4 w-[300px] h-[200px] z-10': showCodeEditor,
          })}
        >
          <CallLayout />
        </div>
        <div className={cn('h-[calc(100vh-86px)] hidden ml-2', {
          'show-block w-[200px] absolute top-1/2 right-0 transform -translate-y-1/2 flex flex-col overflow-y-auto bg-[#19232d] border-l border-gray-700 z-20': showParticipants && showCodeEditor,
          'show-block': showParticipants && !showCodeEditor,
        })}>
          <CallParticipantsList onClose={() => setShowParticipants(false)} />
        </div>
        <div className={cn(
          'absolute bg-[#19232d] p-4 transition-all duration-300 z-20 flex',
          { 
            hidden: !showCodeEditor, 
            'left-2 w-[78%] h-[90%] top-2': showCodeEditor 
          }
        )}>
          <div className="flex flex-col flex-1 h-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white">Code Editor</h3>
              <div className="flex items-center gap-2">
                <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="bg-[#0f1419] text-white p-1 rounded" disabled={isRunning}>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
                <button onClick={handleRunCode} className={cn('bg-[#0f1419] text-white p-1 rounded hover:bg-[#4c535b]', { 'opacity-50 cursor-not-allowed': isRunning })} disabled={isRunning}>
                  <Play size={20} />
                </button>
                <button onClick={() => setShowCodeEditor(false)} className="text-white hover:text-gray-300" disabled={isRunning}>×</button>
              </div>
            </div>
            <div className="flex h-[calc(100%-2rem)]">
              <div className="w-1/2 h-full">
                <Editor 
                  height="100%" 
                  language={language} 
                  value={codeContent} 
                  onChange={handleCodeChange} 
                  theme="vs-dark" 
                  options={{ 
                    minimap: { enabled: false }, 
                    fontSize: 14, 
                    scrollBeyondLastLine: false, 
                    automaticLayout: true,
                    contextmenu: false, // Disable right-click context menu
                    copyWithSyntaxHighlighting: false, // Disable copying with formatting
                    paste: false, // Disable pasting into editor
                  }} 
                />
              </div>
              <div className="w-1/2 h-full bg-[#0f1419] p-2 rounded overflow-auto">
                <pre className="text-white font-mono text-sm">{output || 'Run the code to see output'}</pre>
              </div>
            </div>
          </div>
        </div>
        <div className={cn(
          'absolute right-4 w-[300px] flex flex-col overflow-y-auto bg-[#19232d] border-l border-gray-700 z-20 transition-all duration-300',
          { 
            hidden: !showChat,
            'top-1/2 -translate-y-1/2 h-[calc(100vh-86px)]': !showCodeEditor && showChat,
            'top-[220px] h-[calc(100vh-320px)]': showCodeEditor && showChat
          }
        )}>
          <div className="p-2 border-b border-gray-600 flex justify-between items-center">
            <h3 className="text-white text-sm">Chat</h3>
            <button onClick={() => setShowChat(false)} className="text-white hover:text-gray-300">×</button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto">
            {messages.map((msg, index) => (
              <div key={index} className="text-white text-sm mb-2">
                <span className="font-bold">{msg.sender}</span> <span className="text-gray-400 text-xs">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                <p>{msg.message}</p>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-600">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="w-full bg-[#0f1419] text-white p-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Type a message..."
            />
            <button onClick={handleSendMessage} className="mt-1 w-full bg-blue-500 text-white p-1 rounded hover:bg-blue-600">Send</button>
          </div>
        </div>
      </div>
      {alertMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {alertMessage}
        </div>
      )}
      <div className="fixed bottom-0 flex w-full items-center justify-center gap-5 z-30">
        <CallControls onLeave={() => router.push('/')} />
        <DropdownMenu>
          <div className="flex items-center">
            <DropdownMenuTrigger className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
              <LayoutList size={20} className="text-white" />
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent className="border-dark-1 bg-dark-1 text-white">
            {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
              <div key={index}>
                <DropdownMenuItem onClick={() => setLayout(item.toLowerCase() as CallLayoutType)}>{item}</DropdownMenuItem>
                <DropdownMenuSeparator className="border-dark-1" />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <CallStatsButton />
        <button onClick={() => setShowParticipants((prev) => !prev)}>
          <div className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
            <Users size={20} className="text-white" />
          </div>
        </button>
        <button onClick={() => setShowCodeEditor((prev) => !prev)}>
          <div className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
            <Code size={20} className="text-white" />
          </div>
        </button>
        <button onClick={() => setShowChat((prev) => !prev)} className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
          <MessageSquare size={20} className="text-white" />
        </button>
        {!isPersonalRoom && <EndCallButton />}
      </div>
    </section>
  );
};

export default MeetingRoom;