# Gmail — Gmail-style email client

A fully working Gmail-inspired inbox: read/unread, star, archive, delete,
search, labels/tabs (Primary/Social/Promotions/Updates/Forums), compose
(with working minimize), reply, forward, an account switcher popup, and a
link button (top right) to your second site.

## Files
- `index.html` — page structure
- `styles.css` — Gmail-matching visual styling
- `app.js` — all interactivity, plus the `ACCOUNT` config (see below)
- `data.js` — **your 200 emails go here.** This is the file you'll edit most.

## How to add your 200 real emails
Open `data.js`. It's one JS array called `EMAILS`. Each entry looks like:

```js
{
  "id": 1,
  "from": "Priya Sharma",
  "fromEmail": "priya.sharma@example.com",
  "to": "you@yourmail.com",
  "subject": "Meeting rescheduled to Thursday",
  "preview": "Hi, just a quick note that our meeting has been moved...",
  "body": "Hi, just a quick note that our meeting has been moved to Thursday at 2:30 PM...",
  "label": "Primary",
  "daysAgo": 0,
  "read": false,
  "starred": false,
  "important": false
}
```

Field notes:
- `label` must be one of: `Primary`, `Social`, `Promotions`, `Updates`, `Forums`
  (these drive the tabs). You can rename/add labels — just also add a color
  for them in `LABEL_COLORS` near the top of `app.js`.
- `daysAgo`: 0 = today, 1 = yesterday, etc. Controls sort order and the date shown.
- `read`, `starred`, `important`: `true`/`false`.

If you have your 200 emails in a spreadsheet (From, Subject, Preview, Body,
Label, Days Ago, Read, Starred, Important columns), send it back to me and
I'll generate the whole `data.js` file for you in one shot — much faster
than typing 200 JS objects by hand.

## The account switcher (top-right avatar)
Click the round avatar top-right to open the Google-style account popup
(profile circle, "Hi, [name]!", other accounts, sign out, storage bar).
To customize it, open `app.js` and edit the `ACCOUNT` object near the top:

```js
const ACCOUNT = {
  name: "Your Name",
  email: "you@yourmail.com",
  avatarColor: "#4285F4",
  otherAccounts: [
    { name: "Second Account", email: "second@example.com", avatarColor: "#8430ce" }
  ],
  storagePercent: 16,
  storageTotal: "15 GB"
};
```

## The "linked site" button
Top right of the header, next to the refresh icon, there's a grid icon —
that's your link out to the second website. Open `index.html`, find:

```html
<a class="icon-btn" id="secondSiteLink" href="https://your-github-username.github.io/your-repo" target="_blank" ...>
```

Replace that `href` with your actual GitHub Pages URL once your second site
is live.

## Running it locally
No build step needed — it's plain HTML/CSS/JS. Just open `index.html` in
a browser, or serve it locally:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Deploying on GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo Settings → Pages → set source to your main branch (root).
3. Your site will be live at `https://<username>.github.io/<repo>`.

## A note on the "exact replica" brief
This UI closely follows Gmail's real layout, spacing, colors, and
interactions, and is now named "Gmail" throughout. The one deliberate
difference is the logo graphic — it uses an original mark instead of
Google's trademarked Gmail logo, since reproducing that exactly is a
trademark issue independent of school context. Everything else (three-pane
layout, compose card, account switcher, star/archive/delete icons, tabs,
hover states) is built to match closely.
