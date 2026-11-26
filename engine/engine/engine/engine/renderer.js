/**
 * renderer.js — Specter Engine generic UI renderer.
 *
 * Reads a StateSnapshot from SpecterEngine.getState() and builds the entire
 * game UI dynamically. The renderer has zero game-specific knowledge; every
 * label, description, and structure comes from the content data via the
 * engine's state snapshot.
 *
 * Mount point: a single <div id="specter-root"> in the host page.
 *
 * Usage:
 *   SpecterRenderer.init('specter-root');
 *   SpecterRenderer.render(SpecterEngine.getState());
 *
 * The renderer also wires up all user interactions and calls
 * SpecterEngine.performAction() on the player's behalf, then re-renders.
 */

(function (global) {
  'use strict';

  let _rootId   = null;
  let _root     = null;
  let _msgQueue = [];   // queued feedback messages shown in the message log

  // ── Utility ────────────────────────────────────────────────────────────────

  function el(tag, attrs, ...children) {
    const elem = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') elem.className = v;
        else if (k === 'textContent') elem.textContent = v;
        else if (k === 'innerHTML') elem.innerHTML = v;
        else if (k.startsWith('on')) elem.addEventListener(k.slice(2).toLowerCase(), v);
        else elem.setAttribute(k, v);
      }
    }
    for (const child of children) {
      if (child == null) continue;
      if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
      else elem.appendChild(child);
    }
    return elem;
  }

  function btn(label, handler, extraClass, disabled) {
    const b = el('button', {
      className  : 'specter-btn' + (extraClass ? ' ' + extraClass : ''),
      textContent: label,
      onClick    : handler
    });
    if (disabled) b.disabled = true;
    return b;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ── Message log ───────────────────────────────────────────────────────────

  function pushMessage(text, cssClass) {
    _msgQueue.push({ text, cssClass: cssClass || 'msg-info' });
    if (_msgQueue.length > 8) _msgQueue.shift();
  }

  function renderMessages(container) {
    const log = el('div', { className: 'specter-log' });
    for (const m of _msgQueue) {
      log.appendChild(el('p', { className: 'log-entry ' + m.cssClass, textContent: m.text }));
    }
    container.appendChild(log);
  }

  // ── Action helper: dispatch to engine + re-render ─────────────────────────

  function dispatch(action) {
    const result = global.SpecterEngine.performAction(action);
    if (result.message) {
      pushMessage(result.message, result.ok ? 'msg-ok' : 'msg-fail');
    }
    renderFull(result.state);
  }

  // ── Timer display ─────────────────────────────────────────────────────────

  function updateTimerEl(remaining) {
    const timerEl = document.getElementById('specter-timer');
    if (!timerEl) return;
    timerEl.textContent = '⏳ ' + formatTime(remaining);
    timerEl.className   = 'specter-timer' + (remaining <= 60 ? ' timer-urgent' : '');
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  function renderHeader(state, container) {
    const header = el('header', { className: 'specter-header' },
      el('span', { className: 'specter-game-title', textContent: state.meta.title }),
      el('div',  { className: 'specter-header-controls' },
        btn('💾 Save', () => { global.SpecterEngine.saveState(); pushMessage('Game saved.'); renderFull(global.SpecterEngine.getState()); }, 'btn-sm'),
        btn('🔄 Restart', () => {
          if (confirm('Restart from the beginning?')) {
            global.SpecterEngine.resetState();
            _msgQueue = [];
            if (state.meta.timed) {
              global.SpecterEngine.startTimer(updateTimerEl, onTimerExpire);
            }
            renderFull(global.SpecterEngine.getState());
          }
        }, 'btn-sm')
      )
    );
    if (state.meta.timed) {
      const timerEl = el('div', {
        id        : 'specter-timer',
        className : 'specter-timer' + (state.timerRemaining <= 60 ? ' timer-urgent' : ''),
        textContent: '⏳ ' + formatTime(state.timerRemaining)
      });
      header.insertBefore(timerEl, header.firstChild);
    }
    container.appendChild(header);
  }

  function renderRoom(state, container) {
    const room = state.room;
    const section = el('section', { className: 'specter-room' },
      el('h2', { className: 'room-name', textContent: '📍 ' + room.name }),
      el('p',  { className: 'room-desc', textContent: room.description })
    );
    container.appendChild(section);
  }

  function renderExits(state, container) {
    if (!state.availableExits || state.availableExits.length === 0) return;
    const section = el('section', { className: 'specter-exits' },
      el('h3', { textContent: '🚪 Exits' })
    );
    for (const exit of state.availableExits) {
      const exitBtn = btn(
        exit.locked ? `🔒 ${exit.name}` : `➜ ${exit.name}`,
        () => dispatch({ type: 'move', roomId: exit.id }),
        exit.locked ? 'btn-locked' : 'btn-exit',
        exit.locked
      );
      section.appendChild(exitBtn);
    }
    container.appendChild(section);
  }

  function renderItems(state, container) {
    if (!state.visibleItems || state.visibleItems.length === 0) return;
    const section = el('section', { className: 'specter-items' },
      el('h3', { textContent: '✨ Items Here' })
    );
    for (const item of state.visibleItems) {
      const row = el('div', { className: 'item-row' },
        el('span', { className: 'item-name', textContent: item.name }),
        item.description ? el('span', { className: 'item-desc', textContent: item.description }) : null,
        btn('Pick Up', () => dispatch({ type: 'pickup', itemId: item.id }), 'btn-pickup')
      );
      section.appendChild(row);
    }
    container.appendChild(section);
  }

  function renderRoomActions(state, container) {
    if (!state.room.actions || state.room.actions.length === 0) return;
    const section = el('section', { className: 'specter-actions' },
      el('h3', { textContent: '⚡ Actions' })
    );
    for (const action of state.room.allActions) {
      const condMet = !action.condition ||
        global.SpecterEngine.performAction({ type: '__condcheck__', _cond: action.condition });
      // Re-evaluate visibility properly by checking via state snapshot's filtered list
      const visible = state.room.actions.some(a => a.id === action.id || a === action);
      if (!visible) continue;

      const actionBtn = btn(
        action.label,
        () => {
          // For actions in the room, we dispatch them directly with their type
          const act = Object.assign({}, action);
          dispatch(act);
        },
        'btn-action'
      );
      if (action.description) {
        actionBtn.title = action.description;
      }
      section.appendChild(actionBtn);
    }
    container.appendChild(section);
  }

  function renderEvents(state, container) {
    if (!state.roomEvents || state.roomEvents.length === 0) return;
    const section = el('section', { className: 'specter-events' },
      el('h3', { textContent: '⚙️ Mechanisms' })
    );
    for (const event of state.roomEvents) {
      const eventDiv = el('div', { className: 'event-row' + (event.done ? ' event-done' : '') });
      eventDiv.appendChild(el('div', { className: 'event-name', textContent: event.name }));
      if (event.description) {
        eventDiv.appendChild(el('div', { className: 'event-desc', textContent: event.description }));
      }
      // Progress bar
      const progressBar = el('div', { className: 'event-progress' },
        el('div', {
          className: 'event-progress-fill',
          style: `width: ${event.done ? 100 : Math.round((event.progress / event.totalSteps) * 100)}%`
        })
      );
      eventDiv.appendChild(progressBar);
      eventDiv.appendChild(el('span', {
        className  : 'event-step-count',
        textContent: event.done ? '✅ Complete' : `Step ${event.progress + 1} / ${event.totalSteps}`
      }));

      if (!event.done && event.currentStep) {
        eventDiv.appendChild(el('p', {
          className  : 'event-step-desc',
          textContent: event.currentStep.description
        }));
        const triggerBtn = btn(
          event.currentStep.actionLabel || 'Activate',
          () => dispatch({ type: 'trigger', eventId: event.id }),
          'btn-trigger'
        );
        eventDiv.appendChild(triggerBtn);

        // Hint button
        const hint = global.SpecterEngine.getHint(event.id);
        if (hint) {
          eventDiv.appendChild(btn('💡 Hint', () => pushMessage('Hint: ' + hint, 'msg-hint') || renderFull(global.SpecterEngine.getState()), 'btn-hint'));
        }
      }
      section.appendChild(eventDiv);
    }
    container.appendChild(section);
  }

  function renderInventory(state, container) {
    const section = el('section', { className: 'specter-inventory' },
      el('h3', { textContent: '🎒 Inventory' })
    );

    if (!state.inventory || state.inventory.length === 0) {
      section.appendChild(el('p', { className: 'empty-note', textContent: 'Nothing carried.' }));
    } else {
      const grid = el('div', { className: 'inv-grid' });
      for (const item of state.inventory) {
        const card = el('div', { className: 'inv-card' },
          el('div', { className: 'inv-icon', textContent: item.icon || '📦' }),
          el('div', { className: 'inv-name', textContent: item.name })
        );
        // Examine button
        card.appendChild(btn('🔍', () => dispatch({ type: 'examine', itemId: item.id }), 'btn-xs', false));
        // Use button (only if item has useEffects or useText)
        if (item.useEffects || item.useText) {
          card.appendChild(btn('▶', () => dispatch({ type: 'use', itemId: item.id }), 'btn-xs', false));
        }
        grid.appendChild(card);
      }
      section.appendChild(grid);

      // Combine panel (shown if 2+ items are in inventory)
      if (state.inventory.length >= 2) {
        renderCombinePanel(state, section);
      }
    }
    container.appendChild(section);
  }

  function renderCombinePanel(state, container) {
    const panel = el('div', { className: 'combine-panel' },
      el('h4', { textContent: '🔗 Combine Items' })
    );
    const selA   = el('select', { className: 'combine-select', id: 'combineA' });
    const selB   = el('select', { className: 'combine-select', id: 'combineB' });
    const placeholder = el('option', { value: '', textContent: '— choose —' });
    const placeholder2 = placeholder.cloneNode(true);
    selA.appendChild(placeholder);
    selB.appendChild(placeholder2);
    for (const item of state.inventory) {
      selA.appendChild(el('option', { value: item.id, textContent: item.name }));
      selB.appendChild(el('option', { value: item.id, textContent: item.name }));
    }
    panel.appendChild(selA);
    panel.appendChild(el('span', { textContent: '+', className: 'combine-plus' }));
    panel.appendChild(selB);
    panel.appendChild(btn('Combine', () => {
      const idA = selA.value;
      const idB = selB.value;
      if (!idA || !idB || idA === idB) {
        pushMessage('Select two different items to combine.', 'msg-fail');
        renderFull(global.SpecterEngine.getState());
        return;
      }
      dispatch({ type: 'combine', itemIdA: idA, itemIdB: idB });
    }, 'btn-combine'));
    container.appendChild(panel);
  }

  function renderEvidenceBoard(state, container) {
    // The evidence board is only shown when the game has deduction definitions
    // (i.e. the content file is a detective-style game).
    const defs = state.deductionDefs;
    if (!defs || defs.length === 0) return;

    const section = el('section', { className: 'specter-evidence' },
      el('h3', { textContent: '🔎 Evidence Board' })
    );

    // Clues in hand
    const clues = state.clues;
    if (clues.length === 0) {
      section.appendChild(el('p', { className: 'empty-note', textContent: 'No evidence gathered yet.' }));
      container.appendChild(section);
      return;
    }

    const clueList = el('div', { className: 'clue-list' });
    for (const clue of clues) {
      clueList.appendChild(el('div', { className: 'clue-chip', textContent: clue.name || clue.id }));
    }
    section.appendChild(clueList);

    // Deductions already formed
    if (state.deductions.length > 0) {
      const deducList = el('div', { className: 'deduction-list' },
        el('h4', { textContent: '💡 Deductions' })
      );
      for (const dedId of state.deductions) {
        const def = defs.find(d => d.id === dedId);
        if (def) {
          deducList.appendChild(el('div', { className: 'deduction-item', textContent: '✔ ' + def.text }));
        }
      }
      section.appendChild(deducList);
    }

    // Link panel
    if (clues.length >= 2) {
      const linkPanel = el('div', { className: 'link-panel' },
        el('h4', { textContent: '🔗 Link Evidence' })
      );
      const selA   = el('select', { className: 'combine-select', id: 'linkA' });
      const selB   = el('select', { className: 'combine-select', id: 'linkB' });
      const phA    = el('option', { value: '', textContent: '— clue A —' });
      const phB    = el('option', { value: '', textContent: '— clue B —' });
      selA.appendChild(phA);
      selB.appendChild(phB);
      for (const clue of clues) {
        const name = clue.name || clue.id;
        selA.appendChild(el('option', { value: clue.id, textContent: name }));
        selB.appendChild(el('option', { value: clue.id, textContent: name }));
      }
      linkPanel.appendChild(selA);
      linkPanel.appendChild(el('span', { className: 'combine-plus', textContent: '↔' }));
      linkPanel.appendChild(selB);
      linkPanel.appendChild(btn('Link', () => {
        const idA = selA.value;
        const idB = selB.value;
        if (!idA || !idB || idA === idB) {
          pushMessage('Select two different pieces of evidence.', 'msg-fail');
          renderFull(global.SpecterEngine.getState());
          return;
        }
        dispatch({ type: 'link', clueIdA: idA, clueIdB: idB });
      }, 'btn-link'));
      section.appendChild(linkPanel);
    }

    // Accusation panel — shown when enough deductions are formed
    renderAccusation(state, section);

    container.appendChild(section);
  }

  function renderAccusation(state, container) {
    const suspects = (global.SpecterEngine._gameData || {}).suspects;
    // Access suspects via a small backdoor (content data needed here)
    // We use a soft coupling: check window._specterGameData set by game.html
    const gameData = global._specterGameData;
    if (!gameData || !gameData.suspects) return;

    // Determine if the player has the minimum required deductions to accuse
    const minRequired = gameData.meta.accuseRequires || 1;
    if (state.deductions.length < minRequired) {
      container.appendChild(el('p', {
        className  : 'accuse-note',
        textContent: `Form at least ${minRequired} deduction${minRequired > 1 ? 's' : ''} before making an accusation.`
      }));
      return;
    }

    const accusePanel = el('div', { className: 'accuse-panel' },
      el('h4', { textContent: '⚖️ Make an Accusation' })
    );
    for (const suspect of gameData.suspects) {
      accusePanel.appendChild(btn(
        `Accuse ${suspect.name}`,
        () => dispatch({ type: 'accuse', suspectId: suspect.id }),
        'btn-accuse'
      ));
    }
    container.appendChild(accusePanel);
  }

  function renderEnding(state, container) {
    if (!state.ended || !state.ending) return;
    const ending = state.ending;
    const overlay = el('div', { className: 'ending-overlay' },
      el('div', { className: 'ending-box' },
        el('div', { className: 'ending-icon', textContent: ending.icon || (ending.isWin ? '🏆' : '💀') }),
        el('h2', { className: 'ending-title', textContent: ending.title }),
        el('p',  { className: 'ending-text',  textContent: ending.text }),
        btn('Play Again', () => {
          global.SpecterEngine.resetState();
          _msgQueue = [];
          if (state.meta.timed) {
            global.SpecterEngine.startTimer(updateTimerEl, onTimerExpire);
          }
          renderFull(global.SpecterEngine.getState());
        }, 'btn-restart')
      )
    );
    container.appendChild(overlay);
  }

  function renderNavMap(state, container) {
    // For non-timed (exploration) games, show a compact room nav list
    if (state.meta.timed) return;
    const section = el('section', { className: 'specter-map' },
      el('h3', { textContent: '🗺️ Locations' })
    );
    for (const r of state.allRooms) {
      const isActive  = r.id === state.room.id;
      const moveBtn   = btn(
        (isActive ? '▶ ' : '') + r.name,
        () => { if (!isActive && !r.locked) dispatch({ type: 'move', roomId: r.id }); },
        'btn-map' + (isActive ? ' btn-map-active' : '') + (r.locked ? ' btn-locked' : ''),
        r.locked || isActive
      );
      section.appendChild(moveBtn);
    }
    container.appendChild(section);
  }

  // ── Timer-expire callback (called by engine timer) ────────────────────────

  function onTimerExpire() {
    pushMessage('⌛ Time is up! The chamber resets…', 'msg-fail');
    renderFull(global.SpecterEngine.getState());
  }

  // ── Full render ───────────────────────────────────────────────────────────

  function renderFull(state) {
    if (!_root) return;
    if (!state) {
      _root.innerHTML = '<p class="specter-error">No game loaded.</p>';
      return;
    }

    // Clear and rebuild
    _root.innerHTML = '';

    // Ending overlay takes over the whole screen
    if (state.ended) {
      renderEnding(state, _root);
      return;
    }

    const layout = el('div', { className: 'specter-layout' });

    // Left column: room + events + actions + exits
    const leftCol = el('div', { className: 'col-main' });
    renderHeader(state, leftCol);
    renderRoom(state, leftCol);
    renderExits(state, leftCol);
    renderItems(state, leftCol);
    renderEvents(state, leftCol);
    renderRoomActions(state, leftCol);
    renderMessages(state, leftCol); // messages live here — after content

    // Right column: inventory + evidence board (detective games) / map
    const rightCol = el('div', { className: 'col-side' });
    renderNavMap(state, rightCol);
    renderInventory(state, rightCol);
    renderEvidenceBoard(state, rightCol);

    layout.appendChild(leftCol);
    layout.appendChild(rightCol);
    _root.appendChild(layout);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function init(rootElementId) {
    _rootId = rootElementId;
    _root   = document.getElementById(rootElementId);
    if (!_root) {
      console.error('[SpecterRenderer] mount point #' + rootElementId + ' not found');
    }
  }

  const SpecterRenderer = {
    init,
    render      : renderFull,
    pushMessage,
    updateTimer : updateTimerEl,
    onTimerExpire,
    // Expose for game.html to call when timer expires
    _onExpire   : onTimerExpire
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpecterRenderer;
  } else {
    global.SpecterRenderer = SpecterRenderer;
  }

}(typeof window !== 'undefined' ? window : global));
