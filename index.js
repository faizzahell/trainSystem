import fetch from 'node-fetch';
import net from 'net';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';

dotenv.config();

const API_KEY = process.env.API_KEY;
const PROJECT_ID = process.env.PROJECT_ID;
const DOCUMENT_PATH = process.env.DOCUMENT_PATH;

const emitter = new EventEmitter();

// Fungsi untuk mengambil data GPS
const fetchGPS = async () => {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${DOCUMENT_PATH}?key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        const fields = json.fields;

        return {
            lat: parseFloat(fields.lat.doubleValue),
            lng: parseFloat(fields.lng.doubleValue),
            speed: parseFloat(fields.speed.doubleValue),
            altitude: parseFloat(fields.altitude.doubleValue),
            satellites: parseInt(fields.satellites.integerValue),
            course: parseFloat(fields.course.doubleValue),
        };
    } catch (err) {
        console.error("Gagal ambil data GPS:", err);
        return null;
    }
};

// Fungsi untuk mengirimkan data ke LabVIEW dan Python
const sendToBoth = async (data, status, value) => {
    const labviewPromise = sendToLabVIEW(data);
    const pythonPromise = sendToPython(status, value);

    await Promise.all([labviewPromise, pythonPromise]);
};

// Fungsi untuk mengirimkan data ke LabVIEW
const sendToLabVIEW = (data) => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.connect(6000, '192.168.100.84', () => {
            const message = `${data.lat};${data.lng};${data.speed};${data.altitude};${data.satellites};${data.course}\n`;
            client.write(message);
            client.end();
            resolve('Data ke LabVIEW terkirim');
        });

        client.on('error', reject);
        client.on('close', () => console.log('Koneksi TCP ke LabVIEW ditutup'));
    });
};

// Fungsi untuk mengirimkan data ke Python
const sendToPython = (status, value) => {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.connect(5000, '127.0.0.1', () => {
            const message = `${status};${value}\n`;
            client.write(message);
            client.end();
            resolve('Data ke Python terkirim');
        });

        client.on('error', reject);
        client.on('close', () => console.log('Koneksi TCP ke Python ditutup'));
    });
};

// Server untuk menerima data dari LabVIEW
const server = net.createServer((socket) => {
    console.log('LabVIEW terhubung ke server Raspberry Pi');

    socket.on('data', async (data) => {
        const command = data.toString().trim();
        const parts = command.split(";");

        const status = parseInt(parts[0]);
        const value = parseInt(parts[1]);

        console.log(`Status: ${status}`);
        console.log(`Value: ${value}`);

        // Ambil data GPS dan kirimkan ke LabVIEW dan Python
        const gps = await fetchGPS();
        if (gps) {
            console.log('GPS:', gps);
            await sendToBoth(gps, status, value);  // Kirimkan data GPS dan kontrol ke Python
        }
    });

    socket.on('close', () => {
        console.log('Koneksi LabVIEW ditutup');
    });

    socket.on('error', (err) => {
        console.error('Socket Error:', err.message);
    });
});

// Mendengarkan koneksi di port 6001
server.listen(6001, () => {
    console.log('Server Raspberry Pi menunggu perintah di port 6001');
});
