import fetch from 'node-fetch';
import net from 'net';
import dotenv from 'dotenv';
import { Gpio } from 'onoff';

dotenv.config();

const API_KEY = process.env.API_KEY;
const PROJECT_ID = process.env.PROJECT_ID;
const DOCUMENT_PATH = process.env.DOCUMENT_PATH;

const servo = new Gpio(24, 'out');

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

setInterval(async () => {
    const gps = await fetchGPS();
    if (gps) {
        console.log('GPS:', gps);
        sendToLabVIEW(gps);
    }
}, 1000);

const server = net.createServer((socket) => {
    console.log('LabVIEW terhubung ke server Raspberry Pi');

    socket.on('data', (data) => {
        const command = data.toString().trim();
        const parts = command.split(";");

        const status = parseInt(parts[0]);
        const value = parseInt(parts[1]);

        console.log(`Status Barrier: ${status}`);
        console.log(`Value Barrier : ${value}`);

        if (status === 1) {
            const pulseWidth = 1000 + (value / 100) * 1000;
            servo.writeSync(pulseWidth);
            console.log(`Servo dikendalikan ke posisi: ${pulseWidth} µs`);
        } else {
            console.log("Status bukan 1, servo tidak digerakkan");
        }
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