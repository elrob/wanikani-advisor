# wanikani-advisor

AI-powered study advisor for WaniKani. Analyzes your review mistakes and uses Claude to provide personalized kanji/vocabulary advice.

## What it does

- Fetches your WaniKani review statistics to find your worst-performing items
- Groups visually similar kanji and shared-meaning confusion pairs
- Sends the analysis to Claude for personalized mnemonics, pattern breakdowns, and study tips

## Setup

Requires Node.js 22+.

```sh
npm install
npm run build
```

## Usage

```sh
WANIKANI_API_TOKEN=<token> npm start
```

Claude AI advice is provided via Amazon Bedrock. AWS credentials are auto-detected from your environment (profile, env vars, IAM role, etc.).

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--limit, -l` | 20 | Number of worst items to analyze |
| `--min-errors, -m` | 3 | Minimum errors to include an item |
| `--types, -t` | kanji,vocabulary | Subject types to include |
| `--no-ai` | false | Skip Claude advice, show raw analysis only |
| `--cli` | false | Output to terminal instead of HTML report |

### Examples

```sh
# Top 10 worst kanji only
WANIKANI_API_TOKEN=... npm start -- --limit 10 --types kanji

# Raw analysis without AI advice
WANIKANI_API_TOKEN=... npm start -- --no-ai

# Development mode (no build step)
WANIKANI_API_TOKEN=... npm run dev
```

## Tokens & credentials

- **WaniKani**: https://www.wanikani.com/settings/personal_access_tokens
- **AWS (Bedrock)**: Uses standard AWS credential chain (env vars, `~/.aws/credentials`, IAM role, etc.)
