# wanikani-advisor

AI-powered study advisor for WaniKani. Analyzes your review mistakes and uses Claude to provide personalized kanji/vocabulary advice.

## What it does

- Fetches your WaniKani review statistics to find your worst-performing items
- Groups visually similar kanji and shared-meaning confusion pairs
- Sends the analysis to Claude for personalized mnemonics, pattern breakdowns, and study tips

## Setup

Requires Node.js 24+ and pnpm.

```sh
pnpm install
```

Copy `.env.example` to `.env` and fill in your credentials:

```sh
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `WANIKANI_API_TOKEN` | Your WaniKani API token — get one at https://www.wanikani.com/settings/personal_access_tokens |
| `AWS_PROFILE` | AWS profile with Bedrock access (e.g. `sso`) |
| `AWS_REGION` | AWS region for Bedrock (e.g. `us-east-1`) |

If using AWS SSO, log in first:

```sh
aws sso login --profile sso
```

## Usage

```sh
pnpm dev
```

Claude AI advice is provided via Amazon Bedrock using the `us.anthropic.claude-opus-4-6-v1` inference profile.

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
pnpm dev -- --limit 10 --types kanji

# Raw analysis without AI advice
pnpm dev -- --no-ai --cli

# Terminal output instead of HTML report
pnpm dev -- --cli
```
