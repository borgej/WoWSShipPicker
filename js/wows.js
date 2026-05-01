// World of Warships API client.
// Calls are proxied through server.js which injects application_id server-side.
const WoWS = (() => {
  const BASES = {
    eu:   'https://api.worldofwarships.eu',
    na:   'https://api.worldofwarships.com',
    asia: 'https://api.worldofwarships.asia',
    ru:   'https://api.worldofwarships.ru',
  };

  function _base(region) { return BASES[region] || BASES.eu; }

  // All API calls go through the local proxy so application_id is injected server-side.
  async function _get(region, endpoint, params) {
    const qs = new URLSearchParams({ ...params, region });
    const r = await fetch(`${APP_CONFIG.basePath}/api/wows/${endpoint}?${qs}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.status !== 'ok') throw new Error(j.error?.message || j.error?.code || 'WoWS API error');
    return j.data;
  }

  async function lookupPlayer(username, region) {
    const data = await _get(region, 'account/list/', { search: username, type: 'exact', fields: 'account_id,nickname' });
    if (!Array.isArray(data) || !data.length) throw new Error(`Player "${username}" not found on ${region.toUpperCase()}`);
    return data[0];
  }

  async function fetchPlayerShipIds(accountId, region, accessToken) {
    const params = { account_id: accountId, fields: 'ship_id' };
    if (accessToken) { params.access_token = accessToken; params.in_garage = 1; }
    const data = await _get(region, 'ships/stats/', params);
    const ships = data[String(accountId)];
    if (ships === null) return null;
    if (!ships) return [];
    return ships.map(s => s.ship_id);
  }

  function authLoginUrl(region, redirectUri) {
    const params = new URLSearchParams({ application_id: '(injected)', redirect_uri: redirectUri, expires_at: 1209600 });
    return `${_base(region)}/wows/auth/login/?${params}`;
  }

  async function fetchShipStats(accountId, shipId, region) {
    const data = await _get(region, 'ships/stats/', {
      account_id: accountId,
      ship_id:    String(shipId),
      fields:     'pvp.wins,pvp.battles,rank_solo.wins,rank_solo.battles',
      extra:      'rank_solo',
    });
    const ships = data[String(accountId)];
    if (!ships || !ships.length) return null;
    return ships[0];
  }

  // Returns all ship stats for an account — pvp (random), rank_solo (ranked), pve (co-op).
  async function fetchAllShipStats(accountId, region, accessToken) {
    const params = {
      account_id: accountId,
      fields: [
        'ship_id',
        'pvp.battles', 'pvp.wins', 'pvp.damage_dealt', 'pvp.frags',
        'rank_solo.battles', 'rank_solo.wins', 'rank_solo.damage_dealt', 'rank_solo.frags',
        'pve.battles', 'pve.wins', 'pve.damage_dealt', 'pve.frags',
      ].join(','),
      extra: 'rank_solo,pve',
    };
    if (accessToken) params.access_token = accessToken;
    const data = await _get(region, 'ships/stats/', params);
    const ships = data[String(accountId)];
    if (ships === null) return null;
    if (!ships) return [];
    return ships;
  }

  async function fetchShipDetails(shipIds, region) {
    const all = [];
    for (let i = 0; i < shipIds.length; i += 100) {
      const batch = shipIds.slice(i, i + 100);
      const data = await _get(region, 'encyclopedia/ships/', {
        ship_id:  batch.join(','),
        fields:   'ship_id,name,tier,type,nation,images,is_premium,is_special',
        language: 'en',
      });
      all.push(...Object.values(data).filter(Boolean));
    }
    return all;
  }

  const SHIP_TYPE_LABELS = {
    AirCarrier: 'CV',
    Battleship: 'Battleship',
    Cruiser:    'Cruiser',
    Destroyer:  'Destroyer',
    Submarine:  'Submarine',
  };

  const NATION_LABELS = {
    usa:          'USA',
    japan:        'Japan',
    ussr:         'USSR',
    germany:      'Germany',
    uk:           'UK',
    france:       'France',
    italy:        'Italy',
    pan_asia:     'Pan-Asia',
    europe:       'Europe',
    netherlands:  'Netherlands',
    spain:        'Spain',
    commonwealth: 'Commonwealth',
    pan_america:  'Pan-America',
    common:       'Common',
  };

  const NATION_ICONS = {};

  async function loadNationIcons(region) {
    if (Object.keys(NATION_ICONS).length) return;
    try {
      const data = await _get(region, 'encyclopedia/info/', { fields: 'nations' });
      for (const [key, val] of Object.entries(data?.nations || {})) {
        NATION_ICONS[key] = val?.icons?.small || val?.icons?.medium || '';
      }
    } catch {}
  }

  return {
    lookupPlayer, fetchPlayerShipIds, fetchShipDetails, fetchShipStats, fetchAllShipStats,
    authLoginUrl, loadNationIcons, SHIP_TYPE_LABELS, NATION_LABELS, NATION_ICONS,
  };
})();
