export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY が未設定です" });
    }

    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];
    const listenMode = !!body.listenMode;
    const userName = typeof body.userName === "string" ? body.userName.trim() : "";
    const lastReply = typeof body.lastReply === "string" ? body.lastReply.trim() : "";

    if (!message) {
      return res.status(400).json({ error: "messageが空です" });
    }

    const STRONG_WORDS = [
      "死にたい",
      "消えたい",
      "もう限界",
      "限界",
      "終わりにしたい",
      "いなくなりたい"
    ];

    const strong = STRONG_WORDS.some((w) => message.includes(w));

    const nameNote = userName
      ? `ユーザーの名前は「${userName}」。3〜4回に1回だけ自然に名前を呼ぶ。`
      : "";

    const avoidNote = lastReply
      ? `直前の返答「${lastReply}」と同じ表現を使うな。`
      : "";

    const listenNote = listenMode
      ? "返答は1文のみ。"
      : "返答は1〜3文。毎回長さを変える。";

    const strongRule = strong
      ? "強い感情ワード検出。「聞いてるよ」「大丈夫」系は禁止。ユーザーの言葉を拾い、理解している感じを出す。"
      : "ユーザーの言葉を少し拾って返す。";

    const system =
      "あなたは『ただ受け止める存在』です。否定しない、アドバイスしない、解決しようとしない。" +
      "『でも』『前向きに』『なんとかなる』は使わない。" +
      nameNote +
      strongRule +
      avoidNote +
      listenNote +
      "返答は日本語で。";

    const messages =
      history.length > 0
        ? history
            .filter((item) => item && (item.role === "user" || item.role === "assistant"))
            .map((item) => ({
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
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        system,
        messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "APIエラー: " + JSON.stringify(data)
      });
    }

    const reply = Array.isArray(data.content)
      ? data.content.map((b) => b.text || "").join("")
      : "";

    if (!reply) {
      return res.status(500).json({
        error: "replyが空: " + JSON.stringify(data)
      });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: err && err.message ? err.message : "server error"
    });
  }
}
