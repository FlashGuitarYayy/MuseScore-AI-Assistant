# MuseScore AI Assistant

A plugin for MuseScore Studio 4.6 that lets you edit a score by talking to an AI. The model (DeepSeek, or any OpenAI-compatible API) reads the score and makes changes through a small set of tools; every edit is one undoable transaction. Recurring tasks become **skills** in the open [Agent Skills](https://agentskills.io) format: one-click buttons, `/name` commands, shareable as a single file.

<!-- demo GIF goes here: docs/demo.gif -->

## Features

- **Chat-driven editing.** "Make the selection eighth notes", "transpose the piece from F to E", "add a down-up strum pattern" — the assistant reads the selection, runs a script inside one undo step, and reports what changed. **Undo turn** reverts the last turn.
- **Skills.** Bundled fingerstyle-guitar skills (bass on beats 1 and 3, chord tones on eighths, lyrics to TAB, strum patterns, muted noteheads …). Create new ones from chat, in the built-in editor, or by installing a SKILL.md from a URL.
- **Grounded in the API.** Before claiming something cannot be done, the assistant searches the bundled API index for MuseScore 4.6.3, inspects the live objects, or fetches the matching source file from GitHub.
- **Session tools.** Summaries that review what worked and propose skills; automatic context compaction; per-turn logs.
- **Local bridge.** An optional file-based job queue so a local coding agent (for example Claude Code) can drive the plugin without going through the model.
- **Docked panel** at the bottom of the MuseScore window; English / 中文 (Traditional) interface.

## Requirements

- MuseScore Studio 4.6.x (tested on 4.6.3, Windows).
- A DeepSeek API key, or any OpenAI-compatible endpoint (base URL and model are configurable).

## Installation

1. Download or clone this repository into MuseScore's plugins directory (`Documents\MuseScore4\Plugins` on Windows, `~/Documents/MuseScore4/Plugins` on macOS and Linux). The folder name does not matter.
2. In MuseScore: Plugins → Manage plugins → enable **AI Assistant**, then restart MuseScore.
3. Run Plugins → AI Assistant and enter your API key in Settings, or copy `config.example.json` to `config.json` and edit it.

To update, pull or download again. `config.json`, `logs/`, `bridge/` and your own skills are left untouched.

## Usage

- Select something in the score and type in the chat. Enter sends, Shift+Enter inserts a line break.
- Type `/` to list skills. `/name` runs a skill directly; `/name extra instructions` hands it to the AI.
- The buttons next to the chat run skills without the model.
- **Summary** reviews the session and proposes skills, **Compact** condenses the context, **Undo turn** reverts the last changes.

### Bundled skills

| Skill | Button | What it does |
|---|---|---|
| bass-1-3 | Bass 1·3 | Bass note on beats 1 and 3 following the chord symbols (voice 2, E2–D#3) |
| chord-tones-eighths | Chord tones 8ths | Stack every available chord tone on each empty eighth-note slot in voice 2 |
| lyrics-to-tab | Lyrics→TAB | Move lyrics under the linked tablature staff, or back |
| eighth-notes | To 8ths | Turn the selection into eighth notes |
| mute-x | x mute | Change the selection to x noteheads |
| strum-pattern | | Add strum direction marks following a pattern |
| arrange-tools | | Library of arranging helpers used by the skills above |
| musescore-ui-guide | | Manual UI steps for things the plugin API cannot do |

### Writing a skill

```
skills/
  strum-pattern/           folder format (standard Agent Skills layout)
    SKILL.md
    scripts/lib.js         optional library
    scripts/run.js         optional runnable script
  mute-x.md                single-file format (what the plugin itself creates)
```

```yaml
---
name: mute-x
description: "What it does and when to use it"
description_en: "Optional English description"
metadata:
  button: "x 闷音"            # optional: show as a button
  button_en: "x mute"         # optional: English button label
  cmd: "pad-note-8"           # optional: action code dispatched by the button
  requires: "arrange-tools"   # optional: skills whose libraries are loaded first
---
Instructions for the model. Code blocks tagged `js run` and `js lib` hold the runnable script and the library.
```

Scripts run in the same environment as the AI's `run_script` tool: the `h.*` helpers, `curScore` and the rest of the plugin API (see `core/prompt.js`).

## Local bridge

Set `"bridge": true` in `config.json` and click "Reload config.json" in Settings. The plugin then polls `bridge/job.json` every half second, runs the tool call it contains, and writes `bridge/result.json`:

```
python dev/tools/bridge_client.py <plugin dir> ping
python dev/tools/bridge_client.py <plugin dir> run_skill '{"name": "lyrics-to-tab"}'
python dev/tools/bridge_client.py <plugin dir> run_script --code-file script.js
```

Protocol details: [bridge/README.md](bridge/README.md).

## Project layout

```
AIAssistant.qml      UI and MuseScore integration
core/agent.js        DeepSeek client and tool-call loop
core/scoreio.js      Score reading, serialization, h.* helpers, script execution
core/prompt.js       System prompt and tool definitions
core/skills.js       Skill parsing, saving and search
core/session.js      Logs, summaries, compaction
core/docs.js         API index lookup
core/remote.js       MuseScore source fetching, GitHub code search, skill install from URL
core/bridge.js       Local bridge protocol
core/i18n.js         Interface strings (English / Traditional Chinese)
skills/              Bundled and user skills
docs/                API index api-<version>.json (regenerate with dev/tools/build_api_docs.py)
dev/tests/           Test suite: a fake MuseScore plus the real plugin code, run in V8
dev/tools/           bridge_client.py, build_api_docs.py, demo_stash.py
```

## Development

The tests run the plugin's JavaScript against a fake MuseScore in V8 (`pip install mini-racer`); see the header of `dev/tests/run_tests.py` for the arguments. `AGENTS.md` documents the architecture and known pitfalls for contributors and coding agents.

## Known limitations

- The 4.6 plugin API cannot add linked staves, replace instruments, change staff types or key signatures. The assistant explains the manual steps instead.
- Notes added on a tablature staff need string numbers; the helpers do not handle that yet.
- After editing the plugin code, restart MuseScore.
- `config.json` holds your API key. Do not share it.

## License

MIT, see `LICENSE`. Exception: `docs/api-*.json` is extracted from the MuseScore sources and distributed under GPL-3.0. MuseScore itself is not part of this repository.

[中文说明](README.zh.md)
