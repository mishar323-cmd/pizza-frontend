// Delivery zone definitions + geocoding helpers.
// Single source of truth for both the public map (delivery-map.jsx)
// and the checkout flow (menu.jsx CheckoutModal, App.jsx).

export const YMAPS_APIKEY = '377a4a65-0532-44a8-9ff7-d6877c155757';
export const ORIGIN = [55.767003, 37.236615];

export const ZONES = [
  {
    id: 'A',
    name: 'Зона А · ЖК «Новая Рига»',
    short: 'Зона А',
    deliveryPrice: 0,
    freeFrom: 500,
    eta: 30,
    color: '#DC2828',
    polygon: [
      [55.7690, 37.2340], [55.7715, 37.2380], [55.7722, 37.2430],
      [55.7718, 37.2475], [55.7705, 37.2495], [55.7685, 37.2500],
      [55.7665, 37.2495], [55.7650, 37.2480], [55.7642, 37.2450],
      [55.7640, 37.2420], [55.7644, 37.2385], [55.7652, 37.2355],
      [55.7665, 37.2335], [55.7680, 37.2330], [55.7690, 37.2340],
    ],
  },
  {
    id: 'B',
    name: 'Зона Б · Глухово и окрестности',
    short: 'Зона Б',
    deliveryPrice: 300,
    freeFrom: 3000,
    eta: 60,
    color: '#1B4DBF',
    polygon: [
      [55.7955, 37.2050], [55.7950, 37.2300], [55.7935, 37.2545],
      [55.7900, 37.2750], [55.7720, 37.2800], [55.7400, 37.2820],
      [55.7280, 37.2700], [55.7250, 37.2400], [55.7270, 37.2100],
      [55.7330, 37.1900], [55.7555, 37.1700], [55.7755, 37.1655],
      [55.7900, 37.1755], [55.7955, 37.2050],
    ],
  },
  {
    id: 'C',
    name: 'Зона В · 10 км от пиццерии',
    short: 'Зона В',
    deliveryPrice: 600,
    freeFrom: 5000,
    eta: 60,
    color: '#666',
    circle: { center: ORIGIN, radius: 10000 },
  },
];

// Ray-casting algorithm. p, poly entries are [lat, lng] — treated as 2D x,y.
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      ((yi > p[1]) !== (yj > p[1])) &&
      (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Haversine distance in meters between two [lat, lng] points.
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(a[0]);
  const φ2 = toRad(b[0]);
  const dφ = toRad(b[0] - a[0]);
  const dλ = toRad(b[1] - a[1]);
  const s = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// Returns the matching zone (smallest first → most specific wins). Null if out of all zones.
export function findZoneByCoords(coords) {
  if (!coords) return null;
  for (const z of ZONES) {
    if (z.polygon && pointInPolygon(coords, z.polygon)) return z;
  }
  for (const z of ZONES) {
    if (z.circle && distanceMeters(coords, z.circle.center) <= z.circle.radius) return z;
  }
  return null;
}

// price = number, free = boolean (free delivery threshold hit)
export function computeDelivery(zone, total) {
  if (!zone) {
    // Out-of-zone: fall back to max zone — operator can adjust manually.
    const max = ZONES[ZONES.length - 1];
    return {
      price: max.deliveryPrice,
      free: false,
      zoneId: null,
      zoneName: 'Адрес вне основных зон',
      eta: null,
      fallback: true,
    };
  }
  const free = total >= zone.freeFrom;
  return {
    price: free ? 0 : zone.deliveryPrice,
    free,
    zoneId: zone.id,
    zoneName: zone.name,
    eta: zone.eta,
    fallback: false,
  };
}

// Lazy-load Yandex Maps API. Idempotent across components.
let ymapsPromise = null;
export function ensureYmaps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.ymaps && window.ymaps.geocode) return Promise.resolve(window.ymaps);
  if (ymapsPromise) return ymapsPromise;
  ymapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ymaps]');
    const onLoaded = () => window.ymaps.ready(() => resolve(window.ymaps));
    if (existing) {
      if (window.ymaps && window.ymaps.geocode) onLoaded();
      else existing.addEventListener('load', onLoaded, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${YMAPS_APIKEY}&lang=ru_RU`;
    s.async = true;
    s.dataset.ymaps = '1';
    s.onload = onLoaded;
    s.onerror = () => {
      ymapsPromise = null;
      reject(new Error('ymaps load failed'));
    };
    document.head.appendChild(s);
  });
  return ymapsPromise;
}

// Geocode a free-form address. Returns [lat, lng] or null if not found.
// Adds "Красногорск" hint for ambiguous local street names.
export async function geocodeAddress(address) {
  const q = (address || '').trim();
  if (q.length < 3) return null;
  const ymaps = await ensureYmaps();
  const hinted = /красногорск|глухово|москва|россия/i.test(q) ? q : `Красногорск, ${q}`;
  const result = await ymaps.geocode(hinted, { results: 1, boundedBy: [[55.65, 37.05], [55.85, 37.40]] });
  const obj = result.geoObjects.get(0);
  if (!obj) return null;
  return obj.geometry.getCoordinates();
}
