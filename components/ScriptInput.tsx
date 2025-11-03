import React, { useState } from 'react';
import { ExpandIcon } from './icons';
import ScriptTemplateSelector from './ScriptTemplateSelector';

interface ScriptInputProps {
  scriptText: string;
  setScriptText: (text: string) => void;
  onExpand: () => void;
  onFilesDrop: (files: File[]) => void;
}

const ScriptInput: React.FC<ScriptInputProps> = ({ scriptText, setScriptText, onExpand, onFilesDrop }) => {
  const [isDragging, setIsDragging] = useState(false);

  const placeholderText = `Required format:

Characters:
- CHARACTER ONE
- CHARACTER TWO

INT. LOCATION - DAY

CHARACTER ONE
First line of dialogue.

CHARACTER TWO
Response here.

See EXAMPLE_SCREENPLAY.md for detailed formatting guide.`;

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      onFilesDrop(files);
    }
  };

  return (
    <div 
      className={`flex flex-col h-full bg-secondary p-4 rounded-lg shadow-lg border-2 border-dashed ${isDragging ? 'border-highlight' : 'border-transparent'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-highlight">Screenplay Input</h2>
        <div className="flex items-center space-x-2">
            <button
                onClick={onExpand}
                className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md transition-colors flex items-center space-x-1.5"
                aria-label="Expand editor"
            >
                <ExpandIcon className="w-4 h-4" />
                <span>Expand</span>
            </button>
            <button
              onClick={() => setScriptText('')}
              className="text-sm px-3 py-1 bg-accent hover:bg-highlight rounded-md transition-colors"
            >
              Clear
            </button>
        </div>
      </div>
      <div className="mb-2 text-xs text-text-secondary">
        💡 Tip: Start with "Characters:" followed by character names with dashes. See{' '}
        <a
          href="EXAMPLE_SCREENPLAY.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-highlight hover:underline"
        >
          formatting guide
        </a>
        {' '}
        or{' '}
        <a
          href="example.txt"
          target="_blank"
          rel="noopener noreferrer"
          className="text-highlight hover:underline"
        >
          example
        </a>
      </div>
      <ScriptTemplateSelector onSelectTemplate={setScriptText} />
      <textarea
        value={scriptText}
        onChange={(e) => setScriptText(e.target.value)}
        placeholder={placeholderText}
        className="flex-grow w-full p-3 bg-primary border border-accent rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-highlight text-text-primary custom-scrollbar"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#e94560 #1a1a2e' }}
      />
    </div>
  );
};

export default ScriptInput;

