#!/usr/bin/env python3
"""Link reusable agent files; merge preferences without copying login data."""
import copy
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent


def merge(local, shared):
    result = copy.deepcopy(local)
    for key, value in shared.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        elif isinstance(value, list) and isinstance(result.get(key), list):
            if value and all(isinstance(item, dict) and 'matcher' in item and 'hooks' in item for item in value):
                groups = {item['matcher']: item for item in result[key]}
                for item in value:
                    groups[item['matcher']] = merge(groups.get(item['matcher'], {}), item)
                result[key] = list(groups.values())
            elif value and all(isinstance(item, dict) and item.get('type') == 'command' for item in value):
                def identity(item):
                    matches = re.findall(r'/([\w.-]+)(?:[\x27\x22]|$)', item.get('command', ''))
                    return matches[-1] if matches else item.get('command')
                identities = {identity(item) for item in value}
                result[key] = value + [item for item in result[key] if identity(item) not in identities]
            else:
                result[key] = value + [item for item in result[key] if item not in value]
        else:
            result[key] = copy.deepcopy(value)
    return result


def install(home):
    backup = home / '.local/state/dotfiles/backups' / (time.strftime('%Y%m%d-%H%M%S') + '-agents-' + str(os.getpid()))

    def preserve(target):
        destination = backup / target.relative_to(home)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if target.is_symlink():
            destination.symlink_to(os.readlink(target))
        elif target.is_dir():
            shutil.copytree(target, destination, symlinks=True)
        else:
            shutil.copy2(target, destination)

    def link(source, target):
        if target.is_symlink() and target.resolve() == source.resolve():
            return
        if target.exists() or target.is_symlink():
            preserve(target)
            if target.is_dir() and not target.is_symlink():
                shutil.rmtree(target)
            else:
                target.unlink()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(source)

    def write(target, content):
        if target.exists() and target.read_text() == content:
            return
        if target.exists() or target.is_symlink():
            preserve(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        # Replace the file itself so a pre-existing symlink cannot modify a source checkout.
        with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, delete=False) as stream:
            stream.write(content)
            temporary = Path(stream.name)
        temporary.chmod(0o600)
        os.replace(temporary, target)

    def settings(source, target):
        existing = json.loads(target.read_text()) if target.exists() else {}
        shared = json.loads(source.read_text())
        write(target, json.dumps(merge(existing, shared), indent=2) + '\n')

    for skill in sorted((ROOT / 'skills').iterdir()):
        if not (skill / 'SKILL.md').exists():
            continue
        for directory in ['.agents/skills', '.claude/skills', '.pi/agent/skills']:
            link(skill, home / directory / skill.name)
    if (home / '.codex/skills/scip').exists():
        link(ROOT / 'skills/scip', home / '.codex/skills/scip')

    for tool in ['claude', 'codex']:
        for source in (ROOT / tool / 'hooks').iterdir():
            link(source, home / ('.' + tool) / 'hooks' / source.name)
    for source in (ROOT / 'claude/output-styles').iterdir():
        link(source, home / '.claude/output-styles' / source.name)
    for source, target in [
        ('claude/CLAUDE.md', '.claude/CLAUDE.md'),
        ('claude/statusline-command.sh', '.claude/statusline-command.sh'),
        ('codex/AGENTS.md', '.codex/AGENTS.md'),
        ('pi/APPEND_SYSTEM.md', '.pi/agent/APPEND_SYSTEM.md'),
        ('pi/extensions/prefer-fff.ts', '.pi/agent/extensions/prefer-fff.ts'),
    ]:
        link(ROOT / source, home / target)
    settings(ROOT / 'claude/settings.json', home / '.claude/settings.json')
    settings(ROOT / 'codex/hooks.json', home / '.codex/hooks.json')
    settings(ROOT / 'pi/settings.json', home / '.pi/agent/settings.json')

    target = home / '.codex/config.toml'
    if not target.exists():
        write(target, (ROOT / 'codex/config.toml').read_text())
    else:
        content = target.read_text()
        shared = (ROOT / 'codex/config.toml').read_text().split('\n[')[0]
        header, separator, tables = content.partition('\n[')
        for line in shared.splitlines():
            key = line.split('=', 1)[0].strip()
            if not key:
                continue
            pattern = r'(?m)^' + re.escape(key) + r'\s*=.*$'
            if re.search(pattern, header):
                header = re.sub(pattern, line, header)
            else:
                header += '\n' + line
        write(target, header + separator + tables)
    link(ROOT / 'setup.py', home / '.local/bin/dotfiles-ai-setup')
    print('Agent settings and skills installed; logins and local runtime files preserved.')


def check():
    hooks = merge({'PreToolUse': [{'matcher': 'Bash', 'hooks': [
        {'type': 'command', 'command': "'/Users/test/.claude/hooks/no-poll-loop.sh'"},
        {'type': 'command', 'command': '/private/work-hook.sh'},
    ]}]}, {'PreToolUse': [{'matcher': 'Bash', 'hooks': [
        {'type': 'command', 'command': 'bash "$HOME/.claude/hooks/no-poll-loop.sh"'},
    ]}]})
    assert len(hooks['PreToolUse']) == 1
    assert len(hooks['PreToolUse'][0]['hooks']) == 2
    assert hooks['PreToolUse'][0]['hooks'][1]['command'] == '/private/work-hook.sh'
    with tempfile.TemporaryDirectory() as directory:
        home = Path(directory)
        target = home / '.pi/agent/settings.json'
        target.parent.mkdir(parents=True)
        target.write_text('{"deviceId":"local-device","packages":["npm:local-extra"]}')
        auth = target.parent / 'auth.json'
        auth.write_text('private fixture')
        skill = home / '.claude/skills/browse-x'
        skill.mkdir(parents=True)
        (skill / 'SKILL.md').write_text('existing skill')
        install(home)
        prefs = json.loads(target.read_text())
        assert prefs['deviceId'] == 'local-device' and 'npm:local-extra' in prefs['packages']
        assert auth.read_text() == 'private fixture'
        assert skill.is_symlink()
        assert any(p.read_text() == 'existing skill' for p in (home / '.local/state/dotfiles/backups').rglob('SKILL.md'))
        before = sorted(str(p) for p in (home / '.local/state/dotfiles/backups').rglob('*'))
        install(home)
        assert before == sorted(str(p) for p in (home / '.local/state/dotfiles/backups').rglob('*'))
    print('PASS: originals backed up, local credentials/settings preserved, repeat install unchanged.')


if __name__ == '__main__':
    if sys.argv[1:] == ['--check']:
        check()
    elif sys.argv[1:]:
        raise SystemExit('Usage: install.py [--check]')
    else:
        install(Path.home())
