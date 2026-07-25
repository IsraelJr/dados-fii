from pathlib import Path

path = Path('.tmp/update-handoff-v6-13.py')
text = path.read_text()
old = '  assert.doesNotMatch(text, /Sprint 3\\.7.*formalmente concluída/i);'
new = '  assert.doesNotMatch(text, /A Sprint 3\\.7 está formalmente concluída/i);'
if text.count(old) != 1:
    raise SystemExit(f'Negação antiga divergente: {text.count(old)} ocorrência(s).')
path.write_text(text.replace(old, new, 1))
print('Negação do teste da Sprint 3.7 restringida à afirmação positiva indevida.')
