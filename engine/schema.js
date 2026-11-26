/**
 * schema.js — Specter Engine content file validator.
 *
 * Validates a parsed game JSON object against the engine's supported feature
 * set. Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * This module has zero game-specific knowledge; it only describes the shape
 * the engine understands.
 */

const SUPPORTED_CONDITION_TYPES = ['hasItem', 'solvedPuzzle', 'flag', 'hasDeduction'];
const SUPPORTED_ACTION_TYPES    = ['pickup', 'examine', 'use', 'combine', 'move', 'trigger', 'accuse', 'link'];
const SUPPORTED_EFFECT_TYPES    = ['setFlag', 'giveItem', 'removeItem', 'solveRoom', 'triggerEnding', 'resetRooms', 'addDeduction'];
const TOP_LEVEL_KEYS = new Set([
  'meta', 'rooms', 'items', 'clues', 'hints', 'events', 'endings',
  // Detective-game extensions (generic engine features, not game-specific)
  'deductions', 'suspects'
]);

function err(path, msg) {
  return `[${path}] ${msg}`;
}

function validateCondition(cond, path) {
  const errors = [];
  if (cond === null || cond === undefined) return errors; // null = always unlocked
  if (typeof cond !== 'object' || Array.isArray(cond)) {
    errors.push(err(path, 'condition must be an object or null'));
    return errors;
  }
  if (!cond.type) {
    errors.push(err(path, 'condition missing required field "type"'));
    return errors;
  }
  if (!SUPPORTED_CONDITION_TYPES.includes(cond.type)) {
    errors.push(err(path + '.type', `unsupported condition type "${cond.type}"; supported: ${SUPPORTED_CONDITION_TYPES.join(', ')}`));
  }
  if ((cond.type === 'hasItem' || cond.type === 'solvedPuzzle' || cond.type === 'hasDeduction') && !cond.id) {
    errors.push(err(path, `condition type "${cond.type}" requires field "id"`));
  }
  if (cond.type === 'flag' && !cond.name) {
    errors.push(err(path, 'condition type "flag" requires field "name"'));
  }
  return errors;
}

function validateEffect(effect, path) {
  const errors = [];
  if (!effect || typeof effect !== 'object') {
    errors.push(err(path, 'effect must be an object'));
    return errors;
  }
  if (!effect.type) {
    errors.push(err(path, 'effect missing required field "type"'));
    return errors;
  }
  if (!SUPPORTED_EFFECT_TYPES.includes(effect.type)) {
    errors.push(err(path + '.type', `unsupported effect type "${effect.type}"; supported: ${SUPPORTED_EFFECT_TYPES.join(', ')}`));
  }
  if ((effect.type === 'setFlag') && !effect.name) {
    errors.push(err(path, 'effect type "setFlag" requires field "name"'));
  }
  if ((effect.type === 'giveItem' || effect.type === 'removeItem') && !effect.itemId) {
    errors.push(err(path, `effect type "${effect.type}" requires field "itemId"`));
  }
  if (effect.type === 'triggerEnding' && !effect.endingId) {
    errors.push(err(path, 'effect type "triggerEnding" requires field "endingId"'));
  }
  if (effect.type === 'addDeduction' && !effect.deductionId) {
    errors.push(err(path, 'effect type "addDeduction" requires field "deductionId"'));
  }
  return errors;
}

function validateAction(action, path) {
  const errors = [];
  if (!action || typeof action !== 'object') {
    errors.push(err(path, 'action must be an object'));
    return errors;
  }
  if (!action.type) errors.push(err(path, 'action missing required field "type"'));
  if (!action.label) errors.push(err(path, 'action missing required field "label"'));
  if (action.type && !SUPPORTED_ACTION_TYPES.includes(action.type)) {
    errors.push(err(path + '.type', `unsupported action type "${action.type}"; supported: ${SUPPORTED_ACTION_TYPES.join(', ')}`));
  }
  if (action.condition) {
    errors.push(...validateCondition(action.condition, path + '.condition'));
  }
  if (action.effects && Array.isArray(action.effects)) {
    action.effects.forEach((e, i) => errors.push(...validateEffect(e, `${path}.effects[${i}]`)));
  }
  return errors;
}

function validateMeta(meta, path) {
  const errors = [];
  if (!meta || typeof meta !== 'object') {
    errors.push(err(path, 'meta must be an object'));
    return errors;
  }
  if (!meta.title)       errors.push(err(path, 'meta missing required field "title"'));
  if (!meta.description) errors.push(err(path, 'meta missing required field "description"'));
  if (meta.timed !== undefined && typeof meta.timed !== 'boolean') {
    errors.push(err(path + '.timed', 'must be boolean'));
  }
  if (meta.timed && !meta.timeLimitSeconds) {
    errors.push(err(path, 'timed game requires "timeLimitSeconds"'));
  }
  return errors;
}

function validateRoom(room, idx) {
  const errors = [];
  const path   = `rooms[${idx}]`;
  if (!room.id)          errors.push(err(path, 'room missing required field "id"'));
  if (!room.name)        errors.push(err(path, 'room missing required field "name"'));
  if (!room.description) errors.push(err(path, 'room missing required field "description"'));

  if (room.exits && !Array.isArray(room.exits)) {
    errors.push(err(path + '.exits', 'must be an array'));
  }
  if (room.items && !Array.isArray(room.items)) {
    errors.push(err(path + '.items', 'must be an array'));
  }
  if (room.events && !Array.isArray(room.events)) {
    errors.push(err(path + '.events', 'must be an array'));
  }
  if (room.unlockCondition) {
    errors.push(...validateCondition(room.unlockCondition, path + '.unlockCondition'));
  }
  if (room.actions && Array.isArray(room.actions)) {
    room.actions.forEach((a, i) => errors.push(...validateAction(a, `${path}.actions[${i}]`)));
  }
  return errors;
}

function validateItem(item, idx) {
  const errors = [];
  const path   = `items[${idx}]`;
  if (!item.id)   errors.push(err(path, 'item missing required field "id"'));
  if (!item.name) errors.push(err(path, 'item missing required field "name"'));
  // combinesWith and result are optional (items may not be combinable)
  return errors;
}

function validateEvent(event, idx) {
  const errors = [];
  const path   = `events[${idx}]`;
  if (!event.id)    errors.push(err(path, 'event missing required field "id"'));
  if (!event.steps || !Array.isArray(event.steps) || event.steps.length === 0) {
    errors.push(err(path, 'event must have a non-empty "steps" array'));
    return errors;
  }
  event.steps.forEach((step, si) => {
    const sp = `${path}.steps[${si}]`;
    if (!step.id)          errors.push(err(sp, 'step missing "id"'));
    if (!step.description) errors.push(err(sp, 'step missing "description"'));
    if (step.action) errors.push(...validateAction(step.action, sp + '.action'));
    if (step.effects && Array.isArray(step.effects)) {
      step.effects.forEach((e, ei) => errors.push(...validateEffect(e, `${sp}.effects[${ei}]`)));
    }
  });
  return errors;
}

function validateEnding(ending, idx) {
  const errors = [];
  const path   = `endings[${idx}]`;
  if (!ending.id)    errors.push(err(path, 'ending missing required field "id"'));
  if (!ending.title) errors.push(err(path, 'ending missing required field "title"'));
  if (!ending.text)  errors.push(err(path, 'ending missing required field "text"'));
  return errors;
}

function validateHint(hint, idx) {
  const errors = [];
  const path   = `hints[${idx}]`;
  if (!hint.id)        errors.push(err(path, 'hint missing required field "id"'));
  if (!hint.forPuzzle) errors.push(err(path, 'hint missing required field "forPuzzle"'));
  if (!hint.text)      errors.push(err(path, 'hint missing required field "text"'));
  return errors;
}

function validateClue(clue, idx) {
  const errors = [];
  const path   = `clues[${idx}]`;
  if (!clue.id)          errors.push(err(path, 'clue missing required field "id"'));
  if (!clue.description) errors.push(err(path, 'clue missing required field "description"'));
  return errors;
}

/**
 * Validate a parsed game content object.
 * @param {object} gameData
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateGameContent(gameData) {
  const errors = [];

  if (!gameData || typeof gameData !== 'object') {
    return { valid: false, errors: ['root must be a JSON object'] };
  }

  // Check for unrecognised top-level keys
  for (const key of Object.keys(gameData)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      errors.push(`[root] unrecognised top-level key "${key}"; supported: ${[...TOP_LEVEL_KEYS].join(', ')}`);
    }
  }

  errors.push(...validateMeta(gameData.meta, 'meta'));

  if (!Array.isArray(gameData.rooms) || gameData.rooms.length === 0) {
    errors.push('[rooms] must be a non-empty array');
  } else {
    gameData.rooms.forEach((r, i) => errors.push(...validateRoom(r, i)));
  }

  if (gameData.items) {
    if (!Array.isArray(gameData.items)) {
      errors.push('[items] must be an array');
    } else {
      gameData.items.forEach((item, i) => errors.push(...validateItem(item, i)));
    }
  }

  if (gameData.clues) {
    if (!Array.isArray(gameData.clues)) {
      errors.push('[clues] must be an array');
    } else {
      gameData.clues.forEach((c, i) => errors.push(...validateClue(c, i)));
    }
  }

  if (gameData.hints) {
    if (!Array.isArray(gameData.hints)) {
      errors.push('[hints] must be an array');
    } else {
      gameData.hints.forEach((h, i) => errors.push(...validateHint(h, i)));
    }
  }

  if (gameData.events) {
    if (!Array.isArray(gameData.events)) {
      errors.push('[events] must be an array');
    } else {
      gameData.events.forEach((ev, i) => errors.push(...validateEvent(ev, i)));
    }
  }

  if (gameData.endings) {
    if (!Array.isArray(gameData.endings)) {
      errors.push('[endings] must be an array');
    } else {
      gameData.endings.forEach((en, i) => errors.push(...validateEnding(en, i)));
    }
  }

  return { valid: errors.length === 0, errors };
}

// Export for both browser (global) and Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateGameContent, SUPPORTED_CONDITION_TYPES, SUPPORTED_ACTION_TYPES, SUPPORTED_EFFECT_TYPES };
} else {
  window.SpecterSchema = { validateGameContent, SUPPORTED_CONDITION_TYPES, SUPPORTED_ACTION_TYPES, SUPPORTED_EFFECT_TYPES };
}
