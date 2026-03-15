#!/bin/bash
# Uninstall PulseBrief scheduled jobs

PLIST_DIR="$HOME/Library/LaunchAgents"

for name in fetch morning afternoon evening; do
  plist="$PLIST_DIR/com.pulsebrief.${name}.plist"
  if [ -f "$plist" ]; then
    launchctl unload "$plist" 2>/dev/null
    rm "$plist"
    echo "  ✓ ${name} removed"
  fi
done

echo "Done. All PulseBrief schedules removed."
