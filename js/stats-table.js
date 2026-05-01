// Stats table — shows all ship stats for the loaded account.
// Depends on: wows.js (WoWS.fetchAllShipStats, SHIP_TYPE_LABELS, NATION_LABELS)

const STAT_MODES = [
  { key: 'pvp',  label: 'Random', dataKey: 'pvp',       sortPrefix: 'pvp_',  thClass: 'th-random' },
  { key: 'rank', label: 'Ranked', dataKey: 'rank_solo', sortPrefix: 'rank_', thClass: 'th-ranked' },
  { key: 'pve',  label: 'Co-op',  dataKey: 'pve',       sortPrefix: 'pve_',  thClass: 'th-coop'   },
];

class StatsTable {
  constructor() {
    this._shipDetails = {};
    this._allStats    = [];
    this._merged      = [];
    this._sortCol     = 'pvp_battles';
    this._sortDir     = 'desc';
    this._loaded      = false;
    this._rowDataMap  = new WeakMap();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  init() {
    ['statsNationFilter', 'statsTierMin', 'statsTierMax'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this._render());
    });
    document.getElementById('statsTypeSelectAll')?.addEventListener('click', () => {
      const cbs = [...(document.querySelectorAll('#statsTypeCheckboxes input') || [])];
      const allOn = cbs.every(c => c.checked);
      cbs.forEach(c => { c.checked = !allOn; });
      this._render();
    });
    document.getElementById('statsLoadBtn')?.addEventListener('click', () => this._requestLoad());
    document.getElementById('statsResetBtn')?.addEventListener('click', () => this._resetFilters());
    ['statsSearch', 'statsMinBattles', 'statsWrMin', 'statsWrMax'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this._render());
    });

    document.querySelectorAll('#statsModeCheckboxes input').forEach(cb => {
      cb.addEventListener('change', () => this._render());
    });

    document.getElementById('shipDetailModal')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });
    document.getElementById('closeShipDetailBtn')?.addEventListener('click', () => {
      document.getElementById('shipDetailModal').style.display = 'none';
    });

    document.getElementById('statsTableBody')?.addEventListener('click', e => {
      const td = e.target.closest('td');
      if (!td) return;
      if (td.dataset.filterType) {
        document.querySelectorAll('#statsTypeCheckboxes input').forEach(cb => {
          cb.checked = cb.value === td.dataset.filterType;
        });
        this._render(); return;
      }
      if (td.dataset.filterNation) {
        const sel = document.getElementById('statsNationFilter');
        if (sel) { sel.value = td.dataset.filterNation; this._render(); } return;
      }
      if (td.dataset.filterTier) {
        ['statsTierMin', 'statsTierMax'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = td.dataset.filterTier;
        });
        this._render(); return;
      }
      if (td.classList.contains('td-name')) {
        const row = this._rowDataMap.get(td.closest('tr'));
        if (row) this._showShipModal(row);
      }
    });

    // Sort on column header click
    document.getElementById('statsTable')?.addEventListener('click', (e) => {
      const th = e.target.closest('th.sortable');
      if (!th) return;
      const col = th.dataset.col;
      if (this._sortCol === col) {
        this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this._sortCol = col;
        this._sortDir = col === 'name' || col === 'type' || col === 'nation' ? 'asc' : 'desc';
      }
      this._updateSortHeaders();
      this._render();
    });
  }

  // Called from ship-mode after ships are loaded — sets up ship detail lookup.
  setShips(ships) {
    this._shipDetails = {};
    for (const s of ships) this._shipDetails[s.ship_id] = s;
    this._populateFilters(ships);
    // Clear stale stats from previous player so they don't show for the new one
    if (this._loaded) {
      this._loaded   = false;
      this._allStats = [];
      this._merged   = [];
      const tableEl  = document.getElementById('statsTable');
      const statusEl = document.getElementById('statsStatus');
      if (tableEl)  tableEl.style.display  = 'none';
      if (statusEl) { statusEl.style.display = ''; statusEl.textContent = 'Click "Load Stats" to load stats for this player.'; statusEl.style.color = '#94a3b8'; }
    }
  }

  // Called by the "Load Stats" button (via _requestLoad) or from ship-mode.
  async loadStats(accountId, region, accessToken) {
    const statusEl = document.getElementById('statsStatus');
    const tableEl  = document.getElementById('statsTable');
    if (statusEl) { statusEl.style.display = ''; statusEl.textContent = 'Loading stats…'; statusEl.style.color = '#94a3b8'; }
    if (tableEl) tableEl.style.display = 'none';

    try {
      const raw = await WoWS.fetchAllShipStats(accountId, region, accessToken || null);
      if (raw === null) {
        this._setStatus('Statistics are hidden for this account.', 'error');
        return;
      }
      this._allStats = raw;
      this._merged   = raw
        .map(s => {
          const d = this._shipDetails[s.ship_id];
          if (!d) return null;
          return { ...d, ...s };
        })
        .filter(Boolean);
      this._loaded = true;
      if (statusEl) statusEl.style.display = 'none';
      if (tableEl)  tableEl.style.display  = '';
      this._render();
    } catch (err) {
      this._setStatus(`Error: ${err.message}`, 'error');
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _requestLoad() {
    if (window.shipMode) {
      const accountId   = window.shipMode.accountId;
      const region      = window.shipMode.region;
      const accessToken = window.shipMode._wgToken;
      if (!accountId) { this._setStatus('Load ships first.', 'error'); return; }
      this.loadStats(accountId, region, accessToken);
    }
  }

  _setStatus(msg, type) {
    const el = document.getElementById('statsStatus');
    if (!el) return;
    el.style.display = '';
    el.textContent   = msg;
    el.style.color   = type === 'error' ? '#ef4444' : type === 'ok' ? '#10b981' : '#94a3b8';
  }

  _getFilters() {
    const nation  = document.getElementById('statsNationFilter')?.value || '';
    const tierMin = parseInt(document.getElementById('statsTierMin')?.value || '') || 0;
    const tierMax = parseInt(document.getElementById('statsTierMax')?.value || '') || 0;
    const boxes   = [...document.querySelectorAll('#statsTypeCheckboxes input')];
    let types = null;
    if (boxes.length) {
      const checked = boxes.filter(b => b.checked).map(b => b.value);
      if (checked.length < boxes.length) types = new Set(checked);
    }
    const search     = (document.getElementById('statsSearch')?.value || '').trim().toLowerCase();
    const minBattles = parseInt(document.getElementById('statsMinBattles')?.value || '') || 0;
    const wrMinRaw   = document.getElementById('statsWrMin')?.value;
    const wrMaxRaw   = document.getElementById('statsWrMax')?.value;
    const wrMin      = wrMinRaw !== '' && wrMinRaw != null ? parseFloat(wrMinRaw) : null;
    const wrMax      = wrMaxRaw !== '' && wrMaxRaw != null ? parseFloat(wrMaxRaw) : null;
    const modes      = this._getActiveModes();
    const primary    = modes.find(m => this._sortCol.startsWith(m.sortPrefix)) || modes[0];
    return { nation, tierMin, tierMax, types, search, minBattles, wrMin, wrMax, primaryDataKey: primary?.dataKey || 'pvp' };
  }

  _getFiltered() {
    const f = this._getFilters();
    return this._merged.filter(s => {
      if (f.nation  && s.nation !== f.nation)        return false;
      if (f.tierMin && s.tier   < f.tierMin)         return false;
      if (f.tierMax && s.tier   > f.tierMax)         return false;
      if (f.types   && !f.types.has(s.type))                    return false;
      if (f.search  && !s.name.toLowerCase().includes(f.search)) return false;
      if (f.minBattles || f.wrMin !== null || f.wrMax !== null) {
        const d = s[f.primaryDataKey];
        if (f.minBattles && (!d?.battles || d.battles < f.minBattles)) return false;
        if (f.wrMin !== null || f.wrMax !== null) {
          const wr = d?.battles ? d.wins / d.battles * 100 : null;
          if (wr === null) return false;
          if (f.wrMin !== null && wr < f.wrMin) return false;
          if (f.wrMax !== null && wr > f.wrMax) return false;
        }
      }
      return true;
    });
  }

  _colValue(row, col) {
    switch (col) {
      case 'name':    return row.name || '';
      case 'tier':    return row.tier || 0;
      case 'type':    return WoWS.SHIP_TYPE_LABELS[row.type] || row.type || '';
      case 'nation':  return WoWS.NATION_LABELS[row.nation] || row.nation || '';
      case 'pvp_battles': return row.pvp?.battles || 0;
      case 'pvp_wr':      return row.pvp?.battles ? row.pvp.wins / row.pvp.battles : 0;
      case 'pvp_dmg':     return row.pvp?.battles ? row.pvp.damage_dealt / row.pvp.battles : 0;
      case 'pvp_kills':   return row.pvp?.battles ? row.pvp.frags / row.pvp.battles : 0;
      case 'rank_battles': return row.rank_solo?.battles || 0;
      case 'rank_wr':      return row.rank_solo?.battles ? row.rank_solo.wins / row.rank_solo.battles : 0;
      case 'rank_dmg':     return row.rank_solo?.battles ? row.rank_solo.damage_dealt / row.rank_solo.battles : 0;
      case 'rank_kills':   return row.rank_solo?.battles ? row.rank_solo.frags / row.rank_solo.battles : 0;
      case 'pve_battles': return row.pve?.battles || 0;
      case 'pve_wr':      return row.pve?.battles ? row.pve.wins / row.pve.battles : 0;
      case 'pve_dmg':     return row.pve?.battles ? row.pve.damage_dealt / row.pve.battles : 0;
      case 'pve_kills':   return row.pve?.battles ? row.pve.frags / row.pve.battles : 0;
      default: return 0;
    }
  }

  _getActiveModes() {
    return STAT_MODES.filter(m => {
      const cb = document.querySelector(`#statsModeCheckboxes input[value="${m.key}"]`);
      return cb ? cb.checked : true;
    });
  }

  _rebuildHeader(modes) {
    const thead = document.getElementById('statsTableHead');
    if (!thead) return;
    const baseCols = `
      <th rowspan="2" class="sortable th-name" data-col="name">Ship <span class="sort-icon"></span></th>
      <th rowspan="2" class="th-prem" title="Premium / Special">★</th>
      <th rowspan="2" class="sortable th-tier" data-col="tier">Tier <span class="sort-icon"></span></th>
      <th rowspan="2" class="sortable th-type" data-col="type">Type <span class="sort-icon"></span></th>
      <th rowspan="2" class="sortable th-nation" data-col="nation">Nation <span class="sort-icon"></span></th>`;
    const groupHeaders = modes.map(m => `<th colspan="4" class="th-group ${m.thClass}">${m.label}</th>`).join('');
    const subHeaders = modes.map(m => `
      <th class="sortable th-sub" data-col="${m.sortPrefix}battles">Battles <span class="sort-icon"></span></th>
      <th class="sortable th-sub" data-col="${m.sortPrefix}wr">Win% <span class="sort-icon"></span></th>
      <th class="sortable th-sub" data-col="${m.sortPrefix}dmg">Avg Dmg <span class="sort-icon"></span></th>
      <th class="sortable th-sub" data-col="${m.sortPrefix}kills">Avg Kills <span class="sort-icon"></span></th>`).join('');
    thead.innerHTML = `<tr>${baseCols}${groupHeaders}</tr><tr>${subHeaders}</tr>`;
    this._updateSortHeaders();
    // Measure first row after layout is complete, then pin sub-headers below it
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const firstRow = thead.querySelector('tr:first-child');
      if (!firstRow) return;
      const h = firstRow.getBoundingClientRect().height;
      if (h > 0) thead.querySelectorAll('tr:last-child th').forEach(th => { th.style.top = `${h}px`; });
    }));
  }

  _render() {
    if (!this._loaded) return;
    const tbody = document.getElementById('statsTableBody');
    if (!tbody) return;

    const modes = this._getActiveModes();

    // If current sort column belongs to a hidden mode, fall back to pvp_battles or name
    const activePrefix = modes.map(m => m.sortPrefix);
    const colIsBase = ['name','tier','type','nation'].includes(this._sortCol);
    if (!colIsBase && !activePrefix.some(p => this._sortCol.startsWith(p))) {
      this._sortCol = modes.length ? `${modes[0].sortPrefix}battles` : 'name';
    }

    this._rebuildHeader(modes);

    const data = this._getFiltered();
    const col  = this._sortCol;
    const dir  = this._sortDir === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      const av = this._colValue(a, col);
      const bv = this._colValue(b, col);
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });

    tbody.innerHTML = '';
    for (const row of data) {
      tbody.appendChild(this._buildRow(row, modes));
    }
  }

  _statCells(data) {
    if (!data?.battles) {
      return `<td class="td-na td-sep">—</td><td class="td-na"></td><td class="td-na"></td><td class="td-na"></td>`;
    }
    const wr       = data.wins / data.battles * 100;
    const wrCls    = wr >= 60 ? 'wr-great' : wr >= 50 ? 'wr-good' : 'wr-bad';
    const avgDmg   = Math.round(data.damage_dealt / data.battles).toLocaleString();
    const avgKills = (data.frags / data.battles).toFixed(2);
    return `
      <td class="td-num td-sep">${data.battles.toLocaleString()}</td>
      <td class="td-wr ${wrCls}">${wr.toFixed(1)}%</td>
      <td class="td-num">${avgDmg}</td>
      <td class="td-num">${avgKills}</td>`;
  }

  _buildRow(row, modes) {
    const tr = document.createElement('tr');
    this._rowDataMap.set(tr, row);
    const modeCells = modes.map(m => this._statCells(row[m.dataKey])).join('');
    const iconUrl   = WoWS.NATION_ICONS[row.nation] || '';
    const nation    = WoWS.NATION_LABELS[row.nation] || row.nation;
    const flagHtml  = iconUrl ? `<img src="${iconUrl}" class="nation-flag-img" alt="${nation}" />` : '';
    const premCell  = row.is_special ? '<td class="td-prem td-prem-special" title="Special">✦</td>'
                    : row.is_premium ? '<td class="td-prem td-prem-premium" title="Premium">★</td>'
                    : '<td class="td-prem"></td>';
    tr.innerHTML = `
      <td class="td-name td-clickable" title="Click for details">${row.name}</td>
      ${premCell}
      <td class="td-tier td-clickable" data-filter-tier="${row.tier}" title="Filter by this tier">${this._roman(row.tier)}</td>
      <td class="td-type td-clickable" data-filter-type="${row.type}" title="Filter by this type">${WoWS.SHIP_TYPE_LABELS[row.type] || row.type}</td>
      <td class="td-nation td-clickable" data-filter-nation="${row.nation}" title="Filter by this nation">${flagHtml}${nation}</td>
      ${modeCells}`;
    return tr;
  }

  _resetFilters() {
    ['statsSearch', 'statsMinBattles', 'statsWrMin', 'statsWrMax'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const nation = document.getElementById('statsNationFilter');
    if (nation) nation.value = '';
    ['statsTierMin', 'statsTierMax'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.querySelectorAll('#statsTypeCheckboxes input, #statsModeCheckboxes input').forEach(cb => {
      cb.checked = true;
    });
    this._render();
  }

  _showShipModal(row) {
    const modal = document.getElementById('shipDetailModal');
    if (!modal) return;
    const url = row.images?.medium || row.images?.small || '';
    const imgEl = document.getElementById('shipDetailImage');
    if (imgEl) { imgEl.src = url; imgEl.style.display = url ? '' : 'none'; }
    document.getElementById('shipDetailTier').textContent = `Tier ${this._roman(row.tier)}`;
    document.getElementById('shipDetailName').textContent = row.name;
    const iconUrl  = WoWS.NATION_ICONS[row.nation] || '';
    const flagHtml = iconUrl ? `<img src="${iconUrl}" class="nation-flag-img" alt="" />` : '';
    const premLabel = row.is_special ? ' · Special' : row.is_premium ? ' · Premium' : '';
    document.getElementById('shipDetailMeta').innerHTML =
      `${flagHtml}${WoWS.NATION_LABELS[row.nation] || row.nation} · ${WoWS.SHIP_TYPE_LABELS[row.type] || row.type}${premLabel}`;
    const statsEl = document.getElementById('shipDetailStats');
    if (statsEl) {
      statsEl.innerHTML = this._getActiveModes().map(m => {
        const d = row[m.dataKey];
        if (!d?.battles) return `<div class="ship-stat-row"><span class="ship-stat-label">${m.label}</span><span style="color:#475569">—</span></div>`;
        const wr  = (d.wins / d.battles * 100).toFixed(1);
        const cls = wr >= 60 ? 'wr-great' : wr >= 50 ? 'wr-good' : 'wr-bad';
        const dmg = Math.round(d.damage_dealt / d.battles).toLocaleString();
        return `<div class="ship-stat-row">
          <span class="ship-stat-label">${m.label}</span>
          <span class="ship-stat-val ${cls}">${wr}%</span>
          <span class="ship-stat-battles">${d.battles.toLocaleString()} battles · ${dmg} avg dmg · ${(d.frags/d.battles).toFixed(2)} avg kills</span>
        </div>`;
      }).join('');
    }
    modal.style.display = 'flex';
  }

  _roman(n) {
    const pairs = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let v = Number(n), r = '';
    for (const [num, sym] of pairs) while (v >= num) { r += sym; v -= num; }
    return r || String(n);
  }

  _updateSortHeaders() {
    document.querySelectorAll('#statsTable th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.col === this._sortCol) {
        th.classList.add(this._sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  // ── Filter population ─────────────────────────────────────────────────────

  _populateFilters(ships) {
    this._populateNationFilter(ships);
    this._populateTierSelects(ships);
    this._populateTypeCheckboxes(ships);
  }

  _populateNationFilter(ships) {
    const el = document.getElementById('statsNationFilter');
    if (!el) return;
    const nations = [...new Set(ships.map(s => s.nation))].sort();
    el.innerHTML = '<option value="">All nations</option>';
    nations.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = WoWS.NATION_LABELS[n] || n;
      el.appendChild(opt);
    });
  }

  _populateTierSelects(ships) {
    const tiers = [...new Set(ships.map(s => s.tier))].sort((a, b) => a - b);
    ['statsTierMin', 'statsTierMax'].forEach((id, idx) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<option value="">${idx === 0 ? 'From' : 'To'}</option>`;
      tiers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = `Tier ${this._roman(t)}`;
        el.appendChild(opt);
      });
    });
  }

  _populateTypeCheckboxes(ships) {
    const container = document.getElementById('statsTypeCheckboxes');
    if (!container) return;
    const knownOrder = ['AirCarrier', 'Battleship', 'Cruiser', 'Destroyer', 'Submarine'];
    const present = new Set(ships.map(s => s.type));
    const extra = [...present].filter(t => !knownOrder.includes(t)).sort();
    const types = [...knownOrder.filter(t => present.has(t)), ...extra];
    container.innerHTML = '';
    types.forEach(type => {
      const label = document.createElement('label');
      label.className = 'ship-type-cb-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = type;
      cb.checked = true;
      cb.addEventListener('change', () => this._render());
      label.appendChild(cb);
      label.appendChild(document.createTextNode(WoWS.SHIP_TYPE_LABELS[type] || type));
      container.appendChild(label);
    });
  }
}
