import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const backup=read('.github/workflows/backup-database.yml');
const restore=read('.github/workflows/restore-backup.yml');
const edge=read('supabase/functions/rainbows-backups/index.ts');
const config=read('supabase/config.toml');
const app=read('app.js');

test('el backup diario usa la CLI oficial y conserva roles, esquema y datos',()=>{
  assert.match(backup,/cron: '30 6 \* \* \*'/);
  assert.match(backup,/supabase\/setup-cli@v1/);
  assert.match(backup,/supabase db dump[^\n]+roles\.sql --role-only/);
  assert.match(backup,/supabase db dump[^\n]+schema\.sql/);
  assert.match(backup,/supabase db dump[^\n]+data\.sql --use-copy --data-only/);
  assert.match(backup,/retention-days: 30/);
});

test('ningún dato legible se sube al repositorio público',()=>{
  assert.match(backup,/gpg --batch[\s\S]+--symmetric --cipher-algo AES256/);
  assert.match(backup,/rm -rf backup "\$archive"/);
  assert.match(backup,/path: \$\{\{ steps\.encrypted\.outputs\.file \}\}/);
  assert.doesNotMatch(backup,/git-auto-commit|git push|contents:\s*write/);
});

test('restaurar bloquea producción y exige un proyecto vacío',()=>{
  assert.match(restore,/test "\$CONFIRMATION" = 'RESTAURAR'/);
  assert.match(restore,/test "\$RECOVERY_PROJECT_REF" != "\$PRODUCTION_PROJECT_REF"/);
  assert.match(restore,/\*"\$PRODUCTION_PROJECT_REF"\*\) echo 'Bloqueado/);
  assert.match(restore,/to_regclass\('public\.perfiles'\) is null/);
  assert.match(restore,/--single-transaction/);
  assert.match(restore,/--variable ON_ERROR_STOP=1/);
});

test('la función valida sesión y rol antes de controlar GitHub Actions',()=>{
  assert.match(edge,/auth\.getUser\(token\)/);
  assert.match(edge,/from\('perfiles'\)/);
  assert.match(edge,/profile\.rol\?\.trim\(\)\.toLowerCase\(\) !== 'administrador'/);
  for(const action of ["action === 'list'","action === 'create'","action === 'download'","action === 'restore'"]){
    assert.match(edge,new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(config,/\[functions\.rainbows-backups\]\s+verify_jwt = false/);
});

test('Config informa cifrado, retención y restauración aislada',()=>{
  assert.match(app,/cifrado antes de salir de Supabase y conservado durante 30 días/);
  assert.match(app,/sólo puede apuntar al proyecto vacío de recuperación/);
  assert.match(app,/timeZone:'America\/Argentina\/Buenos_Aires'/);
});
