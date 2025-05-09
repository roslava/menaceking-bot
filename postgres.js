const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function saveToPostgres(userId, data) {
    const client = await pool.connect();
    try {
        console.log('Attempting to save to PostgreSQL:', { userId, data });
        await client.query('BEGIN');
        const queryText = `
            INSERT INTO partners (user_id, contact, company, traffic, geo, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id)
            DO UPDATE SET
                contact = EXCLUDED.contact,
                company = EXCLUDED.company,
                traffic = EXCLUDED.traffic,
                geo = EXCLUDED.geo,
                timestamp = EXCLUDED.timestamp
            RETURNING *;
        `;
        const values = [
            userId,
            data.contact || 'N/A',
            data.company || 'N/A',
            data.traffic || 'N/A',
            data.geo || 'N/A',
            data.timestamp || new Date().toISOString()
        ];
        console.log('Executing query:', queryText, values);
        const res = await client.query(queryText, values);
        await client.query('COMMIT');
        console.log('Data saved to PostgreSQL:', res.rows[0]);
        return { id: res.rows[0].id, data: res.rows[0] };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving to PostgreSQL:', err);
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { saveToPostgres };