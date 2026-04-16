export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY が未設定です" });
    }

    // ✅ここ修正（重要）
    let body = {};
    if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body);
      } catch {
        body = {};
      }
    } else {
      body = req.body || {};
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];
    const listenMode = !!body.listenMode;
    const userName = typeof body.userName === "string" ? body.userName.trim() : "";
    const lastReply = typeof body.lastReply === "string" ? body.lastReply.trim() : "";

    if (!message) {
      return res.status(400).json({ error: "message が空です" });
    }

    const STRONG_WORDS = [
      "死にたい",
      "消えたい",
      "もう限界",
      "限界",
      "終わりにしたい",
      "いなくなりたい",
      "しんどい",
      "苦しい",
      "つらい",
      "疲れた",
      "誰にも言えない"
    ];

    const strong = STRONG_WORDS.some((w) => message.includes(w));

    const nameNote = userName
      ? `ユーザー名は「${userName}」。毎回ではなく、自然な時だけ名前を呼ぶ。`
      : "";

    const avoidRepeat = lastReply
      ? `直前の返答「${lastReply}」と同じ言い回し、同じ締め方を繰り返さない。`
      : "";

    const modeRule = listenMode
      ? "返答は1文のみ。短く、静かに、深く受け止める。"
      : "返答は1〜3文。短めだが、薄くならないようにする。";

    const system = `
あなたは「ただ受け止める存在」です。
役割は、ユーザーの気持ちを否定せず、そのまま受け止めることです。

絶対にやってはいけないこと:
- アドバイス
- 解決策の提示
- 励まし
- ポジティブ変換
- 説教
- 一般論
- 軽い共感

禁止表現:
- 「そういう時もあるよ」
- 「大丈夫」
- 「頑張って」

返答ルール:
- ユーザーの言葉を少し拾って返す
- 深く、短く、重さをそのまま受け止める

${nameNote}
${avoidRepeat}
${modeRule}

${strong ? "強い感情を真正面から受け止める" : ""}
`.trim();

    const messages =
      history.length > 0
        ? history.map((item) => ({
            role: item.role,
            content: String(item.content || "")
          }))
        : [{ role: "user", content: message }];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 220,
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: JSON.stringify(data)
      });
    }

    const reply = data?.content?.[0]?.text?.trim();

    if (!reply) {
      return res.status(500).json({
        error: "replyが空"
      });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "server error"
    });
  }
}
