import React from 'react';
import { DialogueChunk } from '../types';

interface CommentsPanelProps {
  dialogueChunks: DialogueChunk[];
  comments: Map<string, string>;
  onCommentChange: (chunkIdentifier: string, comment: string) => void;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({ dialogueChunks, comments, onCommentChange }) => {
  const getChunkIdentifier = (chunk: DialogueChunk) => `${chunk.character}-${chunk.text}`;

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Comments</h2>
      {dialogueChunks.length === 0 ? (
        <p className="text-text-secondary">No dialogue chunks parsed yet to add comments.</p>
      ) : (
        <div className="overflow-y-auto max-h-60 custom-scrollbar">
          {dialogueChunks.map((chunk, index) => {
            const chunkIdentifier = getChunkIdentifier(chunk);
            return (
              <div key={index} className="p-2 border-b border-accent last:border-b-0">
                <p className="text-text-primary font-bold">{chunk.character}:</p>
                <p className="text-text-primary mb-1">{chunk.text}</p>
                <textarea
                  className="w-full p-2 bg-primary border border-accent rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-highlight text-text-primary text-sm"
                  placeholder="Add comment..."
                  value={comments.get(chunkIdentifier) || ''}
                  onChange={(e) => onCommentChange(chunkIdentifier, e.target.value)}
                  rows={2}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommentsPanel;
