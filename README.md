# Who Raised You

Playable music video prototype for the 2:19 track.

## Play Locally

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

Open `http://127.0.0.1:8787/`.

## GitHub Pages Launch

This is a static site. Push the full folder to a GitHub repository, then enable:

1. Repository `Settings`
2. `Pages`
3. Source: deploy from branch
4. Branch: `main`
5. Folder: `/root`

The game uses relative paths, so it works from a GitHub Pages project URL.

## Controls

Desktop: `A/D` or arrows to move, `W`/`Up`/`Space` to jump, `S`/`Down` to duck.

Phone: use the on-screen left/right, jump, and duck buttons.
