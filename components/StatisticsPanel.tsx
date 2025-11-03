import React from 'react';
import { GenerationStat } from '../types';

interface StatisticsPanelProps {
  generationStats: GenerationStat[];
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ generationStats }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Generation Statistics</h2>
      {generationStats.length === 0 ? (
        <p className="text-text-secondary">No generation statistics available yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-accent">
            <thead className="bg-primary">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Timestamp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Script Length</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Characters</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Cost</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Duration (s)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-secondary divide-y divide-accent">
              {generationStats.map((stat, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{new Date(stat.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{stat.scriptLength}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{stat.characterCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">${stat.estimatedCost.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{stat.duration.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary capitalize">{stat.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StatisticsPanel;
