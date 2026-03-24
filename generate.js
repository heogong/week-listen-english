require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// ── CLI 인자 파싱 ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const topic = get('--topic', 'Daily Life');
const level = get('--level', 'beginner');  // beginner | intermediate | advanced
const id    = get('--id', `${topic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`);
const scriptOnly = get('--script', null);  // TTS 전용 모드: 기존 스크립트 id

// ── Anthropic 클라이언트 ──────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── OpenAI TTS ────────────────────────────────────────────────────
function splitChunks(text, maxLen = 4096) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const cut = remaining.lastIndexOf('. ', maxLen);
    const pos = cut > 0 ? cut + 2 : maxLen;
    chunks.push(remaining.slice(0, pos).trim());
    remaining = remaining.slice(pos).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

const VOICES = ['alloy', 'ash', 'echo', 'sage', 'fable', 'onyx', 'sage', 'nova', 'shimmer'];
const voice = VOICES[Math.floor(Math.random() * VOICES.length)];

async function ttsChunk(text) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'tts-1', voice, input: text, response_format: 'mp3' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err.error) || 'TTS 실패');
  }
  return Buffer.from(await res.arrayBuffer());
}

async function generateTTS(text, outputPath) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 .env에 없습니다');
  const chunks = splitChunks(text);
  console.log(`🔊 Generating TTS... voice: ${voice} (${chunks.length} chunk${chunks.length > 1 ? 's' : ''})`);
  const buffers = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks.length > 1) process.stdout.write(`   Chunk ${i + 1}/${chunks.length}...\r`);
    buffers.push(await ttsChunk(chunks[i]));
  }
  if (chunks.length > 1) process.stdout.write('\n');
  fs.writeFileSync(outputPath, Buffer.concat(buffers));
}

const FALLBACK_ID = 'sarah-daily';

async function generateScript() {
  const prompt = `Create a ${level}-level English listening passage about "${topic}".
Return ONLY a JSON object with this exact structure:
{
  "title": "Short title",
  "topic": "${topic}",
  "level": "${level}",
  "sentences": [
    {"p": true},
    {"en": "English sentence.", "ko": "Korean translation."},
    ...
  ]
}
Rules:
- 35-45 sentences total
- Insert {"p": true} before each new paragraph (every 5-7 sentences)
- beginner: simple vocabulary, short sentences
- intermediate: varied vocabulary, mixed sentence lengths
- advanced: sophisticated vocabulary, complex ideas
- 7-9 paragraphs
- No extra text, just the JSON object`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim().replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function generate() {
  let data;
  let scriptId;

  if (scriptOnly) {
    // TTS 전용 모드
    scriptId = scriptOnly;
    console.log(`\n🔊 TTS only mode`);
    console.log(`   Script: ${scriptId}\n`);
    const scriptPath = path.join(__dirname, 'scripts', `${scriptId}.json`);
    if (!fs.existsSync(scriptPath)) throw new Error(`scripts/${scriptId}.json 파일이 없습니다`);
    data = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));
    console.log(`✓ Loaded: scripts/${scriptId}.json`);
  } else {
    // AI 스크립트 생성 모드
    scriptId = id;
    console.log(`\n🎧 Generating script...`);
    console.log(`   Topic : ${topic}`);
    console.log(`   Level : ${level}`);
    console.log(`   ID    : ${id}\n`);

    try {
      data = await generateScript();
      const scriptPath = path.join(__dirname, 'scripts', `${scriptId}.json`);
      fs.writeFileSync(scriptPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`✓ Saved: scripts/${scriptId}.json`);
    } catch (e) {
      console.warn(`⚠ Anthropic 오류: ${e.message}`);
      console.warn(`→ fallback: scripts/${FALLBACK_ID}.json 으로 TTS 진행\n`);
      scriptId = FALLBACK_ID;
      data = JSON.parse(fs.readFileSync(path.join(__dirname, 'scripts', `${FALLBACK_ID}.json`), 'utf-8'));
    }
  }

  // TTS 생성
  const fullText = data.sentences.filter(s => s.en).map(s => s.en).join(' ');
  const audioPath = path.join(__dirname, 'audio', `${scriptId}.mp3`);
  await generateTTS(fullText, audioPath);
  console.log(`✓ Saved: audio/${scriptId}.mp3`);

  // scripts/index.json 자동 업데이트 (FALLBACK_ID 제외, index에 없는 경우만)
  if (scriptId !== FALLBACK_ID) {
    const indexPath = path.join(__dirname, 'scripts', 'index.json');
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    if (!index.find(s => s.id === scriptId)) {
      const createdAt = new Date().toISOString().slice(0, 10);
      index.unshift({ id: scriptId, title: data.title, level: data.level, hasAudio: true, createdAt });
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
      console.log(`✓ Updated: scripts/index.json`);
    }
  }

  const sentenceCount = data.sentences.filter(s => s.en).length;
  console.log(`  Title    : ${data.title}`);
  console.log(`  Sentences: ${sentenceCount}`);
  console.log(`\n→ git add scripts/ audio/ && git commit -m "add: ${data.title}" && git push\n`);
}

generate().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
