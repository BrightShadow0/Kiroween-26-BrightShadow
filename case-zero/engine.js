/**
 * engine.js — Specter Engine state machine.
 *
 * Owns ALL game logic. Content files are pure data; this module interprets them.
 *
 * Public API (methods mutate engine state, then return a plain snapshot for
 * the renderer):
 *
 *   SpecterEngine.load(gameData)         → void
 *   SpecterEngine.getState()             → StateSnapshot
 *   SpecterEngine.performAction(action)  → { ok, message, state }
 *   SpecterEngine.getHint(puzzleId)      → string | null
 *   SpecterEngine.saveState()            → void  (localStorage)
 *   SpecterEngine.loadState()            → boolean
 *   SpecterEngine.resetState()           → void
 *   SpecterEngine.startTimer(onTick, onExpire) → void
 *   SpecterEngine.stopTimer()            → void
 */

(function (global) {
  'use strict';

  // ─── Internal state ───────────────────────────────────────────────────────

  let _gameData   = null;   // the loaded content file (read-only reference)
  let _gameId     = null;   // derived from meta.title, used for localStorage key

  // Mutable runtime state
  let _state = null;
  /*
   * _state shape:
   * {
   *   currentRoomId : string,
   *   inventory     : string[],       // item ids
   *   flags         : { [name]: bool },
   *   solvedPuzzles : string[],       // puzzle/event ids that are "solved"
   *   eventProgress : { [eventId]: number },  // current step index
   *   deductions    : string[],       // deduction ids formed (Case Zero style)
   *   ended         : boolean,
   *   endingId      : string | null,
   *   timerRemaining: number,         // seconds; only meaningful when timed
   *   roomStates    : { [roomId]: { itemsPickedUp: string[] } }
   * }
   */

  let _timerInterval  = null;
  let _onTickCb       = null;
  let _onExpireCb     = null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _freshState() {
    return {
      currentRoomId : _gameData.rooms[0].id,
      inventory     : [],
      flags         : {},
      solvedPuzzles : [],
      eventProgress : {},
      deductions    : [],
      ended         : false,
      endingId      : null,
      timerRemaining: _gameData.meta.timeLimitSeconds || 0,
      roomStates    : {}
    };
  }

  /** Look up an object by id in an array; returns undefined if missing. */
  function _byId(arr, id) {
    return (arr || []).find(x => x.id === id);
  }

  /** Evaluate a condition against current state. null/undefined = always true. */
  function _evalCondition(cond) {
    if (!cond) return true;
    switch (cond.type) {
      case 'hasItem':
        return _state.inventory.includes(cond.id);
      case 'solvedPuzzle':
        return _state.solvedPuzzles.includes(cond.id);
      case 'flag':
        return !!_state.flags[cond.name];
      case 'hasDeduction':
        return _state.deductions.includes(cond.id);
      case 'allOf':
        return Array.isArray(cond.conditions) && cond.conditions.length > 0 &&
               cond.conditions.every(_evalCondition);
      case 'anyOf':
        return Array.isArray(cond.conditions) && cond.conditions.some(_evalCondition);
      case 'not':
        return !!cond.condition && !_evalCondition(cond.condition);
      default:
        console.warn('[SpecterEngine] unknown condition type:', cond.type);
        return false;
    }
  }

  /**
   * Timed games only: subtract seconds from the countdown as a penalty for a
   * wrong or premature action. Returns a short message when a penalty was
   * applied, null otherwise.
   */
  function _applyTimePenalty(seconds) {
    if (!_gameData || !_gameData.meta.timed || !seconds || seconds <= 0) return null;
    if (!_state || _state.ended) return null;
    _state.timerRemaining = Math.max(0, _state.timerRemaining - seconds);
    if (_onTickCb) _onTickCb(_state.timerRemaining);
    return `The curse stirs impatiently… (−${seconds}s)`;
  }

  /** Apply a single effect to _state. Returns a human-readable message or null. */
  function _applyEffect(effect) {
    if (!effect) return null;
    switch (effect.type) {
      case 'setFlag':
        _state.flags[effect.name] = effect.value !== undefined ? effect.value : true;
        return effect.message || null;

      case 'giveItem': {
        const item = _byId(_gameData.items, effect.itemId);
        if (item && !_state.inventory.includes(effect.itemId)) {
          _state.inventory.push(effect.itemId);
          return effect.message || `Obtained: ${item.name}`;
        }
        return effect.message || null;
      }

      case 'removeItem': {
        const idx = _state.inventory.indexOf(effect.itemId);
        if (idx !== -1) _state.inventory.splice(idx, 1);
        return effect.message || null;
      }

      case 'solveRoom':
        if (!_state.solvedPuzzles.includes(effect.puzzleId || effect.roomId)) {
          _state.solvedPuzzles.push(effect.puzzleId || effect.roomId);
        }
        return effect.message || null;

      case 'triggerEnding':
        _state.ended    = true;
        _state.endingId = effect.endingId;
        stopTimer();
        return effect.message || null;

      case 'resetRooms':
        // Timer mode: reset all room pickup states and clear specific flags/items
        _state.roomStates  = {};
        _state.inventory   = [];
        _state.flags       = {};
        _state.solvedPuzzles = [];
        _state.eventProgress = {};
        _state.deductions  = [];
        _state.currentRoomId = _gameData.rooms[0].id;
        _state.timerRemaining = _gameData.meta.timeLimitSeconds || 0;
        return effect.message || 'The chamber resets…';

      case 'addDeduction':
        if (!_state.deductions.includes(effect.deductionId)) {
          _state.deductions.push(effect.deductionId);
        }
        return effect.message || `Deduction formed: ${effect.deductionId}`;

      default:
        console.warn('[SpecterEngine] unknown effect type:', effect.type);
        return null;
    }
  }

  /** Apply an array of effects; return concatenated non-null messages. */
  function _applyEffects(effects) {
    if (!effects || !effects.length) return null;
    const messages = effects.map(_applyEffect).filter(Boolean);
    return messages.length ? messages.join(' ') : null;
  }

  /**
   * Check the action's condition. If it passes, apply its effects.
   * Returns { ok: bool, message: string }.
   */
  function _executeAction(action) {
    if (action.condition && !_evalCondition(action.condition)) {
      const penalized = _applyTimePenalty(action.penaltySeconds);
      const base = action.failMessage || 'You cannot do that right now.';
      return { ok: false, message: penalized ? base + ' ' + penalized : base };
    }
    const msg = _applyEffects(action.effects);
    return { ok: true, message: msg || action.successMessage || 'Done.' };
  }

  // ─── Event-chain logic ────────────────────────────────────────────────────

  /**
   * Advance an event one step. Each step becomes available only after the
   * previous one is completed (solved via its action's effects or by the
   * engine marking the step complete).
   */
  function _advanceEvent(eventId) {
    const event = _byId(_gameData.events, eventId);
    if (!event) return { ok: false, message: 'Unknown event.' };

    const progress = _state.eventProgress[eventId] || 0;
    if (progress >= event.steps.length) {
      return { ok: false, message: 'Already complete.' };
    }

    const step   = event.steps[progress];
    let result   = { ok: true, message: step.description };

    // If the step has an action embedded, execute it
    if (step.action) {
      result = _executeAction(step.action);
      if (!result.ok) return result;
    }

    // Apply step-level effects (independent of the action)
    const stepMsg = _applyEffects(step.effects);
    if (stepMsg) result.message = [result.message, stepMsg].filter(Boolean).join(' ');

    // Advance progress
    _state.eventProgress[eventId] = progress + 1;

    // If all steps done, mark puzzle solved
    if (_state.eventProgress[eventId] >= event.steps.length) {
      if (!_state.solvedPuzzles.includes(eventId)) {
        _state.solvedPuzzles.push(eventId);
      }
      if (event.onComplete) {
        const completeMsg = _applyEffects(event.onComplete);
        if (completeMsg) result.message = [result.message, completeMsg].filter(Boolean).join(' ');
      }
    }

    return result;
  }

  // ─── Timer ────────────────────────────────────────────────────────────────

  function startTimer(onTick, onExpire) {
    if (!_gameData || !_gameData.meta.timed) return;
    _onTickCb   = onTick;
    _onExpireCb = onExpire;
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = setInterval(function () {
      if (_state.ended) { clearInterval(_timerInterval); return; }
      _state.timerRemaining = Math.max(0, _state.timerRemaining - 1);
      if (_onTickCb) _onTickCb(_state.timerRemaining);
      if (_state.timerRemaining <= 0) {
        clearInterval(_timerInterval);
        _timerInterval = null;
        // Run the content's onTimerEnd event chain if defined
        if (_gameData.meta.onTimerEnd) {
          _applyEffects(_gameData.meta.onTimerEnd);
        }
        if (_onExpireCb) _onExpireCb();
      }
    }, 1000);
  }

  function stopTimer() {
    if (_timerInterval) {
      clearInterval(_timerInterval);
      _timerInterval = null;
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  function saveState() {
    if (!_gameId) return;
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('specter_save_' + _gameId, JSON.stringify(_state));
    } catch (e) {
      console.warn('[SpecterEngine] could not save state:', e);
    }
  }

  function loadSavedState() {
    if (!_gameId) return false;
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem('specter_save_' + _gameId);
      if (!raw) return false;
      _state = JSON.parse(raw);
      return true;
    } catch (e) {
      console.warn('[SpecterEngine] could not load saved state:', e);
      return false;
    }
  }

  function resetState() {
    stopTimer();
    _state = _freshState();
    if (_gameId) localStorage.removeItem('specter_save_' + _gameId);
  }

  // ─── State snapshot ───────────────────────────────────────────────────────

  /**
   * Build a renderer-friendly snapshot. The renderer must never read _state
   * directly; it uses this immutable-ish view.
   */
  function getState() {
    if (!_gameData || !_state) return null;

    const room = _byId(_gameData.rooms, _state.currentRoomId);

    // Visible items: items listed in the room that haven't been picked up yet
    const roomPickedUp = (_state.roomStates[_state.currentRoomId] || {}).itemsPickedUp || [];
    const visibleItems = (room.items || [])
      .filter(itemId => !roomPickedUp.includes(itemId))
      .map(itemId => _byId(_gameData.items, itemId))
      .filter(Boolean);

    // Available exits: rooms whose unlockCondition is satisfied
    const availableExits = (room.exits || [])
      .map(exitRoomId => {
        const target = _byId(_gameData.rooms, exitRoomId);
        if (!target) return null;
        const locked = target.unlockCondition && !_evalCondition(target.unlockCondition);
        return { id: target.id, name: target.name, locked };
      })
      .filter(Boolean);

    // Event steps visible in this room
    const roomEvents = (room.events || []).map(eventId => {
      const event    = _byId(_gameData.events, eventId);
      if (!event) return null;
      const progress = _state.eventProgress[eventId] || 0;
      const done     = progress >= event.steps.length;
      const currentStep = done ? null : event.steps[progress];
      return {
        id         : event.id,
        name       : event.name || event.id,
        description: event.description || '',
        done,
        currentStep,
        progress,
        totalSteps : event.steps.length
      };
    }).filter(Boolean);

    // Inventory items as full objects
    const inventoryItems = _state.inventory
      .map(id => _byId(_gameData.items, id))
      .filter(Boolean);

    // All clues discovered (items in inventory that are marked as clues,
    // plus any clues explicitly added via flags)
    const clues = (_gameData.clues || []).filter(c =>
      _state.flags['clue_' + c.id] || _state.inventory.includes(c.id)
    );

    // Deduction definitions available for linking on the evidence board
    const deductionDefs = _gameData.deductions || [];

    return {
      meta           : _gameData.meta,
      room           : {
        id          : room.id,
        name        : room.name,
        description : room.description,
        sceneImage  : room.sceneImage || null,
        actions     : (room.actions || []).filter(a => !a.condition || _evalCondition(a.condition)),
        allActions  : (room.actions || []),
      },
      visibleItems,
      availableExits,
      roomEvents,
      inventory      : inventoryItems,
      flags          : Object.assign({}, _state.flags),
      solvedPuzzles  : _state.solvedPuzzles.slice(),
      deductions     : _state.deductions.slice(),
      deductionDefs,
      clues,
      ended          : _state.ended,
      endingId       : _state.endingId,
      ending         : _state.endingId ? _byId(_gameData.endings, _state.endingId) : null,
      timerRemaining : _state.timerRemaining,
      allRooms       : _gameData.rooms.map(r => ({
        id  : r.id,
        name: r.name,
        locked: r.unlockCondition ? !_evalCondition(r.unlockCondition) : false
      }))
    };
  }

  // ─── Action dispatcher ────────────────────────────────────────────────────

  /**
   * Perform a named action. The action object comes from content data or
   * from the renderer translating a user interaction (e.g. picking up item,
   * moving to exit, triggering an event step).
   *
   * Recognised action.type values: pickup, examine, use, combine, move,
   *   trigger, accuse, link
   *
   * Returns { ok: boolean, message: string, state: StateSnapshot }
   */
  function performAction(action) {
    if (!_gameData || !_state) {
      return { ok: false, message: 'No game loaded.', state: null };
    }
    if (_state.ended) {
      return { ok: false, message: 'The game has ended.', state: getState() };
    }

    let result = { ok: false, message: 'Nothing happens.' };

    switch (action.type) {

      // ── Move to another room ─────────────────────────────────────────────
      case 'move': {
        const target = _byId(_gameData.rooms, action.roomId);
        if (!target) {
          result = { ok: false, message: 'That room does not exist.' };
          break;
        }
        if (target.unlockCondition && !_evalCondition(target.unlockCondition)) {
          result = { ok: false, message: action.lockedMessage || 'That way is locked.' };
          break;
        }
        _state.currentRoomId = action.roomId;
        result = { ok: true, message: `You move to ${target.name}.` };
        break;
      }

      // ── Pick up an item ───────────────────────────────────────────────────
      case 'pickup': {
        const roomId  = _state.currentRoomId;
        const item    = _byId(_gameData.items, action.itemId);
        if (!item) {
          result = { ok: false, message: 'That item is not here.' };
          break;
        }
        // Track per-room pickup so the item disappears from room display
        if (!_state.roomStates[roomId]) _state.roomStates[roomId] = { itemsPickedUp: [] };
        if (!_state.roomStates[roomId].itemsPickedUp.includes(action.itemId)) {
          _state.roomStates[roomId].itemsPickedUp.push(action.itemId);
        }
        if (!_state.inventory.includes(action.itemId)) {
          _state.inventory.push(action.itemId);
        }
        // If the item is a clue, mark it
        const clue = _byId(_gameData.clues, action.itemId);
        if (clue) _state.flags['clue_' + action.itemId] = true;

        result = { ok: true, message: `You pick up ${item.name}.` };
        // Apply any item-level on-pickup effects
        if (item.onPickup) {
          const extra = _applyEffects(item.onPickup);
          if (extra) result.message += ' ' + extra;
        }
        break;
      }

      // ── Examine an item ───────────────────────────────────────────────────
      case 'examine': {
        const item = _byId(_gameData.items, action.itemId);
        if (!item) {
          result = { ok: false, message: 'Nothing to examine.' };
          break;
        }
        result = { ok: true, message: item.examineText || item.description || `You examine ${item.name}. Nothing unusual.` };
        break;
      }

      // ── Use an item (generic) ─────────────────────────────────────────────
      case 'use': {
        const item = _byId(_gameData.items, action.itemId);
        if (!item) {
          result = { ok: false, message: 'You do not have that.' };
          break;
        }
        if (!_state.inventory.includes(action.itemId)) {
          result = { ok: false, message: `You don't have ${item.name}.` };
          break;
        }
        if (item.useEffects) {
          const msg = _applyEffects(item.useEffects);
          result = { ok: true, message: msg || `You use ${item.name}.` };
        } else {
          result = { ok: true, message: item.useText || `You use ${item.name}, but nothing happens.` };
        }
        break;
      }

      // ── Combine two items ─────────────────────────────────────────────────
      case 'combine': {
        const itemA = _byId(_gameData.items, action.itemIdA);
        const itemB = _byId(_gameData.items, action.itemIdB);
        if (!itemA || !itemB) {
          result = { ok: false, message: 'One of those items does not exist.' };
          break;
        }
        if (!_state.inventory.includes(action.itemIdA) || !_state.inventory.includes(action.itemIdB)) {
          result = { ok: false, message: 'You need both items in your inventory.' };
          break;
        }
        // Look for a combine rule in either item
        const rule = (itemA.combinesWith && itemA.combinesWith[action.itemIdB]) ||
                     (itemB.combinesWith && itemB.combinesWith[action.itemIdA]);
        if (!rule) {
          // Optional meta.combineFailPenaltySeconds penalizes wrong pairs
          const penalized = _applyTimePenalty(_gameData.meta.combineFailPenaltySeconds);
          result = { ok: false, message: `${itemA.name} and ${itemB.name} don't combine into anything.` + (penalized ? ' ' + penalized : '') };
          break;
        }
        // Remove source items, grant result
        const idxA = _state.inventory.indexOf(action.itemIdA);
        const idxB = _state.inventory.indexOf(action.itemIdB);
        if (idxA !== -1) _state.inventory.splice(idxA, 1);
        // Recalculate because splice shifted indices
        const idxB2 = _state.inventory.indexOf(action.itemIdB);
        if (idxB2 !== -1) _state.inventory.splice(idxB2, 1);

        const resultItem = _byId(_gameData.items, rule.result);
        if (resultItem && !_state.inventory.includes(rule.result)) {
          _state.inventory.push(rule.result);
        }
        const extra = rule.effects ? _applyEffects(rule.effects) : null;
        result = {
          ok: true,
          message: rule.message || `Combining ${itemA.name} and ${itemB.name}, you obtained ${resultItem ? resultItem.name : 'something new'}.`
        };
        if (extra) result.message += ' ' + extra;
        break;
      }

      // ── Trigger an event step ─────────────────────────────────────────────
      case 'trigger': {
        result = _advanceEvent(action.eventId);
        break;
      }

      // ── Accuse a suspect (branching ending) ───────────────────────────────
      case 'accuse': {
        // The content file lists suspects; each suspect maps to an ending
        const suspects = _gameData.suspects || [];
        const suspect  = suspects.find(s => s.id === action.suspectId);
        if (!suspect) {
          result = { ok: false, message: 'No such suspect.' };
          break;
        }
        // Check required deductions
        if (suspect.requiresDeductions) {
          const missing = suspect.requiresDeductions.filter(d => !_state.deductions.includes(d));
          if (missing.length > 0) {
            result = { ok: false, message: suspect.notReadyMessage || 'You need more evidence before making an accusation.' };
            break;
          }
        }
        _state.ended    = true;
        _state.endingId = suspect.endingId;
        stopTimer();
        result = { ok: true, message: suspect.accuseMessage || `You accuse ${suspect.name}.` };
        break;
      }

      // ── Link two clues on the evidence board ──────────────────────────────
      case 'link': {
        // Find a deduction whose sources match the two clue ids
        const defs = _gameData.deductions || [];
        const def  = defs.find(d => {
          const srcs = d.sources || [];
          return srcs.includes(action.clueIdA) && srcs.includes(action.clueIdB);
        });
        if (!def) {
          result = { ok: false, message: "These two pieces of evidence don't connect." };
          break;
        }
        // Verify the player has both clues
        const hasA = _state.inventory.includes(action.clueIdA) || _state.flags['clue_' + action.clueIdA];
        const hasB = _state.inventory.includes(action.clueIdB) || _state.flags['clue_' + action.clueIdB];
        if (!hasA || !hasB) {
          result = { ok: false, message: 'You need both pieces of evidence in hand.' };
          break;
        }
        if (_state.deductions.includes(def.id)) {
          result = { ok: true, message: `You already formed this deduction: ${def.text}` };
          break;
        }
        _state.deductions.push(def.id);
        // Apply any deduction-level effects
        const defMsg = def.effects ? _applyEffects(def.effects) : null;
        result = {
          ok: true,
          message: def.message || `Deduction: ${def.text}` + (defMsg ? ' ' + defMsg : '')
        };
        break;
      }

      // ── Generic room-level action (defined in room.actions array) ─────────
      default: {
        // Check if the action type matches any action in the current room
        const room = _byId(_gameData.rooms, _state.currentRoomId);
        const matchingAction = (room.actions || []).find(
          a => action.actionId ? a.id === action.actionId : a.type === action.type
        );
        if (matchingAction) {
          result = _executeAction(matchingAction);
        } else {
          result = { ok: false, message: 'Unknown action.' };
        }
        break;
      }
    }

    // Auto-save after every action
    saveState();

    return Object.assign(result, { state: getState() });
  }

  // ─── Loader ───────────────────────────────────────────────────────────────

  /**
   * Load a game content file and initialise (or restore) state.
   * @param {object} gameData  Parsed JSON content
   * @param {object} [options] { resumeSaved: bool }
   */
  function load(gameData, options) {
    options     = options || {};
    _gameData   = gameData;
    _gameId     = gameData.meta.title.toLowerCase().replace(/\s+/g, '-');
    stopTimer();

    if (options.resumeSaved && loadSavedState()) {
      // Resumed; state already set
      return;
    }
    _state = _freshState();
  }

  // ─── Hint accessor ────────────────────────────────────────────────────────

  /**
   * Return the hint text for a given puzzle id, or null if none.
   * @param {string} puzzleId
   */
  function getHint(puzzleId) {
    const hint = (_gameData.hints || []).find(h => h.forPuzzle === puzzleId);
    return hint ? hint.text : null;
  }

  /**
   * Return every hint object for a puzzle, in content order. Hints are
   * environmental: they point at something in the room (highlightText) and
   * never state the answer outright.
   */
  function getHintDetails(puzzleId) {
    if (!_gameData) return [];
    return (_gameData.hints || []).filter(h => h.forPuzzle === puzzleId);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  const SpecterEngine = {
    load,
    getState,
    performAction,
    getHint,
    getHintDetails,
    saveState,
    loadSavedState,
    resetState,
    startTimer,
    stopTimer
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpecterEngine;
  } else {
    global.SpecterEngine = SpecterEngine;
  }

}(typeof window !== 'undefined' ? window : global));
