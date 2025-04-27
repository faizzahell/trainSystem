import fetch from 'node-fetch';
import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.API_KEY;
const PROJECT_ID = process.env.PROJECT_ID;
const DOCUMENT_PATH = process.env.DOCUMENT_PATH;

const fetchGPS = async () => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${DOCUMENT_PATH}?key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        const fields = json.fields;

        const gpsData = {
            lat: parseFloat(fields.lat.doubleValue),
            lng: parseFloat(fields.lng.doubleValue),
            speed: parseFloat(fields.speed.doubleValue),
            altitude: parseFloat(fields.altitude.doubleValue),
            satellites: parseInt(fields.satellites.integerValue),
            course: parseFloat(fields.course.doubleValue),
        };
        return gpsData;
    } catch (err) {
        console.error("Gagal ambil data GPS:", err);
        return null;
    }
};

const sendToLabVIEW = (data) => {
    const client = new net.Socket();
    client.connect(6000, '192.168.100.84', () => {
        const message = `${data.lat};${data.lng};${data.speed};${data.altitude};${data.satellites};${data.course}\n`;
        client.write(message);
        client.end();
    });

    client.on('error', (err) => {
        console.error('TCP Error:', err.message);
    });

    client.on('close', () => {
        console.log('Koneksi TCP ditutup');
    });
};

// Fungsi untuk mengirim data status dan value ke port 6002
const sendStatusToPort6002 = (status, value) => {
    const client = new net.Socket();
    client.connect(6002, 'localhost', () => {
        const message = `${status};${value}\n`;
        client.write(message);
        // client.end();
        console.log(`Berhasil mengirim data: ${status} dan ${value}`)
    });

    client.on('error', (err) => {
        console.error('TCP Error:', err.message);
    });

    client.on('close', () => {
        console.log('Koneksi TCP ditutup ke port 6002');
    });
};

const server = net.createServer((socket) => {
    console.log('LabVIEW terhubung ke server Raspberry Pi');

    socket.on('data', (data) => {
        const command = data.toString().trim();
        const parts = command.split(";");

        const status = parseInt(parts[0]);
        const value = parseInt(parts[1]);

        console.log(`Status Barrier: ${status}`);
        console.log(`Value Barrier : ${value}`);

        // Kirim data status dan value ke port 6002
        sendStatusToPort6002(status, value);
    });

    socket.on('close', () => {
        console.log('Koneksi LabVIEW ditutup');
    });

    socket.on('error', (err) => {
        console.error('Socket Error:', err.message);
    });
});

server.listen(6001, () => {
    console.log('Server Raspberry Pi menunggu perintah di port 6001');
});

setInterval(async () => {
    const gps = await fetchGPS();
    if (gps) {
        console.log('GPS:', gps);
        sendToLabVIEW(gps);
    }
}, 1000);
