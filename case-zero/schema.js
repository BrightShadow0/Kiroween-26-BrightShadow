/**
 * schema.js — Specter Engine content file validator.
 *
 * Validates a parsed game JSON object against the engine's supported feature
 * set. Returns { valid: true } or { valid: false, errors: string[] }.
 *
 * This module has zero game-specific knowledge; it only describes the shape
 * the engine understands.
 */

const SUPPORTED_CONDITION_TYPES = ['hasItem', 'solvedPuzzle', 'flag', 'hasDeduction', 'allOf', 'anyOf', 'not'];
const SUPPORTED_ACTION_TYPES    = ['pickup', 'examine', 'use', 'combine', 'move', 'trigger', 'accuse', 'link'];
const SUPPORTED_EFFECT_TYPES    = ['setFlag', 'giveItem', 'removeItem', 'solveRoom', 'triggerEnding', 'resetRooms', 'addDeduction'];
const KNOWN_THEMES = ['temple', 'noir', 'default'];
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
  if (cond.type === 'allOf' || cond.type === 'anyOf') {
    if (!Array.isArray(cond.conditions) || cond.conditions.length === 0) {
      errors.push(err(path, `condition type "${cond.type}" requires a non-empty "conditions" array`));
    } else {
      cond.conditions.forEach(function (c, i) {
        errors.push(...validateCondition(c, path + '.conditions[' + i + ']'));
      });
    }
  }
  if (cond.type === 'not') {
    if (!cond.condition) {
      errors.push(err(path, 'condition type "not" requires a nested "condition"'));
    } else {
      errors.push(...validateCondition(cond.condition, path + '.condition'));
    }
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

function validateDeduction(ded, idx) {
  const errors = [];
  const path   = `deductions[${idx}]`;
  if (!ded.id)   errors.push(err(path, 'deduction missing required field "id"'));
  if (!ded.text) errors.push(err(path, 'deduction missing required field "text"'));
  if (!Array.isArray(ded.sources) || ded.sources.length === 0) {
    errors.push(err(path + '.sources', 'deduction requires a non-empty "sources" array of clue ids'));
  }
  if (ded.effects && Array.isArray(ded.effects)) {
    ded.effects.forEach((e, i) => errors.push(...validateEffect(e, `${path}.effects[${i}]`)));
  }
  return errors;
}

function validateSuspect(suspect, idx) {
  const errors = [];
  const path   = `suspects[${idx}]`;
  if (!suspect.id)       errors.push(err(path, 'suspect missing required field "id"'));
  if (!suspect.name)     errors.push(err(path, 'suspect missing required field "name"'));
  if (!suspect.endingId) errors.push(err(path, 'suspect missing required field "endingId"'));
  if (suspect.requiresDeductions && !Array.isArray(suspect.requiresDeductions)) {
    errors.push(err(path + '.requiresDeductions', 'must be an array of deduction ids'));
  }
  return errors;
}

/**
 * Second pass: every id that refers to another part of the content file must
 * resolve. Shape validation alone lets broken links through to runtime.
 */
function validateReferences(gameData) {
  const errors = [];
  const roomIds      = new Set((gameData.rooms    || []).map(r => r.id).filter(Boolean));
  const itemIds      = new Set((gameData.items    || []).map(i => i.id).filter(Boolean));
  const eventIds     = new Set((gameData.events   || []).map(e => e.id).filter(Boolean));
  const endingIds    = new Set((gameData.endings  || []).map(e => e.id).filter(Boolean));
  const deductionIds = new Set((gameData.deductions || []).map(d => d.id).filter(Boolean));
  const clueIds      = new Set((gameData.clues    || []).map(c => c.id).filter(Boolean));
  // solvedPuzzle / solveRoom accept event ids or room ids
  const puzzleIds    = new Set([...eventIds, ...roomIds]);
  // deduction sources reference clues, which are also inventory items
  const evidenceIds  = new Set([...clueIds, ...itemIds]);

  function need(set, id, path, what) {
    if (id !== undefined && id !== null && !set.has(id)) {
      errors.push(err(path, `${what} "${id}" does not exist`));
    }
  }

  function checkConditionRefs(cond, path) {
    if (!cond || typeof cond !== 'object') return;
    if (cond.type === 'hasItem')       need(itemIds, cond.id, path, 'condition refers to item');
    if (cond.type === 'solvedPuzzle')  need(puzzleIds, cond.id, path, 'condition refers to puzzle/event/room');
    if (cond.type === 'hasDeduction')  need(deductionIds, cond.id, path, 'condition refers to deduction');
    (cond.conditions || []).forEach((c, i) => checkConditionRefs(c, `${path}.conditions[${i}]`));
    if (cond.condition) checkConditionRefs(cond.condition, path + '.condition');
  }

  function checkEffectRefs(eff, path) {
    if (!eff || typeof eff !== 'object') return;
    if (eff.type === 'giveItem' || eff.type === 'removeItem') need(itemIds, eff.itemId, path, 'effect refers to item');
    if (eff.type === 'triggerEnding')  need(endingIds, eff.endingId, path, 'effect refers to ending');
    if (eff.type === 'addDeduction')   need(deductionIds, eff.deductionId, path, 'effect refers to deduction');
    if (eff.type === 'solveRoom')      need(puzzleIds, eff.puzzleId || eff.roomId, path, 'effect refers to puzzle/room');
  }

  function checkActionRefs(action, path) {
    if (!action) return;
    if (action.condition) checkConditionRefs(action.condition, path + '.condition');
    (action.effects || []).forEach((e, i) => checkEffectRefs(e, `${path}.effects[${i}]`));
  }

  if (gameData.meta) {
    need(roomIds, gameData.meta.startRoom, 'meta.startRoom', 'start room');
    (gameData.meta.onTimerEnd || []).forEach((e, i) => checkEffectRefs(e, `meta.onTimerEnd[${i}]`));
  }

  (gameData.rooms || []).forEach((room, ri) => {
    const rp = `rooms[${ri}]`;
    (room.exits  || []).forEach(id => need(roomIds, id, rp + '.exits', 'exit leads to room'));
    (room.items  || []).forEach(id => need(itemIds, id, rp + '.items', 'room lists item'));
    (room.events || []).forEach(id => need(eventIds, id, rp + '.events', 'room lists event'));
    if (room.unlockCondition) checkConditionRefs(room.unlockCondition, rp + '.unlockCondition');
    (room.actions || []).forEach((a, ai) => checkActionRefs(a, `${rp}.actions[${ai}]`));
  });

  (gameData.items || []).forEach((item, ii) => {
    const ip = `items[${ii}]`;
    if (item.combinesWith && typeof item.combinesWith === 'object') {
      for (const [otherId, rule] of Object.entries(item.combinesWith)) {
        need(itemIds, otherId, `${ip}.combinesWith`, 'combines with item');
        if (rule && typeof rule === 'object') {
          need(itemIds, rule.result, `${ip}.combinesWith["${otherId}"].result`, 'combine result item');
          (rule.effects || []).forEach((e, i) => checkEffectRefs(e, `${ip}.combinesWith["${otherId}"].effects[${i}]`));
        }
      }
    }
    (item.onPickup   || []).forEach((e, i) => checkEffectRefs(e, `${ip}.onPickup[${i}]`));
    (item.useEffects || []).forEach((e, i) => checkEffectRefs(e, `${ip}.useEffects[${i}]`));
  });

  (gameData.events || []).forEach((event, ei) => {
    (event.steps || []).forEach((step, si) => {
      const sp = `events[${ei}].steps[${si}]`;
      if (step.action) checkActionRefs(step.action, sp + '.action');
      (step.effects || []).forEach((e, i) => checkEffectRefs(e, `${sp}.effects[${i}]`));
    });
    (event.onComplete || []).forEach((e, i) => checkEffectRefs(e, `events[${ei}].onComplete[${i}]`));
  });

  (gameData.hints || []).forEach((hint, hi) => {
    need(puzzleIds, hint.forPuzzle, `hints[${hi}].forPuzzle`, 'hint refers to puzzle/event/room');
  });

  (gameData.deductions || []).forEach((ded, di) => {
    (ded.sources || []).forEach(id => need(evidenceIds, id, `deductions[${di}].sources`, 'deduction source clue'));
  });

  (gameData.suspects || []).forEach((suspect, si) => {
    const sp = `suspects[${si}]`;
    need(endingIds, suspect.endingId, sp + '.endingId', 'suspect leads to ending');
    (suspect.requiresDeductions || []).forEach(id => need(deductionIds, id, sp + '.requiresDeductions', 'required deduction'));
  });

  return errors;
}

/**
 * Validate a parsed game content object.
 * @param {object} gameData
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateGameContent(gameData) {
  const errors   = [];
  const warnings = [];

  if (!gameData || typeof gameData !== 'object') {
    return { valid: false, errors: ['root must be a JSON object'], warnings };
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

  if (gameData.deductions) {
    if (!Array.isArray(gameData.deductions)) {
      errors.push('[deductions] must be an array');
    } else {
      gameData.deductions.forEach((d, i) => errors.push(...validateDeduction(d, i)));
    }
  }

  if (gameData.suspects) {
    if (!Array.isArray(gameData.suspects)) {
      errors.push('[suspects] must be an array');
    } else {
      gameData.suspects.forEach((s, i) => errors.push(...validateSuspect(s, i)));
    }
  }

  if (gameData.endings) {
    if (!Array.isArray(gameData.endings)) {
      errors.push('[endings] must be an array');
    } else {
      gameData.endings.forEach((en, i) => errors.push(...validateEnding(en, i)));
    }
  }

  // Warnings: playable, but likely not what the author meant
  if (gameData.meta && gameData.meta.theme && !KNOWN_THEMES.includes(gameData.meta.theme)) {
    warnings.push(`[meta.theme] unknown theme "${gameData.meta.theme}"; known: ${KNOWN_THEMES.join(', ')} (falls back to default art and styling)`);
  }
  if (gameData.meta && !gameData.meta.timed) {
    const timedOnly = [];
    if (gameData.meta.combineFailPenaltySeconds) timedOnly.push('meta.combineFailPenaltySeconds');
    if (gameData.meta.onTimerEnd) timedOnly.push('meta.onTimerEnd');
    (gameData.events || []).forEach((ev, ei) => (ev.steps || []).forEach((st, si) => {
      if (st.action && st.action.penaltySeconds) timedOnly.push(`events[${ei}].steps[${si}].action.penaltySeconds`);
    }));
    (gameData.rooms || []).forEach((r, ri) => (r.actions || []).forEach((a, ai) => {
      if (a.penaltySeconds) timedOnly.push(`rooms[${ri}].actions[${ai}].penaltySeconds`);
    }));
    if (timedOnly.length > 0) {
      warnings.push('[meta.timed] game is untimed; these fields only work in timed games and are ignored: ' + timedOnly.join(', '));
    }
  }

  errors.push(...validateReferences(gameData));

  return { valid: errors.length === 0, errors, warnings };
}

// Export for both browser (global) and Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateGameContent, SUPPORTED_CONDITION_TYPES, SUPPORTED_ACTION_TYPES, SUPPORTED_EFFECT_TYPES };
} else {
  window.SpecterSchema = { validateGameContent, SUPPORTED_CONDITION_TYPES, SUPPORTED_ACTION_TYPES, SUPPORTED_EFFECT_TYPES };
}
