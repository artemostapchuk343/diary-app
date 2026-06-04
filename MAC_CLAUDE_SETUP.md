# Mac Claude Setup Instructions

**You are Claude Code running on Artem's Mac. Follow these steps to set yourself up, then delete this file.**

---

## 1. Who is Artem

- Full-time developer, home lab enthusiast
- Email: artem.ostapchuk@gmail.com
- GitHub: `artemostapchuk343`
- Main PC is a Windows 11 workstation (ARTEM-PC). This Mac is a secondary device.

## 2. Network & Devices

| Device | LAN IP | Tailscale IP | User | Password |
|--------|--------|--------------|------|----------|
| ARTEM-PC (Windows 11) | 192.168.100.56 | 100.111.202.71 | artem | Forfiter343 |
| Server (HP EliteDesk 800 G3) | 192.168.100.242 | 100.110.13.120 | User | 4444 |
| Raspberry Pi Zero W | 192.168.100.47 | 100.94.9.86 | pi | 246852987 |

## 3. The Memory System

Artem uses Claude Code's auto-memory system. All memories live in a **private GitHub repo**:
`https://github.com/artemostapchuk343/claude-memory`

On PC the memory folder is at:
`C:\Users\artem\.claude\projects\c--Users-artem-Documents\memory\`

Claude Code scopes memory per project directory — the folder name is derived from the working directory path (slashes replaced with dashes). You need to clone this repo into the correct folder on Mac so Claude loads it automatically.

### Step 3a — Authenticate with GitHub

```bash
gh auth login
# Choose: GitHub.com → HTTPS → authenticate with credentials
# Username: artemostapchuk343
# The password / token should be in the keychain or prompted
```

### Step 3b — Find your project slug

Run this from the directory where you'll normally use Claude on this Mac (e.g. `~/Documents`):

```bash
python3 -c "import os, re; p=os.getcwd(); print(re.sub(r'[/\\\\:]', '-', p).strip('-'))"
```

This prints the slug. For example, if CWD is `/Users/artem/Documents`, the slug is `Users-artem-Documents`.

### Step 3c — Clone the memory repo

```bash
# Replace <slug> with what you got above
SLUG="Users-artem-Documents"   # ← edit this

mkdir -p ~/.claude/projects/$SLUG
# If a memory/ folder already exists, back it up first:
# mv ~/.claude/projects/$SLUG/memory ~/.claude/projects/$SLUG/memory.bak

git clone https://github.com/artemostapchuk343/claude-memory \
  ~/.claude/projects/$SLUG/memory
```

### Step 3d — Verify

```bash
ls ~/.claude/projects/$SLUG/memory/
# Should show: MEMORY.md, user_profile.md, credentials.md, project_*.md, etc.
```

## 4. Create ~/.claude/CLAUDE.md on Mac

Create or overwrite `~/.claude/CLAUDE.md` with the following content:

```markdown
# Mac — Claude Code Context

## Machine
- This is Artem's Mac (secondary device)
- Primary workstation is ARTEM-PC (Windows 11, 192.168.100.56)

## Other Devices
| Device | LAN IP | Tailscale IP | User | Password |
|--------|--------|--------------|------|----------|
| ARTEM-PC (Windows 11) | 192.168.100.56 | 100.111.202.71 | artem | Forfiter343 |
| Server (HP EliteDesk 800 G3) | 192.168.100.242 | 100.110.13.120 | User | 4444 |
| Raspberry Pi Zero W | 192.168.100.47 | 100.94.9.86 | pi | 246852987 |

## Key Projects
- **Personal Dashboard**: ~/Documents/personal-dashboard — React/Vite PWA, deploys to Vercel
- **Smart home app**: ~/Documents/smart-home-app — React/Vite, deploys to Pi
- **Sonos app**: ~/Documents/sonos-app — React/Vite, deploys to Pi
- **Memory (git repo)**: ~/.claude/projects/<slug>/memory/

## Tools
- **gh**: authenticated as `artemostapchuk343`
- **Node / npm**: use `node` / `npm` directly (should be in PATH on Mac)
- **SSH key**: `~/.ssh/id_ed25519` (authorized on Pi and Server)

## Important Rules
- Always commit and push to GitHub after every code change
- Memory sync: after editing memory files, `git add -A && git commit -m "sync" && git push` from the memory folder
- Never enable Windows Update on the server without asking first
- SSH to Pi/server: use `-o StrictHostKeyChecking=no -o BatchMode=yes`
- The Pi is the hub for smart home + Sonos apps (Flask backend, served at raspberrypi.tail51efc.ts.net via Tailscale Funnel)
```

## 5. Set up memory sync alias (optional but useful)

Add to `~/.zshrc`:
```bash
alias sync-memory='cd ~/.claude/projects/<slug>/memory && git add -A && git commit -m "sync" && git push && cd -'
alias pull-memory='cd ~/.claude/projects/<slug>/memory && git pull && cd -'
```

## 6. If you work from multiple directories on Mac

Claude scopes memory to the CWD slug. If you switch between `~/Documents` and `~/Documents/personal-dashboard`, they get different slugs and you'd need symlinks:

```bash
# If personal-dashboard slug is different, symlink it to the same memory
ln -s ~/.claude/projects/Users-artem-Documents/memory \
      ~/.claude/projects/Users-artem-Documents-personal-dashboard/memory
```

## 7. Done — delete this file

Once memory is set up and `MEMORY.md` loads correctly in your conversations, delete this file from the repo:

```bash
cd ~/Documents/personal-dashboard
git rm MAC_CLAUDE_SETUP.md
git commit -m "remove mac setup file"
git push
```

---

*This file was created by PC's Claude Code to bootstrap Mac setup.*
