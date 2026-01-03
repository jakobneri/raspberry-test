# Power LED Activity Display Feature

## Overview

This feature allows you to configure the Raspberry Pi's power LED to display system activity instead of just being constantly on. This provides a visual indicator of your Pi's activity at a glance.

## Available LED Modes

- **SD Card Activity (mmc0)**: LED blinks when the SD card is being accessed
- **Heartbeat**: LED shows a heartbeat pattern (double-blink)
- **Activity + Power (actpwr)**: Combined activity indicator
- **Default**: Restore the LED to default behavior (always on)

## Configuration Methods

### 1. Dashboard (Web UI)

1. Navigate to the Dashboard
2. Look for the **Power LED** card (will only appear on Raspberry Pi systems)
3. Click the **Enable Activity Display** button to enable
4. Select your preferred mode from the dropdown menu
5. The LED will immediately change to the selected mode

### 2. CLI (Command Line Interface)

1. Run the CLI management tool:
   ```bash
   node dist/cli.js
   ```
2. Select **⚙️ System & Sessions**
3. Select **💡 Configure Power LED**
4. Follow the prompts to:
   - Enable or disable LED activity display
   - Choose your preferred mode (mmc0, heartbeat, or actpwr)
5. The configuration is saved and applied immediately

## Requirements

### Raspberry Pi Permissions

The LED control feature requires sudo access to write to the LED trigger files. You need to configure passwordless sudo for the LED control command:

```bash
sudo visudo
```

Add this line (replace `pi` with your username):
```
pi ALL=(ALL) NOPASSWD: /usr/bin/tee /sys/class/leds/PWR/trigger
```

Or for broader access to all LED operations:
```
pi ALL=(ALL) NOPASSWD: /usr/bin/tee /sys/class/leds/*/trigger
```

### System Compatibility

This feature is designed specifically for Raspberry Pi and requires:
- Linux kernel LED subsystem
- `/sys/class/leds/PWR/trigger` file (available on most Raspberry Pi models)

On non-Raspberry Pi systems, the feature will be automatically disabled and the UI will not show the LED control card.

## How It Works

### Technical Details

The feature works by writing to the kernel's LED trigger mechanism:

```bash
# Example: Set LED to SD card activity
echo "mmc0" | sudo tee /sys/class/leds/PWR/trigger

# Example: Set LED to heartbeat
echo "heartbeat" | sudo tee /sys/class/leds/PWR/trigger
```

### Persistence

- Configuration is stored in the SQLite database (`settings` table)
- Settings persist across server restarts
- The LED service automatically applies the saved configuration on startup

### Graceful Degradation

- On non-Raspberry Pi systems, the feature is automatically disabled
- The Dashboard will not show the LED control card
- The CLI will show a message that LED control is unavailable
- No errors will occur on systems without LED support

## Troubleshooting

### LED Not Changing

1. **Check Permissions**: Ensure sudo is configured correctly (see Requirements above)
2. **Check Logs**: Look for `[LED]` entries in the server console or system logs
3. **Manual Test**: Try manually setting the LED:
   ```bash
   echo "heartbeat" | sudo tee /sys/class/leds/PWR/trigger
   ```

### Feature Not Available

- Ensure you're running on a Raspberry Pi
- Check that `/sys/class/leds/PWR/trigger` exists:
  ```bash
  ls -l /sys/class/leds/PWR/trigger
  ```

### Configuration Not Persisting

- Check database file permissions
- Verify the `settings` table exists in `database.sqlite`
- Check server logs for database errors

## API Reference

### GET `/api/led/status`

Returns the current LED status and configuration.

**Response:**
```json
{
  "available": true,
  "config": {
    "enabled": true,
    "mode": "heartbeat",
    "ledType": "PWR"
  },
  "currentTrigger": "heartbeat",
  "availableTriggers": ["none", "mmc0", "timer", "heartbeat"]
}
```

### POST `/api/led/config`

Updates the LED configuration.

**Request:**
```json
{
  "enabled": true,
  "mode": "mmc0"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "enabled": true,
    "mode": "mmc0",
    "ledType": "PWR"
  }
}
```

## Security Considerations

- The LED control feature requires sudo access, which should be granted carefully
- Only grant permission for the specific `/usr/bin/tee /sys/class/leds/*/trigger` command
- The API endpoints are protected by JWT authentication
- Only authenticated users can change LED settings

## Future Enhancements

Potential improvements for future versions:
- Support for the ACT (activity) LED as well as PWR (power) LED
- Custom blink patterns
- LED status indicators for specific events (network traffic, CPU load, etc.)
- Scheduled LED modes (different modes at different times of day)
