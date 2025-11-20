#!/usr/bin/env ts-node
import { mkdir, readFile, writeFile } from 'fs/promises';
import { basename, resolve } from 'path';
import { spawn } from 'child_process';
import { parseScript } from '../utils/parser';
import { ProjectConfig } from '../types';

interface CliOptions {
  scripts: string[];
  configPath: string;
  outputDir: string;
  delayMs: number;
  concatenate: boolean;
  apiKey?: string;
}

const DEFAULT_DELAY = 500;
const slugify = (value: string) => value.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
const OUTPUT_FORMAT_DETAILS: Record<string, { extension: string; accept: string }> = {
  mp3_44100_128: { extension: 'mp3', accept: 'audio/mpeg' },
  mp3_44100_192: { extension: 'mp3', accept: 'audio/mpeg' },
  pcm_24000: { extension: 'wav', accept: 'audio/wav' }
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const getValues = (flag: string) => {
    const values: string[] = [];
    args.forEach((arg, index) => {
      if (arg === flag && args[index + 1]) {
        values.push(args[index + 1]);
      }
    });
    return values;
  };
  const getValue = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const scripts = getValues('--script');
  const configPath = getValue('--config');
  const outputDir = getValue('--out') || 'cli_output';
  const delayMs = Number(getValue('--delay') || DEFAULT_DELAY);
  const concatenate = args.includes('--concat');
  const apiKey = getValue('--api-key') || process.env.ELEVENLABS_API_KEY;

  if (!scripts.length) {
    throw new Error('Provide at least one --script path.');
  }
  if (!configPath) {
    throw new Error('Provide --config path.');
  }
  if (!apiKey) {
    throw new Error('Provide ELEVENLABS_API_KEY env var or --api-key argument.');
  }

  return { scripts, configPath, outputDir, delayMs, concatenate, apiKey };
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateChunk = async (
  chunkText: string,
  chunkCharacter: string,
  config: ProjectConfig,
  apiKey: string,
  filename: string,
  formatDetails: { extension: string; accept: string }
) => {
  const projectSettings = config.projectSettings;
  const characterConfig = config.characterConfigs[chunkCharacter];
  if (!characterConfig) {
    throw new Error(`Missing voice config for ${chunkCharacter}`);
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${characterConfig.voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': formatDetails.accept,
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: projectSettings.speakParentheticals && chunkText ? chunkText : chunkText.replace(/\([^)]+\)/g, ''),
      model_id: projectSettings.model,
      output_format: projectSettings.outputFormat,
      voice_settings: {
        stability: characterConfig.voiceSettings.stability,
        similarity_boost: characterConfig.voiceSettings.similarity_boost,
        style: characterConfig.voiceSettings.style,
        speed: characterConfig.voiceSettings.speed ?? 1,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error for ${chunkCharacter}: ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(filename, Buffer.from(arrayBuffer));
};

const concatenateWithFfmpeg = async (files: string[], outputDir: string) => {
  const fileListPath = resolve(outputDir, 'filelist.txt');
  const listContent = files.map(file => `file '${file}'`).join('\n');
  await writeFile(fileListPath, listContent);

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const ffmpeg = spawn('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', fileListPath, '-c', 'copy', resolve(outputDir, 'concatenated_audio.mp3')], {
      stdio: 'inherit'
    });
    ffmpeg.on('exit', code => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
};

const run = async () => {
  const options = parseArgs();
  const configContent = await readFile(resolve(options.configPath), 'utf-8');
  const projectConfig = JSON.parse(configContent) as ProjectConfig;
  await mkdir(options.outputDir, { recursive: true });
  const formatDetails = OUTPUT_FORMAT_DETAILS[projectConfig.projectSettings.outputFormat] || OUTPUT_FORMAT_DETAILS.mp3_44100_128;

  for (const scriptPath of options.scripts) {
    const scriptText = await readFile(resolve(scriptPath), 'utf-8');
    const parsed = parseScript(scriptText);
    const slug = slugify(basename(scriptPath).replace(/\.[^.]+$/, ''));
    const generatedFiles: string[] = [];

    for (let i = 0; i < parsed.dialogueChunks.length; i++) {
      const chunk = parsed.dialogueChunks[i];
      const text = projectConfig.projectSettings.speakParentheticals && chunk.originalText ? chunk.originalText : chunk.text;
      const filename = resolve(options.outputDir, `${slug}_${String(i).padStart(4, '0')}_${slugify(chunk.character)}.${formatDetails.extension}`);

      console.log(`[${i + 1}/${parsed.dialogueChunks.length}] ${chunk.character}`);
      await generateChunk(text, chunk.character, projectConfig, options.apiKey!, filename, formatDetails);
      generatedFiles.push(filename);
      if (i < parsed.dialogueChunks.length - 1) {
        await wait(options.delayMs);
      }
    }

    if (options.concatenate || projectConfig.projectSettings.concatenate) {
      try {
        await concatenateWithFfmpeg(generatedFiles, options.outputDir);
        console.log('Concatenated audio saved to concatenated_audio.mp3');
      } catch (error) {
        console.warn('Concatenation failed:', error);
      }
    }
  }
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
