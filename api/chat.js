async function redis(command, args = []) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL}/${command}/${args.map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Redis error');
  }
  return data.result;
}

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      message,
      history,
      listenMode,
      userName,
      lastReply,
      clientId,
      excludeFromStats
    } = req.body;

    const STRONG_WORDS = [
      '死にたい',
      '消えたい',
      'もう限界',
      '限界',
      '終わりにしたい',
      'いなくなりたい'
    ];

    const isStrong = (t) => STRONG_WORDS.some((w) => (t || '').includes(w));
    const strong = isStrong(message || '');

    const nameNote = userName
      ? `ユーザーの名前は「${userName}」。3〜4回に1回だけ自然に名前を呼ぶ。`
      : '';

    const avoidNote = lastReply
      ? `【絶対禁止】直前の返答「${lastReply}」と全く同じ表現・同じ書き出しを使うな。違う角度から返せ。`
      : '';

    const listenNote = listenMode
      ? '返答は1文のみ。'
      : '返答は1〜3文。毎回長さを変える。';

    const strongRule = strong
      ? `
【最重要】強い感情ワードを含む。
- 「聞いてるよ」「受け取ってる」「大丈夫」系は完全禁止
- ユーザーの言葉を拾って「理解してる感」を出す
- 例：「旦那が浮気してる」→「旦那に浮気されて、そこまで追い詰められたんだね」
- 使う言葉：「そこまで追い込まれてるんだね」「それだけ一人で抱えてきたんだね」「ちゃんとわかるよ」
`
      : `
- ユーザーの言葉を必ず少し拾って返す
- 「聞いてるよ」は軽い場面のみOK
`;

    const systemPrompt = `あなたは「ただ受け止める存在」です。

絶対ルール：否定しない、アドバイスしない、解決しようとしない。「でも」「ただし」「前向きに」「なんとかなる」は絶対使わない。

${nameNote}
${strongRule}
${avoidNote}
${listenNote}
返答は日本語で。`;

    const safeHistory =
      Array.isArray(history) && history.length
        ? history
        : [{ role: 'user', content: message }];

    if (!excludeFromStats && clientId) {
      const todayKey = `dau:${ymd(0)}`;
      await Promise.all([
        redis('sadd', ['users:all', clientId]),
        redis('incr', ['messages:total']),
        redis('sadd', [todayKey, clientId]),
        redis('expire', [todayKey, 60 * 60 * 24 * 8]),
        redis('setex', [`seen:${clientId}`, 60 * 60 * 24 * 7, '1'])
      ]);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 300,
        system: systemPrompt,
        messages: safeHistory
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || JSON.stringify(data)
      });
    }

    const reply =
      data.content?.map((b) => b.text || '').join('') || '返答が空でした';

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'server error'
    });
  }
}
