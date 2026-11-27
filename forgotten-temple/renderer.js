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
    // Journal section
    const section = el('section', { className: 'specter-journal' },
      el('h3', { textContent: '📜 Journal' })
    );
    const log = el('div', { className: 'specter-log' });
    if (_msgQueue.length === 0) {
      log.appendChild(el('p', { className: 'log-entry msg-info', textContent: 'Nothing recorded yet. What you find will be written down here.' }));
    }
    for (const m of _msgQueue) {
      log.appendChild(el('p', { className: 'log-entry ' + m.cssClass, textContent: m.text }));
    }
    section.appendChild(log);
    container.appendChild(section);
    // Keep the newest entry in view
    log.scrollTop = log.scrollHeight;
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
    timerEl.className   = 'specter-timer' + (remaining <= 60 ? ' timer-urgent' : remaining <= 120 ? ' timer-warn' : '');
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

  // Per-room scene art: inline SVG scenes keyed by theme + room id.
  const ROOM_SCENES = {
    'temple:entrance-hall': 'M0,90 Q30,40 60,85 T120,70 T180,80 T240,60 T300,85 T360,75 T420,88 T480,72 T540,80 T600,65 T660,85 T720,70 T780,80 T840,60 T900,78 T960,70 T1024,85 L1024,160 L0,160 Z',
    'temple:mirror-chamber': 'M160,140 L160,60 L220,60 L220,140 M402,140 L402,50 L462,50 L462,140 M644,140 L644,65 L704,65 L704,140 M0,150 L1024,150',
    'temple:altar-room': 'M462,140 L462,80 L562,80 L562,140 M412,140 L612,140 M512,30 L512,55 M487,42 L537,42',
    'temple:reliquary': 'M512,20 L530,80 L592,80 L544,116 L564,178 L512,142 L460,178 L480,116 L432,80 L494,80 Z',
    'noir:detective-office': 'M0,150 L0,90 L80,90 L80,40 L140,40 L140,110 L240,110 L240,150 M340,150 L340,70 L420,70 L420,150 M520,150 L520,30 L600,30 L600,150 M700,150 L700,85 L800,85 L800,150 M900,150 L900,55 L980,55 L980,150',
    'noir:harbour-docks': 'M0,110 Q120,100 240,112 T480,108 T720,114 T1024,106 L1024,160 L0,160 Z M120,110 L120,60 L135,60 L135,110 M520,112 L520,50 L535,50 L535,112',
    'noir:riverside-manor': 'M362,140 L362,90 L512,20 L662,90 L662,140 M482,140 L482,100 L542,100 L542,140 M0,150 L1024,150',
    'noir:noir-cafe': 'M300,140 L300,110 L420,110 L420,140 M310,110 Q360,70 410,110 M700,140 L700,60 L860,60 L860,140 M760,60 L760,30 M790,60 L790,30',
    'temple:default': 'M0,120 Q256,70 512,110 T1024,95 L1024,160 L0,160 Z',
    'noir:default': 'M0,130 L60,130 L60,80 L120,80 L120,130 L220,130 L220,50 L300,50 L300,130 L420,130 L420,95 L500,95 L500,130 L640,130 L640,60 L720,60 L720,130 L850,130 L850,85 L930,85 L930,130 L1024,130 L1024,160 L0,160 Z'
  };

  function renderRoom(state, container) {
    const room = state.room;
    const theme = (state.meta && state.meta.theme) || 'default';
    const scene = ROOM_SCENES[theme + ':' + room.id] || ROOM_SCENES[theme + ':default'] || ROOM_SCENES['temple:default'];
    const sceneEl = document.createElement('div');
    sceneEl.className = 'room-scene scene-' + theme + (room.sceneImage ? ' has-image' : '');
    const svgScene = () => {
      const wrap = document.createElement('span');
      wrap.innerHTML = '<svg viewBox="0 0 1024 160" preserveAspectRatio="none" aria-hidden="true">' +
        '<path d="' + scene + '" fill="currentColor"/></svg>';
      return wrap.firstChild;
    };
    if (room.sceneImage) {
      const img = el('img', {
        className: 'scene-img',
        src: (global.SPECTER_SCENES && global.SPECTER_SCENES[room.sceneImage]) || room.sceneImage,
        alt: ''
      });
      // A bad key or URL swaps in the built-in scene art and says so
      img.addEventListener('error', () => {
        console.warn('[SpecterRenderer] sceneImage "' + room.sceneImage + '" failed to load; using fallback scene art');
        img.remove();
        sceneEl.classList.remove('has-image');
        sceneEl.insertBefore(svgScene(), sceneEl.firstChild);
      });
      sceneEl.appendChild(img);
      sceneEl.appendChild(el('span', { className: 'scene-scrim' }));
    } else {
      sceneEl.appendChild(svgScene());
    }
    sceneEl.appendChild(el('span', { className: 'scene-glow' }));
    sceneEl.appendChild(el('h2', { className: 'room-name', textContent: '📍 ' + room.name }));
    const section = el('section', { className: 'specter-room room-enter' },
      sceneEl,
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
      // Locked exits stay clickable: the engine answers with the room's
      // lockedMessage (or a default) so the player learns why.
      const exitBtn = btn(
        exit.locked ? `🔒 ${exit.name}` : `➜ ${exit.name}`,
        () => dispatch({ type: 'move', roomId: exit.id }),
        exit.locked ? 'btn-locked' : 'btn-exit',
        false
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
      // state.room.actions is already condition-filtered by the engine
      const visible = state.room.actions.some(a => a.id === action.id || a === action);
      if (!visible) continue;

      const actionBtn = btn(
        action.label,
        () => {
          const result = global.SpecterEngine.performRoomAction(action.id);
          if (result.message) {
            pushMessage(result.message, result.ok ? 'msg-ok' : 'msg-fail');
          }
          renderFull(result.state);
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

        // Hint button: highlights the environmental clue, never reveals the answer
        const hints = (global.SpecterEngine.getHintDetails && global.SpecterEngine.getHintDetails(event.id)) || [];
        if (hints.length > 0 || global.SpecterEngine.getHint(event.id)) {
          let hintIdx = 0;
          eventDiv.appendChild(btn('💡 Hint', () => {
            const h = hints.length > 0 ? hints[hintIdx++ % hints.length] : { text: global.SpecterEngine.getHint(event.id) };
            let highlighted = false;
            if (h.highlightText) {
              const desc = document.querySelector('.room-desc');
              if (desc && desc.textContent.includes(h.highlightText)) {
                const esc = s2 => s2.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
                desc.innerHTML = esc(desc.textContent).replace(esc(h.highlightText), '<span class="hint-flash">' + esc(h.highlightText) + '</span>');
                const scene = document.querySelector('.room-scene');
                if (scene) scene.classList.add('scene-hint');
                highlighted = true;
              }
            }
            if (highlighted) {
              pushMessage('You stop and study your surroundings more carefully…', 'msg-hint');
            } else if (h.text) {
              pushMessage('Hint: ' + h.text, 'msg-hint');
              renderFull(global.SpecterEngine.getState());
            }
          }, 'btn-hint'));
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
    // Evidence board: only for games with deduction definitions
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

    // Evidence entries render full text
    const clueList = el('div', { className: 'clue-entries' });
    for (const clue of clues) {
      clueList.appendChild(el('div', { className: 'clue-entry' },
        el('div', { className: 'clue-entry-name', textContent: clue.name || clue.id }),
        el('div', { className: 'clue-entry-desc', textContent: clue.description || '' })
      ));
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
    // Suspects read from window._specterGameData (set by the page boot)
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
        () => { if (!isActive) dispatch({ type: 'move', roomId: r.id }); },
        'btn-map' + (isActive ? ' btn-map-active' : '') + (r.locked ? ' btn-locked' : ''),
        isActive
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

    // Clear and rebuild. Copy the content theme onto root for per-game CSS.
    _root.dataset.theme = (state.meta && state.meta.theme) || 'default';
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
    renderMessages(leftCol); // messages live here — after content

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
