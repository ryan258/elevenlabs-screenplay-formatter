import React from 'react';

type Status = 'unknown' | 'checking' | 'online' | 'offline';

const statusCopy: Record<Status, { label: string; tone: string }> = {
  unknown: { label: 'Unknown', tone: 'bg-gray-600' },
  checking: { label: 'Checking…', tone: 'bg-blue-600' },
  online: { label: 'Online', tone: 'bg-green-600' },
  offline: { label: 'Offline', tone: 'bg-red-600' }
};

interface ConcatenationStatusProps {
  status: Status;
  onCheck: () => void;
  endpoint: string;
  healthUrl: string;
}

const ConcatenationStatus: React.FC<ConcatenationStatusProps> = ({ status, onCheck, endpoint, healthUrl }) => {
  const badge = statusCopy[status];

  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-highlight">Concatenation Status</h2>
        <span className={`text-xs px-2 py-1 rounded ${badge.tone}`}>{badge.label}</span>
      </div>
      <p className="text-sm text-text-secondary mb-2">
        Endpoint: <span className="font-mono break-all">{endpoint}</span>
      </p>
      <p className="text-xs text-text-secondary mb-4">
        Health check: <span className="font-mono break-all">{healthUrl}</span>
      </p>
      <button
        onClick={onCheck}
        disabled={status === 'checking'}
        className="w-full py-2 bg-accent hover:bg-highlight rounded-md text-sm font-semibold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-highlight"
      >
        {status === 'checking' ? 'Checking…' : 'Run Health Check'}
      </button>
    </div>
  );
};

export default ConcatenationStatus;
