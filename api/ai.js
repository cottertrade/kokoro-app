export default async function handler(req, res) {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();

  return res.status(200).json({
    exists: !!key,
    prefix: key ? key.slice(0, 20) : "",
    length: key.length
  });
}
