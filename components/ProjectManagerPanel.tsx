import React, { useRef } from 'react';

interface ProjectManagerPanelProps {
  onDownloadProject: () => void;
  onLoadProjectFile: (file: File) => void;
  onLoadDemo: () => void;
  metadata: {
    characters: number;
    dialogueChunks: number;
    unmatched: number;
    versionLabel?: string;
  };
}

const ProjectManagerPanel: React.FC<ProjectManagerPanelProps> = ({
  onDownloadProject,
  onLoadProjectFile,
  onLoadDemo,
  metadata
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoadProjectFile(file);
      event.target.value = '';
    }
  };

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-highlight">Projects & Templates</h2>
        <span className="text-xs text-text-secondary">
          {metadata.characters} chars · {metadata.dialogueChunks} lines
        </span>
      </div>
      <p className="text-xs text-text-secondary mb-1">Unparsed lines: {metadata.unmatched}</p>
      {metadata.versionLabel && (
        <p className="text-xs text-text-secondary mb-3">Version label: {metadata.versionLabel}</p>
      )}
      <div className="space-y-2">
        <button
          onClick={onDownloadProject}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
        >
          Download Project (.json)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
        >
          Load Project File
        </button>
        <button
          onClick={onLoadDemo}
          className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
        >
          Load Demo Project
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ProjectManagerPanel;
