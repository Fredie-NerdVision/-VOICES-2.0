const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const propertyValues = { VOICES_DATABASE_ID: 'DB-1' };
const properties = {
  getProperty(name) {
    return propertyValues[name] || '';
  },
  setProperty(name, value) {
    propertyValues[name] = String(value);
  },
  setProperties(values) {
    Object.keys(values).forEach(name => {
      propertyValues[name] = String(values[name]);
    });
  }
};
const files = {};
let nextFileId = 1;
const folder = {
  getId() {
    return 'FOLDER-1';
  },
  createFile(name, content) {
    const id = 'FILE-' + nextFileId++;
    const file = {
      content,
      getId() {
        return id;
      },
      setContent(value) {
        this.content = value;
      },
      getBlob() {
        return {
          getDataAsString: () => this.content
        };
      }
    };
    files[id] = file;
    return file;
  }
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
  uuid_: () => 'UUID-' + nextFileId++,
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
  DriveApp: {
    getFileById(id) {
      if (!files[id]) throw new Error('File not found.');
      return files[id];
    },
    getFolderById() {
      return folder;
    },
    getFoldersByName() {
      return {
        hasNext() {
          return false;
        }
      };
    },
    createFolder() {
      return folder;
    }
  },
  LockService: {
    getScriptLock() {
      return {
        tryLock() {
          return true;
        },
        releaseLock() {}
      };
    }
  },
  MimeType: { PLAIN_TEXT: 'text/plain' },
  Utilities: {
    computeDigest(algorithm, value) {
      return Array.from(crypto.createHash('sha256').update(String(value)).digest())
        .map(byte => byte > 127 ? byte - 256 : byte);
    },
    getUuid() {
      return 'UUID-' + nextFileId++;
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

let producerCalls = 0;
const produce = () => {
  producerCalls += 1;
  return { value: producerCalls };
};
const first = context.cachedResponse_('schedule-builder', ['owner', '2026-09-07'], produce);
const second = context.cachedResponse_('schedule-builder', ['owner', '2026-09-07'], produce);
context.invalidateAppDataCache_('general');
const afterGeneralWrite = context.cachedResponse_(
  'schedule-builder',
  ['owner', '2026-09-07'],
  produce
);
context.invalidateAppDataCache_('schedule');
const afterScheduleWrite = context.cachedResponse_(
  'schedule-builder',
  ['owner', '2026-09-07'],
  produce
);

if (producerCalls !== 2 ||
    first.value !== 1 ||
    second.value !== 1 ||
    afterGeneralWrite.value !== 1 ||
    afterScheduleWrite.value !== 2) {
  throw new Error('Persistent read-model caching or scoped invalidation regressed.');
}

console.log('Empty rows and persistent read-model caches passed.');
