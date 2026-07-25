from pathlib import Path

path = Path('.tmp/update-handoff-v6-12.py')
text = path.read_text()
old = "test = once(test, 'ef0c621f2f813009fdb3999b721e4f4a6568c134', 'bfdc186057652a535025d19beae061856624d5c1', 'teste base')"
new = "test = once(test, 'assert.match(text, /\\\\*\\\\*Base funcional auditada:\\\\*\\\\* `ef0c621f2f813009fdb3999b721e4f4a6568c134`/);', 'assert.match(text, /\\\\*\\\\*Base funcional auditada:\\\\*\\\\* `bfdc186057652a535025d19beae061856624d5c1`/);', 'teste base')"
if text.count(old) != 1:
    raise SystemExit(f'Linha ambígua não encontrada de forma única: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
