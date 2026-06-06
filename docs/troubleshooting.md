# Troubleshooting

This guide covers common issues and their solutions when using tuimux.

---

## Ctrl+C Behavior

### Issue: Ctrl+C exits the entire app (older versions)

**Symptom:** Pressing `Ctrl+C` in the terminal exits tuimux instead of sending SIGINT to the running process.

**Solution:** This was fixed in v0.2.0. Update to the latest version:

```bash
bun install -g tuimux@latest
```

### Current Ctrl+C Behavior

In current versions:
- **Terminal Mode:** `Ctrl+C` is passed directly to the PTY and interrupts the running process (expected behavior)
- **Tabs Mode:** `Ctrl+C` is ignored - it does **not** exit the app

Press `q` in Tabs Mode to disconnect and keep apps running, or `Q` to quit and stop them.

---

## Terminal Rendering Issues

### Garbled or corrupted display

**Symptoms:**
- Characters appearing in wrong positions
- Colors not displaying correctly
- Terminal UI elements misaligned

**Solutions:**

1. **Check your TERM setting:**
   ```bash
   echo $TERM
   ```
   Tuimux works best with `xterm-256color`. If your terminal uses a different TERM, you can override it per-app:
   ```yaml
   apps:
     - name: "Shell"
       command: "bash"
       env:
         TERM: "xterm-256color"
   ```

2. **Resize your terminal:** Some rendering issues resolve after resizing the window.

3. **Restart the app:** Press `r` in Tabs Mode to restart the current application.

### TUI apps not displaying correctly

Some TUI applications have specific TERM requirements:

```yaml
apps:
  - name: "htop"
    command: "htop"
    env:
      TERM: "xterm-256color"
      COLORTERM: "truecolor"
```

---

## Theme and Color Issues

### Colors not applying correctly

**Symptom:** Theme colors from config aren't being used.

**Solutions:**

1. **Check YAML syntax:** Ensure hex colors are quoted:
   ```yaml
   theme:
     primary: "#82aaff"    # Correct
     # primary: #82aaff    # May cause issues
   ```

2. **Verify config location:** Tuimux loads config from:
   - `./tuimux.yaml` (local directory first)
   - `~/.config/tuimux/tuimux.yaml`

3. **Check for syntax errors:**
   ```bash
   cat ~/.config/tuimux/tuimux.yaml | python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)"
   ```

### Terminal doesn't support 24-bit color

If your terminal doesn't support truecolor, colors may appear different. Check support:

```bash
echo $COLORTERM  # Should be "truecolor" or "24bit"
```

Most modern terminals (Alacritty, iTerm2, GNOME Terminal, Konsole, WezTerm, Ghostty) support truecolor.

---

## App Launch Issues

### "Command not found" error

**Symptom:** App shows error: `command not found: <app>`

**Solutions:**

1. **Verify the command exists:**
   ```bash
   which htop
   ```

2. **Use full path if needed:**
   ```yaml
   apps:
     - name: "htop"
       command: "/usr/bin/htop"
   ```

3. **Check PATH in the spawned shell:** Tuimux inherits your environment, but some shells may not load `.bashrc`/`.zshrc` in non-interactive mode.

### App starts but immediately exits

**Symptom:** App flashes briefly then disappears.

**Solutions:**

1. **Check the app's exit code:** The app may be exiting due to an error. Try running it directly:
   ```bash
   htop
   ```

2. **Enable restart on exit** to see what happens:
   ```yaml
   apps:
     - name: "MyApp"
       command: "myapp"
       restart_on_exit: true
   ```

3. **Check for missing dependencies:** Some TUI apps require specific libraries or configurations.

---

## Session Persistence Issues

### Session not being restored

**Symptom:** Previously running apps don't restart when reopening tuimux.

**Solutions:**

1. **Ensure `persist` is enabled:**
   ```yaml
   session:
     persist: true
   ```

2. **Check state directory permissions:**
   ```bash
   ls -la ~/.local/state/tuimux/
   ```

3. **Verify session file exists:**
   ```bash
   cat ~/.local/state/tuimux/session.yaml
   ```

### Session file location

By default, the session is stored at `~/.local/state/tuimux/session.yaml`. You can customize this:

```yaml
session:
  persist: true
  file: "/custom/path/session.yaml"
```

---

## Ctrl+A Conflicts

### Ctrl+A conflicts with terminal emulator

**Symptom:** Pressing `Ctrl+A` triggers a terminal emulator action (e.g., "Select All") instead of toggling focus in tuimux.

**Solution:** Disable or rebind the conflicting shortcut in your terminal emulator settings. Most terminal emulators allow customizing keyboard shortcuts.

### Using tuimux with tmux/screen

**Symptom:** `Ctrl+A` is captured by tuimux instead of being sent to tmux (which also uses `Ctrl+A` as prefix).

**Solution:** Double-tap `Ctrl+A` in Terminal Mode to send the literal `Ctrl+A` character to the terminal:
- First `Ctrl+A` → Captured by tuimux (but you're already in terminal mode)
- Second `Ctrl+A` within 500ms → Sends `Ctrl+A` to tmux

### Keys not working in Terminal Mode

**Symptom:** Navigation keys like `j`/`k` don't work.

**Explanation:** In Terminal Mode, all keys (except `Ctrl+A`) are passed directly to the terminal application. This is by design.

**Solution:** Press `Ctrl+A` to switch to Tabs Mode, where navigation keys work directly.

---

## FAQ

### How do I quit tuimux?

Press `q` in Tabs Mode to disconnect, or `Q` to quit and stop all apps.

### How do I stop the background session server?

Run `tuimux --shutdown` to terminate the session server and stop all apps. This also clears the persisted session snapshot so apps will not relaunch unless `autostart: true` or `session.persist: true` is explicitly enabled.

### How do I add a new tab?

Press `t` in Tabs Mode to open the Add Tab dialog.

### How do I switch between Terminal and Tabs mode?

Press `Ctrl+A` to toggle between modes.

### How do I interrupt a running process?

In Terminal Mode, press `Ctrl+C` - it's passed directly to the terminal and sends SIGINT to the running process.

### Can I use tuimux inside tmux?

Yes! Both use `Ctrl+A`, so double-tap `Ctrl+A` in Terminal Mode to send it to the nested tmux session.

### Where is my config file?

```bash
# Default location:
~/.config/tuimux/tuimux.yaml

# Or in current directory:
./tuimux.yaml
```

### How do I reset to defaults?

Delete or rename your config file:
```bash
mv ~/.config/tuimux/tuimux.yaml ~/.config/tuimux/tuimux.yaml.bak
```

Then restart tuimux - it will start with an empty app list. Press `t` to add apps.

---

## Debug Mode

For detailed debugging output, run tuimux with the TUIMUX_DEBUG environment variable:

```bash
TUIMUX_DEBUG=1 tuimux
```

This enables verbose logging to help diagnose issues. The logs are written to stderr and can be captured:

```bash
TUIMUX_DEBUG=1 tuimux 2> debug.log
```

---

## Getting Help

If you encounter an issue not covered here:

1. Check the [GitHub Issues](https://github.com/shuv1337/tuimux/issues)
2. Open a new issue with:
   - Your OS and terminal emulator
   - Steps to reproduce
   - Expected vs actual behavior
   - Debug output if available
