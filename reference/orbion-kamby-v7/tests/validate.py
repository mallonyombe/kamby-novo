from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]
reg=json.loads((root/'orchestration/registry.json').read_text())
ids=[a['id'] for a in reg['agents']]
assert len(ids)==30 and len(set(ids))==30, 'IDs duplicados ou agentes ausentes'
for a in reg['agents']:
    p=root/a['prompt']
    assert p.is_file() and p.stat().st_size>300, f'Prompt ausente/curto: {p}'
    assert a['write_access'] is False, f'Permissão insegura: {a["id"]}'
for name in ['SECURITY.md','OWNERSHIP.md','QUALITY-GATES.md','ENGINEERING-STANDARDS.md']:
    assert (root/'governance'/name).is_file()
task=json.loads((root/'examples/sample-task.json').read_text())
assert re.fullmatch(r'ORB-[0-9]{4,}',task['task_id'])
assert task['owner'] in ids and all(x in ids for x in task['reviewers'])
assert not task['permissions']['deploy'] and not task['permissions']['destructive']
assert task['acceptance_criteria']
print('PASS: 30 agentes únicos, prompts presentes, permissões read-only, governança e tarefa simulada válidas')

brand=json.loads((root/'examples/kamby-brand-task.json').read_text())
assert brand['owner'] in ids and all(r in ids for r in brand['reviewers'])
assert not brand['permissions']['write'] and not brand['permissions']['deploy']
assert (root/'governance/KAMBY-BRAND-STANDARDS.md').is_file()
print('PASS: 10 agentes de marca, brief Kamby e limites de permissões')
