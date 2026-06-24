const ADNET_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBUqHKr6vuXqKr5cWMkSM5oTxG1LgPzFEw",
    authDomain: "indranex-ads-network.firebaseapp.com",
    databaseURL: "https://indranex-ads-network-default-rtdb.firebaseio.com",
    projectId: "indranex-ads-network",
    storageBucket: "indranex-ads-network.firebasestorage.app",
    messagingSenderId: "665770384201",
    appId: "1:665770384201:web:0126de06a6919e9f1e1898"
};

const ADNET_DATABASE_URL = "https://indranex-ads-network-default-rtdb.firebaseio.com";

let adnetApp = null;
let adnetDb = null;

function adnetInitFirebase() {
    if (!adnetApp) {
        firebase.initializeApp(ADNET_FIREBASE_CONFIG);
        adnetApp = firebase.app();
        adnetDb = firebase.database();
    }
    return { app: adnetApp, db: adnetDb };
}

async function adnetSha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function adnetGetDb() {
    if (!adnetDb) adnetInitFirebase();
    return adnetDb;
}

function adnetRef(path) {
    return adnetGetDb().ref(path);
}

async function adnetVerifyPassword(password) {
    const hash = await adnetSha256(password);
    try {
        const snapshot = await adnetRef('admin/password').once('value');
        const storedHash = snapshot.val();
        return hash === storedHash;
    } catch (e) {
        return false;
    }
}

async function adnetFetchAPI(path) {
    const url = `${ADNET_DATABASE_URL}${path}.json`;
    const res = await fetch(url);
    return res.json();
}

async function adnetPostAPI(path, data) {
    const url = `${ADNET_DATABASE_URL}${path}.json`;
    const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
}
