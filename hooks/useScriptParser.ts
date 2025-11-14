import { useMemo } from 'react';
import { parseScript, ParsedScript } from '../utils/parser';

export { parseScript } from '../utils/parser';

export const useScriptParser = (scriptText: string): ParsedScript => {
  return useMemo(() => parseScript(scriptText), [scriptText]);
};
