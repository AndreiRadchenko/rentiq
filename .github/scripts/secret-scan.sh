#!/usr/bin/env bash
set -euo pipefail

# Secret scanning script
# Detects credential-shaped values in staged changes
# Excludes .env.example and .env.stage.example (contain variable names, not real secrets)

PATTERNS=(
  # Generic secrets
  '(?i)(password|passwd|pwd)\s*[:=]\s*["\047][^\s"'\'']{8,}'
  '(?i)(api[_-]?key|apikey)\s*[:=]\s*["\047][^\s"'\'']{8,}'
  '(?i)(secret|token)\s*[:=]\s*["\047][^\s"'\'']{8,}'
  # Connection strings with credentials
  '(?i)(postgres|mysql|redis|mongodb)://[^\s"'\'']+:[^\s"'\'']+@'
  # Private keys
  '-----BEGIN\s+(RSA|EC|DSA|OPENSSH)?\s*PRIVATE\s+KEY-----'
  # AWS-style keys
  'AKIA[0-9A-Z]{16}'
  # GitHub tokens
  'ghp_[A-Za-z0-9]{36}'
)

EXCLUDE_FILES=(
  '.env.example'
  '.env.stage.example'
  'pnpm-lock.yaml'
  'package-lock.json'
)

EXIT_CODE=0

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No staged files to scan."
  exit 0
fi

echo "🔍 Scanning staged files for secrets..."

for file in $STAGED_FILES; do
  # Skip excluded files
  skip=false
  for exclude in "${EXCLUDE_FILES[@]}"; do
    if [[ "$file" == *"$exclude"* ]]; then
      skip=true
      break
    fi
  done
  if $skip; then
    continue
  fi

  # Skip binary files
  if file "$file" 2>/dev/null | grep -q "binary"; then
    continue
  fi

  # Scan file content
  for pattern in "${PATTERNS[@]}"; do
    if grep -Pn "$pattern" "$file" 2>/dev/null | head -5; then
      echo "⚠️  Potential secret found in: $file"
      EXIT_CODE=1
    fi
  done
done

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ No secrets detected."
else
  echo ""
  echo "❌ Potential secrets detected. Please review and ensure no real credentials are committed."
  echo "   If this is a false positive, add the file to EXCLUDE_FILES in this script."
fi

exit $EXIT_CODE
