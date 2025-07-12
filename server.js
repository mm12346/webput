// server.js - A simple Node.js server for sending web push notifications

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors'); // To allow requests from your frontend

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ================== VAPID KEYS ==================
// ควรเก็บเป็น Environment Variables ใน Production
// สร้าง Key ได้โดยการติดตั้ง web-push globaly (npm install -g web-push)
// แล้วรันคำสั่ง `web-push generate-vapid-keys` ใน Terminal
const publicVapidKey = 'BNxogBnP7UQvmyagjJ9R1Sxa7I6_Kp-51WWewWsUEkH1Jx_km8ayUSPuTQ5Fbe2fjoF2zBchQ1KfMLJd9aCEWhI'; // Use the same key as in app.html
const privateVapidKey = 'bP4fpbU6IR4OuOr81X4-fkLMC8iOHV7oSceLvXxz0uM'; // This is your private key

webpush.setVapidDetails(
  'mailto:your-email@example.com', // ใช้อีเมลของคุณ
  publicVapidKey,
  privateVapidKey
);

// ================== STORAGE ==================
// **ข้อควรระวัง:** วิธีนี้เก็บข้อมูลในหน่วยความจำเท่านั้น
// เมื่อเซิร์ฟเวอร์รีสตาร์ทข้อมูลจะหายไป
// ใน Production ควรใช้ฐานข้อมูลจริง เช่น PostgreSQL, MongoDB หรือแม้กระทั่ง Google Sheets
let subscriptions = [];


// ================== API ROUTES ==================

// Route สำหรับบันทึก Push Subscription จาก Frontend
app.post('/save-subscription', (req, res) => {
  const subscription = req.body;
  // ตรวจสอบว่า subscription นี้ยังไม่มีในรายการก่อนเพิ่ม
  const existingSubscription = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
  if (!existingSubscription) {
    subscriptions.push(subscription);
    console.log('Subscription saved:', subscription.endpoint);
  } else {
    console.log('Subscription already exists:', subscription.endpoint);
  }
  res.status(201).json({ message: 'Subscription saved successfully.' });
});

// Route สำหรับรับคำสั่งจาก Apps Script เพื่อส่ง Notification
app.post('/send-notification', (req, res) => {
  const { title, body, url } = req.body;
  
  if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
  }

  console.log(`Sending notification to ${subscriptions.length} subscribers.`);

  const notificationPayload = JSON.stringify({
    title: title,
    body: body,
    url: url || '/index.html' // URL ที่จะเปิดเมื่อคลิก (ควรชี้ไปที่ app.html)
  });

  const promises = subscriptions.map(subscription => 
    webpush.sendNotification(subscription, notificationPayload)
      .catch(error => {
        // ถ้า endpoint หมดอายุหรือใช้งานไม่ได้ (HTTP 410 or 404) ควรลบออกจากฐานข้อมูล
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('Subscription has expired or is no longer valid: ', error.endpoint);
          subscriptions = subscriptions.filter(sub => sub.endpoint !== error.endpoint);
        } else {
           console.error('Error sending notification to ', subscription.endpoint, error);
        }
      })
  );

  Promise.all(promises)
    .then(() => res.status(200).json({ message: 'Notifications sent.' }))
    .catch(err => {
      console.error("Error sending notifications: ", err);
      res.sendStatus(500);
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
