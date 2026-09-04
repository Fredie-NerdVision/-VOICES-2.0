const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'Index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = {
  console,
  document: {
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; }
  },
  window: { addEventListener() {} }
};

vm.createContext(context);
vm.runInContext(script, context);

const result = vm.runInContext(`
(async () => {
  state.scheduleData = {
    aides: [{ email: 'aide@example.org', displayName: 'Test Aide' }]
  };
  const fields = {
    classId: { dataset: { field: 'classId' }, value: 'CLASS_1' },
    studentId: { dataset: { field: 'studentId' }, value: 'STUDENT_1' },
    duty: { dataset: { field: 'duty' }, value: 'Support' },
    note: { dataset: { field: 'note' }, value: 'Existing note' }
  };
  const targetCell = {
    dataset: { aideEmail: 'aide@example.org' },
    querySelectorAll() { return Object.values(fields); }
  };
  const otherField = { dataset: { field: 'duty' }, value: 'Support' };
  const otherCell = {
    dataset: { aideEmail: 'other@example.org' },
    querySelectorAll() { return [otherField]; }
  };
  document.querySelectorAll = () => [targetCell, otherCell];
  let changed = false;
  let notice = '';
  scheduleDraftChanged = () => { changed = true; };
  toast = message => { notice = message; };
  confirmDialog = async () => true;
  await markScheduleAideOff_('aide@example.org');
  if (!changed) throw new Error('The schedule draft was not updated.');
  if (fields.classId.value || fields.studentId.value || fields.note.value) {
    throw new Error('Existing assignments were not cleared.');
  }
  if (fields.duty.value !== 'OFF') throw new Error('The duty was not set to OFF.');
  if (otherField.value !== 'Support') throw new Error('Another aide was modified.');
  return { duty: fields.duty.value, notice };
})()
`, context);

result.then(value => {
  console.log('Schedule aide-off behavior passed:', JSON.stringify(value));
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
