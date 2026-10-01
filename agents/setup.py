#!/usr/bin/env python3
"""Install agent plugins from their original repositories and Pi packages."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
HOME_DIR = Path.home()
sources = json.loads((ROOT / 'sources.json').read_text())
failures = []


def package_ready(package, home):
    if package.startswith('npm:'):
        specification = package[4:]
        name, separator, version = specification.rpartition('@')
        if not separator or not name:
            name, version = specification, ''
        manifest = home / '.pi/agent/npm/node_modules' / name / 'package.json'
        if not manifest.exists():
            return False
        metadata = json.loads(manifest.read_text())
        return metadata.get('name') == name and (not version or metadata.get('version') == version)
    if package.startswith('git:github.com/'):
        return (home / '.pi/agent/git' / package[4:] / '.git').exists()
    return False


if sys.argv[1:] == ['--check']:
    with tempfile.TemporaryDirectory() as directory:
        home = Path(directory)
        manifest = home / '.pi/agent/npm/node_modules/@scope/example/package.json'
        manifest.parent.mkdir(parents=True)
        manifest.write_text('{"name":"@scope/example","version":"1.2.3"}')
        assert package_ready('npm:@scope/example', home)
        assert package_ready('npm:@scope/example@1.2.3', home)
        assert not package_ready('npm:@scope/example@2.0.0', home)
        assert not package_ready('npm:missing', home)
    print('PASS: installed package detection respects scoped names and pinned versions.')
    raise SystemExit(0)
elif sys.argv[1:]:
    raise SystemExit('Usage: setup.py [--check]')
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


def legacy_marketplace(tool):
    legacy = sources['legacy_armory']
    root = HOME_DIR / '.local/share/dotfiles/causalsecurity-legacy'
    catalog = root / '.claude-plugin/marketplace.json'
    if not catalog.exists():
        root.parent.mkdir(parents=True, exist_ok=True)
        if not root.exists() and not run(['git', 'clone', '--depth', '1', '--no-checkout', sources['marketplaces']['causalsecurity'], str(root)]):
            return False
        if not run(['git', '-C', str(root), 'fetch', '--depth', '1', 'origin', legacy['revision']]):
            return False
        if not run(['git', '-C', str(root), 'checkout', '--detach', legacy['revision']]):
            return False
    data = installed(catalog)
    data['name'] = 'causalsecurity-legacy'
    data['plugins'] = [plugin for plugin in data['plugins'] if plugin['name'] == legacy['plugin']]
    if not data['plugins']:
        failures.append('Pinned Armory revision did not contain the legacy plugin.')
        return False
    catalog.write_text(json.dumps(data, indent=2) + '\n')
    return run([tool, 'plugin', 'marketplace', 'add', str(root)])


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
            if plugin.split('@')[0] == sources['legacy_armory']['plugin']:
                replacement = sources['legacy_armory']['plugin'] + '@causalsecurity-legacy'
                if replacement not in existing and legacy_marketplace('claude'):
                    run(['claude', 'plugin', 'install', replacement, '--scope', 'user'])
            else:
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
        name, marketplace = plugin.split('@')
        cache = HOME_DIR / '.codex/plugins/cache' / marketplace / name
        if name == sources['legacy_armory']['plugin'] and not cache.exists():
            plugin = name + '@causalsecurity-legacy'
            marketplace = 'causalsecurity-legacy'
            cache = HOME_DIR / '.codex/plugins/cache' / marketplace / name
            if not cache.exists() and not legacy_marketplace('codex'):
                continue
        if not config.get('plugins', {}).get(plugin, {}).get('enabled') or not cache.exists():
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
        if not package_ready(package, HOME_DIR):
            run(['pi', 'install', package])
else:
    failures.append('Pi CLI is missing; install @earendil-works/pi-coding-agent first.')

if failures:
    print('\nIncomplete setup steps:', *failures, sep='\n', file=sys.stderr)
    raise SystemExit(1)
subprocess.run([sys.executable, str(ROOT / 'install.py')], check=True)
print('Claude/Codex plugins and Pi packages installed from their original sources.')
