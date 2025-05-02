const admin = require('firebase-admin');

function initializeFirebase() {
    if (!admin.apps.length) {
        const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }
    return admin.database();
}

async function saveToFirebase(data) {
    try {
        const db = initializeFirebase();
        const ref = db.ref('partners');

        // Prepare data for saving
        const newData = {
            contact: data.contact || 'N/A',
            company: data.company || 'N/A',
            traffic: data.traffic || 'N/A', // Принимаем как строку
            geo: data.geo || 'N/A', // Принимаем как строку
            timestamp: new Date().toISOString()
        };

        // Save with a unique key (push)
        const newRef = await ref.push(newData);

        console.log('Data saved to Firebase:', newData, 'Key:', newRef.key);
        return { key: newRef.key, data: newData };
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        throw error;
    }
}

module.exports = { saveToFirebase };