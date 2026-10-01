#!/usr/bin/env python3
"""Install agent plugins from their original repositories and Pi packages."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
HOME_DIR = Path.home()
sources = json.loads((ROOT / 'sources.json').read_text())
failures = []
# Public sources use the personal SSH alias. Work HTTPS uses gh's saved OAuth
# login because a newly added work SSH key may still need organization SSO.
environment = dict(os.environ)
environment.update({
    'GIT_CONFIG_COUNT': '3',
    'GIT_CONFIG_KEY_0': 'url.git@github-personal:.insteadOf',
    'GIT_CONFIG_VALUE_0': 'https://github.com/',
    'GIT_CONFIG_KEY_1': 'url.https://github.com/causalsecurity/.insteadOf',
    'GIT_CONFIG_VALUE_1': 'https://github.com/causalsecurity/',
    'GIT_CONFIG_KEY_2': 'credential.https://github.com.helper',
    'GIT_CONFIG_VALUE_2': '!gh auth git-credential',
    'GIT_TERMINAL_PROMPT': '0',
})


def run(arguments):
    print('Installing:', ' '.join(arguments), flush=True)
    try:
        selected_environment = dict(environment)
        if any('causalsecurity' in argument for argument in arguments) and shutil.which('gh'):
            selected_environment['GH_TOKEN'] = subprocess.check_output(
                ['gh', 'auth', 'token', '--hostname', 'github.com', '--user', 'causalsarthak'],
                text=True, env=environment, timeout=30,
            ).strip()
        subprocess.run(arguments, env=selected_environment, check=True, timeout=180)
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        failures.append(' '.join(arguments))
        print('Could not complete:', error, file=sys.stderr)
        return False


def installed(path):
    return json.loads(path.read_text()) if path.exists() else {}


if shutil.which('claude'):
    known = installed(HOME_DIR / '.claude/plugins/known_marketplaces.json')
    declared = installed(ROOT / 'claude/settings.json')['extraKnownMarketplaces']
    required = {plugin.split('@')[-1] for plugin in sources['claude_plugins']}
    unavailable = set()
    for name in sorted(required):
        if name not in known:
            # Preserve the GitHub source kind declared in Claude's settings.
            if not run(['claude', 'plugin', 'marketplace', 'add', declared[name]['source']['repo']]):
                unavailable.add(name)
    existing = installed(HOME_DIR / '.claude/plugins/installed_plugins.json').get('plugins', {})
    for plugin in sources['claude_plugins']:
        if plugin not in existing and plugin.split('@')[-1] not in unavailable:
            run(['claude', 'plugin', 'install', plugin, '--scope', 'user'])
else:
    failures.append('Claude CLI is missing; install Claude Code first.')

if shutil.which('codex'):
    # Read config locally; listing remote marketplace catalogs is unnecessary here.
    import tomllib
    path = HOME_DIR / '.codex/config.toml'
    config = tomllib.loads(path.read_text()) if path.exists() else {}
    known = config.get('marketplaces', {})
    for name in sorted({plugin.split('@')[-1] for plugin in sources['codex_plugins']}):
        if name not in known:
            run(['codex', 'plugin', 'marketplace', 'add', sources['marketplaces'][name]])
    for plugin in sources['codex_plugins']:
        if not config.get('plugins', {}).get(plugin, {}).get('enabled'):
            run(['codex', 'plugin', 'add', plugin])
else:
    failures.append('Codex CLI is missing; install Codex first.')

extensions = HOME_DIR / '.local/share/dotfiles/pi-extensions'
if not extensions.exists():
    extensions.parent.mkdir(parents=True, exist_ok=True)
    run(['git', 'clone', sources['pi_extensions_source'], str(extensions)])
if extensions.exists():
    for name in ['d2-renderer', 'gh-stack-status']:
        target = HOME_DIR / '.pi/agent/extensions' / name
        source = extensions / name
        if source.exists() and not target.exists() and not target.is_symlink():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.symlink_to(source)

if shutil.which('pi'):
    preferences = json.loads((ROOT / 'pi/settings.json').read_text())
    for package in preferences.get('packages', []):
        run(['pi', 'install', package])
else:
    failures.append('Pi CLI is missing; install @earendil-works/pi-coding-agent first.')

if failures:
    print('\nIncomplete setup steps:', *failures, sep='\n', file=sys.stderr)
    raise SystemExit(1)
print('Claude/Codex plugins and Pi packages installed from their original sources.')
