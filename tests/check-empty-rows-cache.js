const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(projectRoot, 'Database.gs'), 'utf8');
let reads = 0;
const sheet = {
  getLastRow() {
    return 1;
  },
  getDataRange() {
    return {
      getValues() {
        reads += 1;
        return [['Id', 'GoalId']];
      }
    };
  },
  getRange() {
    return {
      getValues() {
        reads += 1;
        return [];
      }
    };
  }
};
const properties = {
  getProperty(name) {
    return name === 'VOICES_DATABASE_ID' ? 'DB-1' : '';
  },
  setProperty() {}
};
const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Set,
  Map,
  Error,
  VOICES: {
    DATABASE_PROPERTY: 'VOICES_DATABASE_ID',
    RELEASE: '2.3',
    ROLES: { CASE_MANAGER: 'CASE_MANAGER' },
    APP_NAME: 'V.O.I.C.E.S'
  },
  SpreadsheetApp: {
    openById() {
      return {
        getSheetByName() {
          return sheet;
        }
      };
    }
  },
  PropertiesService: {
    getScriptProperties() {
      return properties;
    }
  },
  CacheService: {
    getScriptCache() {
      return {
        get() {
          return null;
        },
        put() {}
      };
    }
  },
  Utilities: {
    computeDigest() {
      return [];
    },
    DigestAlgorithm: { SHA_256: 'SHA_256' }
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'Database.gs' });

context.withRowsCache_(() => {
  context.rows_('GoalPhaseHistory');
  context.rows_('GoalPhaseHistory');
  context.rowsByColumnValues_('GoalPhaseHistory', 'GoalId', ['GOAL-1']);
});

if (reads !== 1) {
  throw new Error('Empty rows were read ' + reads + ' times instead of once.');
}

reads = 0;
context.withRowsCache_(() => {
  context.rowsByColumnValues_('GoalPhaseHistory', 'GoalId', ['GOAL-1']);
  context.rowsByColumnValues_('GoalPhaseHistory', 'GoalId', ['GOAL-2']);
});

if (reads !== 0) {
  throw new Error('Empty indexed rows unexpectedly read cell values.');
}

console.log('Empty rows cache passed.');
