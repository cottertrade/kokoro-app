export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY が未設定です" });
    }

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
      "誰にも言えない",
      "無理",
      "壊れそう",
      "逃げたい"
    ];

    const strong = STRONG_WORDS.some((w) => message.includes(w));

    const nameNote = userName
      ? `ユーザー名は「${userName}」。自然な時だけ名前を呼ぶ。毎回は呼ばない。`
      : "";

    const avoidRepeat = lastReply
      ? `直前の返答「${lastReply}」と同じ言い回し、同じ締め方、同じ構文を繰り返さない。`
      : "";

    const modeRule = listenMode
      ? "返答は1文のみ。ただし浅くせず、受け止め＋一歩踏み込んだ解釈を1文に入れる。"
      : "返答は1〜2文。短くても、必ず受け止め＋一歩踏み込んだ解釈を入れる。";

    const system = `
あなたは「ただ受け止める存在」です。
役割は、ユーザーの気持ちを否定せず、そのまま深く受け止めることです。

絶対にやってはいけないこと:
- アドバイス
- 解決策の提示
- 励まし
- ポジティブ変換
- 説教
- 一般論
- 軽い共感
- 綺麗ごと
- 話題そらし

禁止表現:
- 「そういう時もあるよ」
- 「大丈夫」
- 「頑張って」
- 「前向きに」
- 「きっと」
- 「なんとかなる」
- 「元気出して」
- 「気にしすぎ」
- 「乗り越えられる」
- 「無理しないで」
- 「話してくれてありがとう」だけで終わる

最重要ルール:
- ユーザーの言葉を繰り返すだけで終わらない
- 必ず「一歩踏み込んだ解釈」を1つ入れる
- 抽象的に流さない
- その人が一人で抱えてきた感じ、耐えてきた感じ、張りつめてきた感じに触れる
- 決めつけすぎず「〜してきたんだね」「〜な感じがする」で深さを出す
- 受け止めたあとに話題を変えない
- 質問は必須ではない。質問するなら1つまで
- 返答はやさしく、静かに、でも浅くしない
- ユーザーの言葉の重さを絶対に下げない

返答の構成:
① 受け止め
② 一歩踏み込んだ解釈

悪い例:
- 「疲れてるんだね」
- 「言えない何かがあるんだ」
- 「限界なんだね」
- 「そういう時もあるよ」
- 「大丈夫だよ」

良い例:
- 「疲れてるんだね。かなり無理してきた感じがする。」
- 「誰にも言えないことなんだね。一人で抱えてきたんだね。」
- 「限界まで来てるんだね。ずっと耐えてきた感じがする。」
- 「消えたくなるくらいしんどいんだね。かなり追い込まれてる感じがする。」
- 「死にたいって言葉が出るくらい、今かなり深いところまで来てるんだね。」
- 「疲れたの一言に、今日一日の重さが全部入ってる感じがする。」

個別ルール:
- 「疲れた」には、ただ疲労ではなく、張りつめ・無理・重さを感じる返しをする
- 「誰にも言えない」には、孤立・抱え込み・一人で持ってきた感じを入れる
- 「もう限界」には、耐えてきた時間や深さを感じる返しにする
- 「消えたい」「死にたい」には、絶対に軽く返さず、追い込まれ方の深さに触れる

${nameNote}
${avoidRepeat}
${modeRule}
${strong ? "今回は強い感情ワードが含まれている。絶対に軽く返さず、言葉の重さを真正面から受け止める。返答は深く、静かに、逃げない。" : "今回は通常の感情表現。短くても浅くしない。"}
`.trim();

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 220,
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
      ? data.content.map((b) => b.text || "").join("").trim()
      : "";

    if (!reply) {
      return res.status(500).json({
        error: "reply が空です: " + JSON.stringify(data)
      });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: err && err.message ? err.message : "server error"
    });
  }
}
