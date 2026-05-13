const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    try {
      let result;
      if (request.method === 'POST') {
        result = await submitShift(env, await request.json());
      } else if (action === 'getProducts') {
        result = await getProducts(env);
      } else if (action === 'lastShift') {
        result = await getLastShift(env, url.searchParams.get('vi_tri'));
      } else if (action === 'getUsers') {
        result = await getUsers(env);
      } else {
        result = { success: true };
      }
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({ success: false, error: err.message }, 500);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function sb(env, path, opts = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer ?? '',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function getProducts(env) {
  const rows = await sb(env,
    '/products?select=name,price,product_locations(locations(name))&active=eq.true&order=sort_order.asc'
  );
  const products = rows.map(p => {
    const locationNames = p.product_locations.map(pl => pl.locations.name);
    return {
      ten: p.name,
      gia: p.price,
      binh_tan: locationNames.includes('Bình Tân'),
      quan_6: locationNames.includes('Quận 6'),
    };
  });
  return { success: true, products };
}

async function getUsers(env) {
  const rows = await sb(env, '/users?select=email');
  return { success: true, emails: rows.map(r => r.email.toLowerCase()) };
}

async function getLastShift(env, vi_tri) {
  if (!vi_tri) return { success: false, error: 'vi_tri required' };

  const locs = await sb(env,
    `/locations?name=eq.${encodeURIComponent(vi_tri)}&select=id`
  );
  if (!locs.length) return { success: false, error: `Unknown location: ${vi_tri}` };

  const shifts = await sb(env,
    `/shifts?location_id=eq.${locs[0].id}&select=id,date,staff_name&order=created_at.desc&limit=1`
  );
  if (!shifts.length) return { success: false, error: 'Chưa có ca nào được lưu' };

  const sps = await sb(env,
    `/shift_products?shift_id=eq.${shifts[0].id}&select=closing_actual&order=position.asc`
  );

  return {
    success: true,
    ngay: shifts[0].date,
    ten: shifts[0].staff_name,
    products: sps.map(sp => ({
      cuoi_thuc: sp.closing_actual !== null ? sp.closing_actual : undefined,
    })),
  };
}

async function submitShift(env, data) {
  return { success: false, error: 'not implemented' }; // stub — implemented in Task 7
}
