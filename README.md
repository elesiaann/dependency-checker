# dependency-checker

> **Flag outdated & vulnerable packages — instantly, in your browser.**

A fast, privacy-friendly web tool that checks your `package.json` (npm) or `requirements.txt` (PyPI) against live registries and reports which packages are outdated.

**[Live Demo →](https://elesiaann.github.io/dependency-checker/)**

---

## Features

- **npm support** — paste `package.json`, checks `dependencies`, `devDependencies`, and `peerDependencies`
- **PyPI support** — paste `requirements.txt` with pinned or ranged versions
- **Live registry queries** — hits the npm Registry and PyPI API in real-time
- **Severity levels** — distinguishes major, minor, and patch updates
- **One-click update commands** — shows `npm install pkg@x.y.z` or `pip install pkg==x.y.z`
- **Export** — download results as JSON, CSV, or copy as a Markdown table
- **No server, no tracking** — runs entirely in your browser; nothing is stored

---

## Usage

1. Open the [live site](https://elesiaann.github.io/dependency-checker/)
2. Select **npm** or **PyPI**
3. Paste your manifest file contents (or click **Load example**)
4. Click **Check Dependencies** (or press `Ctrl + Enter`)
5. Review results and copy the upgrade commands

---

## Local development

No build step required — plain HTML, CSS, and JavaScript.

```bash
git clone https://github.com/elesiaann/dependency-checker.git
cd dependency-checker
# Open index.html in your browser, or serve with any static server:
npx serve .
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | Vanilla HTML5 / CSS3 / ES2020 |
| npm data | [registry.npmjs.org](https://registry.npmjs.org) (public API) |
| PyPI data | [pypi.org/pypi/{pkg}/json](https://pypi.org/pypi) (public API) |
| Hosting | GitHub Pages |

---

## Contributing

Issues and PRs are welcome! Please open an issue first to discuss what you'd like to change.

---

## License

[MIT](LICENSE)
