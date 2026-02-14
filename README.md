# 💰 Business Empire Simulator — Multiplayer

A retro-terminal business tycoon game where you build a lemonade stand empire and compete with other players in a shared city economy.

**[▶ Play Live](https://your-username.github.io/your-repo-name/)**
*(Replace the link above with your GitHub Pages URL after deploying)*

---

## 🎮 How to Play

1. Start with $5 and 10 units of inventory
2. Set your price, restock inventory, and click **RUN DAY**
3. Earn profit, build reputation, and upgrade your business
4. Join a **City** in the Multiplayer tab to compete with other players!
5. Undercut competitors' prices to steal their customers — or price high for better margins

---

## 🌐 Multiplayer Features

- **🏆 Global Leaderboards** — Daily, weekly, and all-time rankings
- **🏙️ City Economy** — Shared customer pool; your pricing affects everyone
- **📡 City Feed** — Real-time activity from other players
- **💬 Chat** — Terminal-style city chat
- **🎯 Daily Challenges** — New challenges every day with cash rewards

---

## 🚀 Deploy Your Own Copy

### 1. Fork & Enable GitHub Pages

1. Fork this repository
2. Go to **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` · Folder: `/ (root)`
5. Click **Save** — your site will be live at `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

### 2. Set Up Supabase (for multiplayer)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `server/db/schema.sql`
3. Go to **Authentication → Providers → Anonymous** and enable it
4. Go to **Database → Replication** and enable Realtime for: `day_results`, `cities`, `chat_messages`
5. Copy your **Project URL** and **anon public key** from **Settings → API**
6. Edit `js/config.js` and replace the values:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

7. Commit and push — multiplayer is now live!

> **Note:** The game works in solo mode even without Supabase. Multiplayer features (leaderboards, city, chat) require the setup above.

---

## 📁 Project Structure

```
├── index.html          — Main game (HTML shell)
├── css/
│   ├── main.css        — Retro terminal theme
│   ├── animations.css  — Floating text, pulse effects
│   └── multiplayer.css — Leaderboard, chat, city UI
├── js/
│   ├── config.js       — Supabase credentials
│   ├── state.js        — Game state + save/load
│   ├── engine.js       — Core game logic (processDay)
│   ├── ui.js           — DOM updates
│   ├── actions.js      — Player actions
│   ├── effects.js      — Visual effects
│   ├── api.js          — Supabase client
│   ├── multiplayer.js  — City, leaderboard, chat
│   └── app.js          — Entry point
├── shared/
│   └── constants.js    — Game balance constants
└── server/
    └── db/schema.sql   — Supabase database schema
```

---

## 🛠 Tech Stack

- **Frontend:** Vanilla JavaScript — no frameworks, no build tools
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime)
- **Hosting:** GitHub Pages (free static hosting)
