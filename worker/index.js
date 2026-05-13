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
  // 1. Resolve location_id
  const locs = await sb(env,
    `/locations?name=eq.${encodeURIComponent(data.vi_tri || '')}&select=id`
  );
  if (!locs.length) throw new Error(`Unknown location: ${data.vi_tri}`);
  const location_id = locs[0].id;

  // 2. All products in global order (same order as getProducts / allProducts in frontend)
  const allProducts = await sb(env,
    `/products?select=id,price,product_locations(locations(name))&active=eq.true&order=sort_order.asc`
  );

  // 3. Filter to location's products (preserve global index as idx)
  const locationProds = allProducts
    .map((p, idx) => ({
      id: p.id,
      price: p.price,
      idx,
      inLocation: p.product_locations.some(pl => pl.locations.name === data.vi_tri),
    }))
    .filter(p => p.inLocation);

  // 4. Compute per-product rows
  const dataProds = data.products || [];
  let totalSales = 0;

  const shiftProductRows = locationProds.map((p, locIdx) => {
    const v             = dataProds[p.idx] || {};
    const openingShelf  = Number(v.dau_h1)   || 0;
    const openingShelf2 = Number(v.dau_h2)   || 0;
    const openingStock  = Number(v.dau_kho)  || 0;
    const openingBox    = Number(v.dau_cu)   || 0;
    const sold          = Number(v.xuat)     || 0;
    const received      = Number(v.nhap)     || 0;
    const damaged       = Number(v.hu)       || 0;
    const promo         = Number(v.km)       || 0;
    const transferred   = Number(v.chuyen)   || 0;
    const closingActual = (v.cuoi_thuc !== undefined && v.cuoi_thuc !== '')
      ? Number(v.cuoi_thuc) : null;
    const expected    = openingShelf + openingShelf2 + openingStock + openingBox
                        + received - sold - damaged - promo - transferred;
    const discrepancy = closingActual !== null ? closingActual - expected : null;
    const consumed    = closingActual !== null
      ? Math.max(0, openingShelf + openingShelf2 + openingStock + openingBox
                     + received - damaged - promo - transferred - closingActual)
      : sold;
    const revenue = consumed * p.price;
    totalSales   += revenue;
    return {
      product_id: p.id,
      position: locIdx,
      opening_shelf: openingShelf,
      opening_shelf2: openingShelf2,
      opening_stock: openingStock,
      opening_box: openingBox,
      sold,
      received,
      damaged,
      promo,
      transferred,
      closing_actual: closingActual,
      closing_expected: expected,
      discrepancy,
      consumed,
      revenue,
    };
  });

  // 5. Compute cash totals
  const tienDau  = data.tien_dau  || {};
  const tienCuoi = data.tien_cuoi || {};
  const catDt    = data.cat_dt    || {};
  let cashOpen = 0, cashClose = 0, cashStored = 0;
  DENOMS.forEach(d => {
    cashOpen   += (Number(tienDau[d])  || 0) * d;
    cashClose  += (Number(tienCuoi[d]) || 0) * d;
    cashStored += (Number(catDt[d])    || 0) * d;
  });
  const expenses    = Number(data.chi_phi) || 0;
  const bankSales   = Number(data.dt_nh)   || 0;
  const cashDiff    = cashClose - (cashOpen + (totalSales - bankSales) - expenses);
  const cashRemain  = cashClose - cashStored;

  // 6. Insert shift row
  const shiftDate = data.ngay || new Date().toISOString().split('T')[0];
  const shifts = await sb(env, '/shifts', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify({
      date: shiftDate,
      location_id,
      staff_name:  data.ten || '',
      expenses,
      bank_sales:  bankSales,
      total_sales: totalSales,
      cash_diff:   cashDiff,
      cash_stored: cashStored,
      cash_remain: cashRemain,
      notes:       data.ghi_chu || null,
    }),
  });
  const shift_id = shifts[0].id;

  // 7. Insert shift_products
  await sb(env, '/shift_products', {
    method: 'POST',
    body: JSON.stringify(shiftProductRows.map(r => ({ ...r, shift_id }))),
  });

  // 8. Insert shift_cash (9 denoms × 3 types = 27 rows)
  const cashRows = [];
  DENOMS.forEach(d => {
    cashRows.push({ shift_id, type: 'opening', denomination: d, count: Number(tienDau[d])  || 0 });
    cashRows.push({ shift_id, type: 'closing', denomination: d, count: Number(tienCuoi[d]) || 0 });
    cashRows.push({ shift_id, type: 'stored',  denomination: d, count: Number(catDt[d])    || 0 });
  });
  await sb(env, '/shift_cash', { method: 'POST', body: JSON.stringify(cashRows) });

  // 9. Insert shift_expenses (if any)
  const expItems = data.chi_phi_items || [];
  if (expItems.length) {
    await sb(env, '/shift_expenses', {
      method: 'POST',
      body: JSON.stringify(expItems.map(item => ({
        shift_id,
        category: item.type  || null,
        notes:    item.note  || null,
        amount:   Number(item.amount) || 0,
      }))),
    });
  }

  return { success: true, message: 'Đã lưu ca thành công!' };
}
