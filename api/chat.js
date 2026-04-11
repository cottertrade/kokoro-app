export default async function handler(req, res) {
if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
return res.status(500).json({ error: ‘ANTHROPIC_API_KEY が未設定です。Vercelの環境変数を確認してください。’ });
}

const { message, history, listenMode, userName, lastReply } = req.body;
if (!message) {
return res.status(400).json({ error: ‘messageが空です’ });
}

const STRONG_WORDS = [‘死にたい’, ‘消えたい’, ‘もう限界’, ‘限界’, ‘終わりにしたい’, ‘いなくなりたい’];
const strong = STRONG_WORDS.some(w => message.includes(w));

const nameNote = userName ? `ユーザーの名前は「${userName}」。3〜4回に1回だけ自然に名前を呼ぶ。` : ‘’;
const avoidNote = lastReply ? `【絶対禁止】直前の返答「${lastReply}」と同じ書き出し・同じ表現を使うな。全く違う角度から返せ。` : ‘’;
const listenNote = listenMode ? ‘返答は1文のみ。’ : ‘返答は1〜3文。毎回長さを変える。’;
const strongRule = strong
? ‘【最重要】強い感情ワードを含む。「聞いてるよ」「受け取ってる」「大丈夫」系は完全禁止。ユーザーの言葉を拾い「理解してる感」を出す。使う言葉：「そこまで追い込まれてるんだね」「それだけ一人で抱えてきたんだね」「ちゃんとわかるよ」’
: ‘ユーザーの言葉を少し拾って返す。「聞いてるよ」は軽い場面のみOK。’;

const system = `あなたは「ただ受け止める存在」です。 絶対ルール：否定しない、アドバイスしない、解決しようとしない。「でも」「ただし」「前向きに」「なんとかなる」は絶対使わない。 ${nameNote} ${strongRule} ${avoidNote} ${listenNote} 返答は日本語で。`;

// historyにはすでにユーザーの最新メッセージが含まれている前提
// 空や不正な場合は最低限メッセージを入れる
let messages = Array.isArray(history) && history.length > 0
? history
: [{ role: ‘user’, content: message }];

try {
const response = await fetch(‘https://api.anthropic.com/v1/messages’, {
method: ‘POST’,
headers: {
‘Content-Type’: ‘application/json’,
‘x-api-key’: apiKey,
‘anthropic-version’: ‘2023-06-01’
},
body: JSON.stringify({
model: ‘claude-haiku-4-5-20251001’,
max_tokens: 300,
system,
messages
})
});

```
const data = await response.json();

if (!response.ok) {
  return res.status(500).json({ error: 'Anthropic APIエラー: ' + JSON.stringify(data) });
}

const reply = data.content && data.content.map(b => b.text || '').join('');
if (!reply) {
  return res.status(500).json({ error: 'replyが空: ' + JSON.stringify(data) });
}

return res.status(200).json({ reply });
```

} catch (err) {
return res.status(500).json({ error: ’サーバーエラー: ’ + err.message });
}
}
