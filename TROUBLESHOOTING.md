# Troubleshooting

Common issues and solutions for the Kavita to Obsidian plugin.

## Quick Reference

| Error Message | Likely Cause | Solution |
|---------------|--------------|----------|
| Authentication failed | Wrong or expired API key | [Regenerate your API key](#authentication-failed) |
| Network error (status 401/403) | Invalid credentials | [Check API key](#network-error-status-401403) |
| Network error (status 404) | Wrong URL | [Verify Kavita URL](#network-error-status-404) |
| Network error (connection refused) | Kavita not running | [Start Kavita server](#connection-refused) |
| Failed to parse response | Version mismatch | [Update plugin or Kavita](#failed-to-parse-response) |
| Failed to write file | Invalid path | [Check output path](#failed-to-write-file) |
| Folder operation failed | Invalid folder name | [Fix folder name](#folder-operation-failed) |
| No annotations synced | No highlights exist | [Create highlights first](#no-annotations-synced) |

---

## Authentication Failed

**Error:** `Authentication failed: Invalid credentials`

**Cause:** Your API key is incorrect, expired, or was regenerated.

**Solution:**

1. Open Kavita and log in
2. Click your profile icon in the top right
3. Go to **User Settings**
4. Select **3rd Party Clients** tab
5. Copy your API key (or click **Reset** to generate a new one)
6. In Obsidian, go to Settings → **Kavita Sync**
7. Paste the new API key
8. Try syncing again

**Note:** If you regenerate your API key in Kavita, you must update it in the plugin settings.

---

## Network Error (Status 401/403)

**Error:** `Network error calling [URL] (status 401)` or `(status 403)`

**Cause:** The server rejected your credentials.

**Solution:**

- Your API key may have been regenerated - [get a fresh key](#authentication-failed)
- Check that you're using the correct Kavita account
- Ensure your user account has permission to access annotations

---

## Network Error (Status 404)

**Error:** `Network error calling [URL] (status 404)`

**Cause:** The plugin can't find Kavita at the URL you specified.

**Solution:**

1. Verify your Kavita URL is correct:
   - Open your Kavita server in a browser
   - Copy the URL from the address bar (e.g., `http://localhost:5000`)
   - Make sure there's **no trailing slash** at the end

2. Common URL issues:
   - Wrong: `http://localhost:5000/` (trailing slash)
   - Wrong: `http://localhost:5000/api` (don't include /api)
   - Correct: `http://localhost:5000`

3. If using a reverse proxy:
   - Use the full external URL (e.g., `https://kavita.example.com`)
   - Ensure the proxy forwards `/api/` requests correctly

---

## Connection Refused

**Error:** `Network error calling [URL]` with no status code, or "connection refused"

**Cause:** The plugin can't connect to Kavita at all.

**Solution:**

1. **Check Kavita is running:**
   - Open your Kavita URL in a browser
   - If it doesn't load, start Kavita

2. **Check the port number:**
   - Default Kavita port is `5000`
   - Verify in Kavita's `appsettings.json` or Docker config

3. **Check firewall settings:**
   - Ensure the port isn't blocked
   - If Kavita is on another machine, ensure it's accessible from your network

4. **Docker users:**
   - Ensure the container is running: `docker ps`
   - Check port mapping: `-p 5000:5000`

---

## Failed to Parse Response

**Error:** `Failed to parse response: expected [type]`

**Cause:** Kavita returned data in an unexpected format.

**Solution:**

1. **Update the plugin:**
   - Check for plugin updates in Obsidian Settings → Community Plugins

2. **Check Kavita version:**
   - This plugin is tested with Kavita 0.8.x
   - Very old or very new versions may have API changes

3. **Report the issue:**
   - If both are up to date, [open an issue](https://github.com/davidlbowman/kavita-to-obsidian/issues) with:
     - Your Kavita version
     - The full error message

---

## Failed to Write File

**Error:** `Failed to write file: [path]`

**Cause:** Obsidian can't write to the specified location.

**Solution:**

1. **Check the output path is valid:**
   - Avoid special characters: `< > : " | ? *`
   - Use forward slashes: `folder/file.md` not `folder\file.md`

2. **Check the folder exists:**
   - For paths like `notes/kavita.md`, ensure `notes/` folder exists

3. **Check file isn't locked:**
   - Close the file if it's open in another app
   - Restart Obsidian if needed

---

## Folder Operation Failed

**Error:** `Folder [operation] failed: [path]`

**Cause:** The plugin can't create or access a folder.

**Solution:**

1. **Check root folder name:**
   - Avoid special characters: `< > : " / \ | ? *`
   - Avoid Windows reserved names: `CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`

2. **Check permissions:**
   - Ensure Obsidian has write access to your vault

3. **Restart Obsidian:**
   - Sometimes file system operations need a restart

---

## No Annotations Synced

**Error:** `Synced 0 annotations`

**Cause:** No highlights or annotations exist in Kavita.

**Solution:**

1. **Create highlights in Kavita:**
   - Open a book in the Kavita reader
   - Select text and click **Highlight**
   - Optionally add a note

2. **Check spoiler settings:**
   - If highlights are marked as spoilers, enable "Include spoilers" in plugin settings

3. **Verify annotations exist:**
   - In Kavita, go to a book's details page
   - Check the "Annotations" or "Highlights" section

---

## HTTPS Certificate Issues

**Error:** SSL/TLS or certificate errors

**Cause:** Self-signed or invalid HTTPS certificate.

**Solution:**

1. **Use HTTP locally:**
   - For local Kavita, use `http://localhost:5000` instead of HTTPS

2. **Fix certificate for remote access:**
   - Use a valid certificate (e.g., Let's Encrypt)
   - Or use a reverse proxy that handles HTTPS

---

## Still Having Issues?

If your problem isn't listed here:

1. **Check existing issues:** [GitHub Issues](https://github.com/davidlbowman/kavita-to-obsidian/issues)
2. **Open a new issue:** [Report a bug](https://github.com/davidlbowman/kavita-to-obsidian/issues/new)

Include:
- Kavita version
- Plugin version
- The exact error message
- Steps to reproduce
