#!/bin/bash
# Install PulseBrief scheduled briefs on macOS using launchd
# This creates three scheduled jobs: morning (07:00), afternoon (13:00), evening (18:00)
# Plus a fetch job every 30 minutes to keep sources fresh

PULSEBRIEF_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
NODE_PATH="$(which node)"
TSX_PATH="$(which npx)"

mkdir -p "$PLIST_DIR"

# Helper to create a plist
create_plist() {
  local name=$1
  local command=$2
  local hour=$3
  local minute=$4
  local interval=$5
  local plist_file="$PLIST_DIR/com.pulsebrief.${name}.plist"

  cat > "$plist_file" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pulsebrief.${name}</string>
  <key>WorkingDirectory</key>
  <string>${PULSEBRIEF_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${TSX_PATH}</string>
    <string>tsx</string>
    <string>src/index.ts</string>
    <string>${command}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
EOF

  if [ -n "$hour" ]; then
    cat >> "$plist_file" << EOF
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
EOF
  fi

  if [ -n "$interval" ]; then
    cat >> "$plist_file" << EOF
  <key>StartInterval</key>
  <integer>${interval}</integer>
EOF
  fi

  cat >> "$plist_file" << EOF
  <key>StandardOutPath</key>
  <string>${PULSEBRIEF_DIR}/data/logs/${name}.log</string>
  <key>StandardErrorPath</key>
  <string>${PULSEBRIEF_DIR}/data/logs/${name}.log</string>
</dict>
</plist>
EOF

  # Unload if already loaded, then load
  launchctl unload "$plist_file" 2>/dev/null
  launchctl load "$plist_file"
  echo "  ✓ ${name} installed"
}

echo "Installing PulseBrief schedules..."
echo "  Project: ${PULSEBRIEF_DIR}"
echo ""

mkdir -p "$PULSEBRIEF_DIR/data/logs"

# Fetch sources every 30 minutes
create_plist "fetch" "fetch" "" "" "1800"

# Morning brief at 07:00
create_plist "morning" "morning" "7" "0" ""

# Afternoon brief at 13:00
create_plist "afternoon" "afternoon" "13" "0" ""

# Evening brief at 18:00
create_plist "evening" "evening" "18" "0" ""

echo ""
echo "Done. Schedules:"
echo "  Fetch:     every 30 minutes"
echo "  Morning:   07:00 daily"
echo "  Afternoon: 13:00 daily"
echo "  Evening:   18:00 daily"
echo ""
echo "Logs: ${PULSEBRIEF_DIR}/data/logs/"
echo "Uninstall: bash ${PULSEBRIEF_DIR}/scripts/uninstall-schedule.sh"
