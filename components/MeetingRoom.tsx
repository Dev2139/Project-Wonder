'use client';
import { useState, useEffect } from 'react';
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
import { Users, LayoutList, Code, Play } from 'lucide-react';
import Editor from '@monaco-editor/react';

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

type CallLayoutType = 'grid' | 'speaker-left' | 'speaker-right';

const sampleAppContent = `console.log('Hello, World!');\nfunction add(a, b) {\n  return a + b;\n}\nconsole.log(add(5, 3));`;

const MeetingRoom = () => {
  const searchParams = useSearchParams();
  const isPersonalRoom = !!searchParams.get('personal');
  const router = useRouter();
  const [layout, setLayout] = useState<CallLayoutType>('speaker-left');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeContent, setCodeContent] = useState(sampleAppContent);
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null); // State for custom alert
  const { useCallCallingState } = useCallStateHooks();

  const callingState = useCallCallingState();

  // Updated language map with versions supported by Piston (emkc.org)
  const languageMap = {
    javascript: 'node@18.15.0',
    typescript: 'node@18.15.0',
    python: 'python@3.10.0',
    java: 'java@15.0.2',
    cpp: 'cpp@10.2.0',
    html: 'html',
    css: 'css',
  };

  // Disable Alt+Tab, Ctrl+Tab, and Escape keys with alerts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        setAlertMessage('Escape key is disabled during the meeting.');
        console.log('Escape key disabled');
      }

      // Prevent Ctrl+Tab
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        setAlertMessage('Ctrl+Tab is disabled during the meeting.');
        console.log('Ctrl+Tab disabled');
      }

      // Attempt to prevent Alt+Tab (limited effectiveness)
      if (event.altKey && event.key === 'Tab') {
        event.preventDefault();
        setAlertMessage('Alt+Tab is disabled during the meeting (browser may override).');
        console.log('Alt+Tab disabled (browser may override)');
      }
    };

    // Add event listener to the document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Clear alert message after 3 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => setAlertMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setOutput('');
  };

  const handleRunCode = async () => {
    if (!codeContent.trim()) {
      setOutput('Error: No code to run');
      return;
    }

    setIsRunning(true);
    setOutput('Running...');

    const languageVersion = languageMap[language] || 'node@18.15.0';
    const [lang, version] = languageVersion.split('@');

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: lang,
          version: version,
          files: [
            {
              name: `main.${lang === 'cpp' ? 'cpp' : lang === 'java' ? 'java' : 'js'}`,
              content: codeContent,
            },
          ],
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
      console.log('Piston Result:', result);

      const outputText = result.run.stdout || result.run.stderr || 'No output';
      setOutput(outputText);
    } catch (error) {
      console.error('Execution Error:', error);
      setOutput(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  if (callingState !== CallingState.JOINED) return <Loader />;

  const CallLayout = () => {
    switch (layout) {
      case 'grid':
        return <PaginatedGridLayout />;
      case 'speaker-right':
        return <SpeakerLayout participantsBarPosition="left" />;
      default:
        return <SpeakerLayout participantsBarPosition="right" />;
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

        <div
          className={cn('h-[calc(100vh-86px)] hidden ml-2', {
            'show-block': showParticipants && !showCodeEditor,
          })}
        >
          <CallParticipantsList onClose={() => setShowParticipants(false)} />
        </div>

        <div
          className={cn(
            'absolute h-[calc(100vh-86px)] w-[75%] bg-[#19232d] p-4 transition-all duration-300 z-20',
            {
              'hidden': !showCodeEditor,
              'flex flex-col top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2': showCodeEditor,
            }
          )}
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white">Code Editor</h3>
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-[#0f1419] text-white p-1 rounded"
                  disabled={isRunning}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                </select>
                <button
                  onClick={handleRunCode}
                  className={cn(
                    'bg-[#0f1419] text-white p-1 rounded hover:bg-[#4c535b]',
                    { 'opacity-50 cursor-not-allowed': isRunning }
                  )}
                  disabled={isRunning}
                >
                  <Play size={20} />
                </button>
                <button
                  onClick={() => setShowCodeEditor(false)}
                  className="text-white hover:text-gray-300"
                  disabled={isRunning}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex h-[calc(100%-2rem)]">
              <div className="w-1/2 h-full">
                <Editor
                  height="100%"
                  language={language}
                  value={codeContent}
                  onChange={(value) => setCodeContent(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              </div>
              <div className="w-1/2 h-full bg-[#0f1419] p-2 rounded overflow-auto">
                <pre className="text-white font-mono text-sm">{output || 'Run the code to see output'}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Alert Message */}
      {alertMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow-lg z-50">
          {alertMessage}
        </div>
      )}

      <div className="fixed bottom-0 flex w-full items-center justify-center gap-5 z-30">
        <CallControls onLeave={() => router.push(`/`)} />
        <DropdownMenu>
          <div className="flex items-center">
            <DropdownMenuTrigger className="cursor-pointer rounded-2xl bg-[#19232d] px-4 py-2 hover:bg-[#4c535b]">
              <LayoutList size={20} className="text-white" />
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent className="border-dark-1 bg-dark-1 text-white">
            {['Grid', 'Speaker-Left', 'Speaker-Right'].map((item, index) => (
              <div key={index}>
                <DropdownMenuItem
                  onClick={() => setLayout(item.toLowerCase() as CallLayoutType)}
                >
                  {item}
                </DropdownMenuItem>
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
        {!isPersonalRoom && <EndCallButton />}
      </div>
    </section>
  );
};

export default MeetingRoom;