"""Exercise the real import pipeline on reviewed fields without changing output."""
import importlib.util
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def load(name):
    spec=importlib.util.spec_from_file_location(name, ROOT/'node/zh-tw'/f'import-adventure-{name}.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
modules={name:load(name) for name in ['cos','tyranny','wdh','vecna','oota']}
review=json.loads((ROOT/'translation/zh-TW/adventures/reviewed-contextual-semantics.json').read_text())
groups={'cos':'cos','hotdq':'tyranny','rot':'tyranny','wdh':'wdh','veor':'vecna','oota':'oota'}
classes={'tyranny':'TyrannyLocalizer','wdh':'WaterdeepLocalizer','vecna':'VecnaLocalizer','oota':'OotaLocalizer'}
site=modules['cos'].get_site_names()
sources={b:json.loads((ROOT/f'data/zh-TW/adventures/adventure-{b}.json').read_text()) for b in groups}
errors=[]
for book,group in groups.items():
    m=modules[group]
    localizer=m.CosLocalizer(sources[book]) if group=='cos' else getattr(m,classes[group])(sources,book,site,directory=ROOT/f'translation/zh-TW/adventures/{group}')
    for r in review['corrections']:
        if r['book']!=book:continue
        actual=localizer.localize_string(r['english'],r['before'],r['path'])
        if actual!=r['zh_tw']:
            errors.append({'book':book,'path':r['path'],'expected':r['zh_tw'],'actual':actual})
    print(book, 'reviewed import fields checked', flush=True)
print(json.dumps(errors,ensure_ascii=False,indent=2))
assert not errors, f'{len(errors)} reviewed overrides were changed by import cleanup'
