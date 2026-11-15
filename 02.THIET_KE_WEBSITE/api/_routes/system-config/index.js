import { endpoint } from '../../_lib/http.js';
import { getPool } from '../../_lib/database.js';

// GET /api/system-config
export default endpoint({
  path: '/api/system-config',
  methods: ['GET'],
  roles: ['OWNER'],
  handler: async () => {
    const rows = (await getPool().request().query('SELECT maCauHinh AS [key],giaTri AS value,kieuGiaTri AS valueType,moTa AS description,capNhatLuc AS updatedAt FROM dbo.CauHinhHeThong ORDER BY maCauHinh')).recordset;
    return { data: rows.map((row) => ({ ...row, value: row.valueType === 'number' ? Number(row.value) : row.value })) };
  },
});
