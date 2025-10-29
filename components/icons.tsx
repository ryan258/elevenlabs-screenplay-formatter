import React from 'react';

// Implemented SVG icon components used in ScriptInput and Modal components.
export const ExpandIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9.75 9.75M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L14.25 14.25M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9.75 14.25m10.5-4.5v4.5m0-4.5h-4.5m4.5 0L14.25 9.75" />
  </svg>
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
